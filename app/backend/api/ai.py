"""AI Tools API — scene detection, silence removal, beat sync, highlights, analysis."""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import engines.ai_engine as ai_engine

log    = logging.getLogger("avsp.ai")
router = APIRouter()

# In-memory job store — ephemeral, cleared on restart
_jobs: dict[str, dict] = {}


# ── Request models ─────────────────────────────────────────────────────────────

class SceneDetectRequest(BaseModel):
    media_path: str
    threshold:  float = 0.3   # 0.0–1.0; lower = more scenes

class SilenceDetectRequest(BaseModel):
    media_path:         str
    noise_threshold_db: float = -40.0  # dB; e.g. -40, -50
    min_duration_s:     float = 0.5    # minimum silence length

class BeatDetectRequest(BaseModel):
    media_path:  str
    sensitivity: float = 0.5   # 0.0–1.0

class HighlightRequest(BaseModel):
    media_path:         str
    highlight_count:    int   = 5
    segment_duration_s: float = 5.0

class AnalyzeProjectRequest(BaseModel):
    timeline_state: dict
    media_items:    list[dict]
    project:        dict

class SmartResizeRequest(BaseModel):
    source_width:  int
    source_height: int


# ── Job helpers ────────────────────────────────────────────────────────────────

def _new_job(kind: str) -> tuple[str, dict]:
    jid = str(uuid.uuid4())
    job = {
        "kind":       kind,
        "status":     "running",
        "progress":   0,
        "result":     None,
        "error":      None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _jobs[jid] = job
    return jid, job


async def _send(jid: str, job: dict) -> None:
    try:
        from api.ws import broadcast
        await broadcast({"type": "ai_update", "job_id": jid, **job})
    except Exception:
        pass


# ── Scene Detection ────────────────────────────────────────────────────────────

@router.post("/scene-detect", status_code=202)
async def start_scene_detect(body: SceneDetectRequest):
    p = Path(body.media_path)
    if not p.exists():
        raise HTTPException(404, f"File not found: {p}")
    if not (0.0 <= body.threshold <= 1.0):
        raise HTTPException(400, "threshold must be 0.0–1.0")
    jid, job = _new_job("scene_detect")
    asyncio.create_task(_scene_task(jid, job, p, body.threshold))
    return {"job_id": jid, "status": "running"}


async def _scene_task(jid: str, job: dict, p: Path, threshold: float) -> None:
    try:
        job["progress"] = 10
        await _send(jid, job)
        scenes = await ai_engine.detect_scenes(p, threshold)
        job.update({"status": "done", "progress": 100, "result": {"scenes": scenes}})
    except Exception as exc:
        log.error("scene-detect %s failed: %s", jid, exc)
        job.update({"status": "failed", "error": str(exc)})
    await _send(jid, job)


# ── Silence Detection ──────────────────────────────────────────────────────────

@router.post("/silence-detect", status_code=202)
async def start_silence_detect(body: SilenceDetectRequest):
    p = Path(body.media_path)
    if not p.exists():
        raise HTTPException(404, f"File not found: {p}")
    jid, job = _new_job("silence_detect")
    asyncio.create_task(_silence_task(jid, job, p, body.noise_threshold_db, body.min_duration_s))
    return {"job_id": jid, "status": "running"}


async def _silence_task(jid: str, job: dict, p: Path, thr: float, min_dur: float) -> None:
    try:
        job["progress"] = 10
        await _send(jid, job)
        segs = await ai_engine.detect_silence(p, thr, min_dur)
        job.update({"status": "done", "progress": 100, "result": {"segments": segs}})
    except Exception as exc:
        log.error("silence-detect %s failed: %s", jid, exc)
        job.update({"status": "failed", "error": str(exc)})
    await _send(jid, job)


# ── Beat Detection ─────────────────────────────────────────────────────────────

@router.post("/beat-detect", status_code=202)
async def start_beat_detect(body: BeatDetectRequest):
    p = Path(body.media_path)
    if not p.exists():
        raise HTTPException(404, f"File not found: {p}")
    if not (0.0 <= body.sensitivity <= 1.0):
        raise HTTPException(400, "sensitivity must be 0.0–1.0")
    jid, job = _new_job("beat_detect")
    asyncio.create_task(_beat_task(jid, job, p, body.sensitivity))
    return {"job_id": jid, "status": "running"}


async def _beat_task(jid: str, job: dict, p: Path, sens: float) -> None:
    try:
        job["progress"] = 10
        await _send(jid, job)
        result = await ai_engine.detect_beats(p, sens)
        job.update({"status": "done", "progress": 100, "result": result})
    except Exception as exc:
        log.error("beat-detect %s failed: %s", jid, exc)
        job.update({"status": "failed", "error": str(exc)})
    await _send(jid, job)


# ── Highlight Detection ────────────────────────────────────────────────────────

@router.post("/highlights", status_code=202)
async def start_highlights(body: HighlightRequest):
    p = Path(body.media_path)
    if not p.exists():
        raise HTTPException(404, f"File not found: {p}")
    jid, job = _new_job("highlights")
    asyncio.create_task(_highlight_task(jid, job, p, body.highlight_count, body.segment_duration_s))
    return {"job_id": jid, "status": "running"}


async def _highlight_task(jid: str, job: dict, p: Path, count: int, seg_dur: float) -> None:
    try:
        job["progress"] = 10
        await _send(jid, job)
        highlights = await ai_engine.detect_highlights(p, count, seg_dur)
        job.update({"status": "done", "progress": 100, "result": {"highlights": highlights}})
    except Exception as exc:
        log.error("highlights %s failed: %s", jid, exc)
        job.update({"status": "failed", "error": str(exc)})
    await _send(jid, job)


# ── Job status (shared) ────────────────────────────────────────────────────────

@router.get("/jobs")
async def list_ai_jobs():
    jobs = [{"job_id": jid, **job} for jid, job in _jobs.items()]
    jobs.sort(key=lambda j: j.get("created_at", ""), reverse=True)
    return {"jobs": jobs}


@router.get("/job/{job_id}")
async def get_ai_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "AI job not found")
    return {"job_id": job_id, **job}


@router.delete("/job/{job_id}")
async def cancel_ai_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "AI job not found")
    job["status"] = "cancelled"
    return {"status": "cancelled"}


# ── Synchronous endpoints (instant) ───────────────────────────────────────────

@router.post("/analyze-project")
async def analyze_project(body: AnalyzeProjectRequest):
    return ai_engine.analyze_project(body.timeline_state, body.media_items)


@router.post("/smart-resize")
async def smart_resize(body: SmartResizeRequest):
    return {"options": ai_engine.get_smart_resize_options(body.source_width, body.source_height)}


@router.post("/export-recommendations")
async def export_recommendations(body: AnalyzeProjectRequest):
    analysis = ai_engine.analyze_project(body.timeline_state, body.media_items)
    recs     = ai_engine.get_export_recommendations(analysis, body.project)
    return {"recommendations": recs, "analysis": analysis}
