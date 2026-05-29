"""Export job endpoints — FFmpeg rendering (Phase 6)."""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import config
from database import get_db
from engines import render_engine

router = APIRouter()


class ExportStart(BaseModel):
    project_id:      str
    preset:          str = "youtube-hd"
    output_filename: str = ""
    quality:         str = "high"   # high | medium | web
    timeline_state:  dict = {}


_QUALITY_CRF = {"high": 16, "medium": 20, "web": 24}


@router.get("/history", summary="Export history")
async def export_history(limit: int = Query(default=30, le=100)):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            """SELECT e.id, e.project_id, e.preset, e.output_path, e.status,
                      e.started_at, e.finished_at, e.error,
                      p.name AS project_name,
                      j.progress
               FROM exports e
               LEFT JOIN projects p ON p.id = e.project_id
               LEFT JOIN jobs j ON j.id = e.id
               ORDER BY e.started_at DESC
               LIMIT ?""",
            (limit,),
        )
    results = []
    for r in rows:
        d = dict(r)
        op = d.get("output_path")
        if op:
            p = Path(op)
            d["file_size_mb"] = round(p.stat().st_size / 1024 ** 2, 1) if p.exists() else None
            d["filename"]     = p.name
        else:
            d["file_size_mb"] = None
            d["filename"]     = None
        results.append(d)
    return {"exports": results}


@router.get("/presets", summary="List export presets")
async def get_presets():
    try:
        return json.loads(
            (config.ROOT / "config" / "export-presets.json").read_text(encoding="utf-8")
        )
    except Exception:
        return {"presets": []}


@router.post("", status_code=202, summary="Start export")
async def start_export(body: ExportStart):
    if render_engine.is_busy():
        raise HTTPException(409, "Another export is already in progress — wait or cancel it first")

    # Load and validate preset
    presets_data = json.loads(
        (config.ROOT / "config" / "export-presets.json").read_text(encoding="utf-8")
    )
    preset = next((p for p in presets_data["presets"] if p["id"] == body.preset), None)
    if not preset:
        raise HTTPException(400, f"Unknown preset: {body.preset!r}")

    crf_override = _QUALITY_CRF.get(body.quality)

    # Verify project
    async with get_db() as db:
        proj_rows = await db.execute_fetchall("SELECT * FROM projects WHERE id=?", (body.project_id,))
    if not proj_rows:
        raise HTTPException(404, "Project not found")
    project = dict(proj_rows[0])

    # Build output file path
    now     = datetime.now(timezone.utc)
    ts      = now.strftime("%Y%m%d_%H%M%S")
    safe    = "".join(c for c in project["name"] if c.isalnum() or c in " -_").strip() or "export"
    ext     = preset.get("container", "mp4")
    fname   = body.output_filename.strip() or f"{safe}_{ts}.{ext}"
    config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = config.EXPORTS_DIR / fname

    # Create job + export records
    job_id  = str(uuid.uuid4())
    now_iso = now.isoformat()

    async with get_db() as db:
        await db.execute(
            "INSERT INTO jobs (id,type,project_id,status,progress,created_at,updated_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (job_id, "export", body.project_id, "pending", 0, now_iso, now_iso),
        )
        await db.execute(
            "INSERT INTO exports (id,project_id,preset,status,started_at,settings) "
            "VALUES (?,?,?,?,?,?)",
            (job_id, body.project_id, body.preset, "running", now_iso,
             json.dumps(body.timeline_state)),
        )
        await db.commit()

    # Load project media map
    async with get_db() as db:
        media_rows = await db.execute_fetchall(
            "SELECT * FROM media WHERE project_id=?", (body.project_id,)
        )
    media_map = {r["id"]: dict(r) for r in media_rows}

    # Extract tracks from timeline_state payload
    ts_payload = body.timeline_state
    tracks = ts_payload.get("tracks", ts_payload.get("state", {}).get("tracks", []))

    # ── Job update helper ──────────────────────────────────────────────────────

    async def _update_job(status: str, progress: float, error: str | None) -> None:
        updated = datetime.now(timezone.utc).isoformat()
        async with get_db() as db:
            await db.execute(
                "UPDATE jobs SET status=?,progress=?,error=?,updated_at=? WHERE id=?",
                (status, progress, error, updated, job_id),
            )
            if status in ("done", "failed", "cancelled"):
                await db.execute(
                    "UPDATE exports SET status=?,output_path=?,finished_at=? WHERE id=?",
                    (status, str(output_path) if status == "done" else None, updated, job_id),
                )
            await db.commit()

    # ── Launch render as background asyncio task ───────────────────────────────

    async def _run() -> None:
        try:
            await render_engine.render(
                export_id=job_id,
                tracks=tracks,
                media_map=media_map,
                preset=preset,
                output_path=output_path,
                crf_override=crf_override,
                update_cb=_update_job,
            )
        except asyncio.CancelledError:
            await _update_job("cancelled", 0.0, "Cancelled")
        except Exception as exc:
            await _update_job("failed", 0.0, str(exc))

    asyncio.create_task(_run())

    return {
        "export_id":   job_id,
        "job_id":      job_id,
        "status":      "running",
        "output_path": str(output_path),
    }


@router.get("/{export_id}", summary="Get export status")
async def get_export(export_id: str):
    async with get_db() as db:
        rows = await db.execute_fetchall("SELECT * FROM jobs WHERE id=?", (export_id,))
    if not rows:
        raise HTTPException(404, "Export not found")
    return dict(rows[0])


@router.post("/{export_id}/cancel", summary="Cancel a running export")
async def cancel_export(export_id: str):
    was_running = render_engine.cancel(export_id)
    updated = datetime.now(timezone.utc).isoformat()
    async with get_db() as db:
        await db.execute(
            "UPDATE jobs SET status='cancelled',updated_at=? WHERE id=? AND status='running'",
            (updated, export_id),
        )
        await db.commit()
    return {"cancelled": True, "was_running": was_running}
