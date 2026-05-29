"""Job status endpoints."""
from fastapi import APIRouter, HTTPException
from database import get_db

router = APIRouter()


@router.get("", summary="List all jobs")
async def list_jobs():
    async with await get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50"
        )
    return {"jobs": [dict(r) for r in rows]}


@router.get("/{job_id}", summary="Get a job")
async def get_job(job_id: str):
    async with await get_db() as db:
        rows = await db.execute_fetchall("SELECT * FROM jobs WHERE id=?", (job_id,))
    if not rows:
        raise HTTPException(404, "Job not found")
    return dict(rows[0])
