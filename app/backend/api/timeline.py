"""Timeline save/load endpoints with backup versioning (Phase 15)."""
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db
import config

router = APIRouter()

_MAX_BACKUPS = 5


class TimelineSave(BaseModel):
    state: dict


def _backup_dir(project_id: str) -> Path:
    d = config.PROJECTS_DIR / project_id / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_backup(project_id: str, state: dict, now_iso: str) -> None:
    """Write a timestamped backup and prune old ones beyond _MAX_BACKUPS."""
    try:
        bdir = _backup_dir(project_id)
        ts   = now_iso.replace(":", "-").replace("+", "Z")[:19]
        bfile = bdir / f"timeline_{ts}.json"
        bfile.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")

        # Prune: keep only the newest _MAX_BACKUPS files
        backups = sorted(bdir.glob("timeline_*.json"), key=lambda f: f.stat().st_mtime)
        for old in backups[:-_MAX_BACKUPS]:
            try:
                old.unlink()
            except OSError:
                pass
    except Exception:
        pass  # backups are best-effort


@router.get("/{project_id}/timeline", summary="Load timeline state")
async def get_timeline(project_id: str):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM timelines WHERE project_id=?", (project_id,)
        )
    if not rows:
        return {"project_id": project_id, "state": {}, "version": 0}
    return {
        "project_id": project_id,
        "state":      json.loads(rows[0]["state"]),
        "version":    rows[0]["version"],
        "saved_at":   rows[0]["saved_at"],
    }


@router.put("/{project_id}/timeline", summary="Save timeline state")
async def save_timeline(project_id: str, body: TimelineSave):
    now = datetime.now(timezone.utc).isoformat()
    async with get_db() as db:
        await db.execute(
            """INSERT INTO timelines (project_id, state, version, saved_at) VALUES (?,?,1,?)
               ON CONFLICT(project_id) DO UPDATE SET
                 state=excluded.state,
                 version=version+1,
                 saved_at=excluded.saved_at""",
            (project_id, json.dumps(body.state), now),
        )
        await db.execute(
            "UPDATE projects SET updated_at=? WHERE id=?", (now, project_id)
        )
        await db.commit()

    # Write versioned backup (best-effort, non-blocking)
    _write_backup(project_id, body.state, now)

    return {"saved": True, "saved_at": now}


@router.get("/{project_id}/timeline/backups", summary="List timeline backups")
async def list_backups(project_id: str):
    bdir = config.PROJECTS_DIR / project_id / "backups"
    if not bdir.exists():
        return {"backups": []}
    backups = []
    for f in sorted(bdir.glob("timeline_*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        st = f.stat()
        backups.append({
            "filename":    f.name,
            "size_bytes":  st.st_size,
            "created_at":  datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
        })
    return {"backups": backups}


@router.post("/{project_id}/timeline/restore/{filename}", summary="Restore from a backup")
async def restore_backup(project_id: str, filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    bfile = config.PROJECTS_DIR / project_id / "backups" / filename
    if not bfile.exists():
        raise HTTPException(404, "Backup file not found")

    state = json.loads(bfile.read_text(encoding="utf-8"))
    now   = datetime.now(timezone.utc).isoformat()
    async with get_db() as db:
        await db.execute(
            """INSERT INTO timelines (project_id, state, version, saved_at) VALUES (?,?,1,?)
               ON CONFLICT(project_id) DO UPDATE SET
                 state=excluded.state,
                 version=version+1,
                 saved_at=excluded.saved_at""",
            (project_id, json.dumps(state), now),
        )
        await db.commit()

    return {"restored": True, "from_backup": filename, "saved_at": now}
