"""Project CRUD endpoints."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db
import config

router = APIRouter()


class ProjectCreate(BaseModel):
    name:         str
    aspect_ratio: str  = "16:9"
    width:        int  = 1920
    height:       int  = 1080
    fps:          float = 30


class ProjectOut(BaseModel):
    id:           str
    name:         str
    aspect_ratio: str
    width:        int
    height:       int
    fps:          float
    created_at:   str
    updated_at:   str
    thumbnail:    Optional[str] = None
    duration_s:   float = 0


def _row_to_project(row) -> ProjectOut:
    return ProjectOut(
        id=row["id"], name=row["name"],
        aspect_ratio=row["aspect_ratio"],
        width=row["width"], height=row["height"], fps=row["fps"],
        created_at=row["created_at"], updated_at=row["updated_at"],
        thumbnail=row["thumbnail"], duration_s=row["duration_s"] or 0,
    )


@router.get("", summary="List all projects")
async def list_projects():
    async with await get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM projects ORDER BY updated_at DESC"
        )
    return {"projects": [_row_to_project(r) for r in rows]}


@router.post("", status_code=201, summary="Create a project")
async def create_project(body: ProjectCreate):
    now = datetime.now(timezone.utc).isoformat()
    pid = str(uuid.uuid4())
    async with await get_db() as db:
        await db.execute(
            "INSERT INTO projects (id,name,aspect_ratio,width,height,fps,created_at,updated_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (pid, body.name, body.aspect_ratio, body.width, body.height, body.fps, now, now),
        )
        await db.commit()
        row = await db.execute_fetchall("SELECT * FROM projects WHERE id=?", (pid,))

    # Create project folder structure
    proj_dir = config.PROJECTS_DIR / pid
    (proj_dir / "media").mkdir(parents=True, exist_ok=True)
    (proj_dir / "thumbnails").mkdir(parents=True, exist_ok=True)

    return _row_to_project(row[0])


@router.get("/{project_id}", summary="Get a project")
async def get_project(project_id: str):
    async with await get_db() as db:
        rows = await db.execute_fetchall("SELECT * FROM projects WHERE id=?", (project_id,))
    if not rows:
        raise HTTPException(404, "Project not found")
    return _row_to_project(rows[0])


@router.delete("/{project_id}", status_code=204, summary="Delete a project")
async def delete_project(project_id: str):
    async with await get_db() as db:
        await db.execute("DELETE FROM projects WHERE id=?", (project_id,))
        await db.commit()
