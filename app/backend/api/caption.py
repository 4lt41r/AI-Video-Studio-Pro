"""Caption API — Whisper model info + transcription jobs."""
import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
import engines.whisper_engine as whisper_engine

log = logging.getLogger("avsp.caption")
router = APIRouter()

# In-memory job store: job_id → {status, progress, segments, error}
# Jobs are ephemeral — they live until the app restarts or the user discards them.
_jobs: dict[str, dict] = {}


# ── Request / response models ─────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    media_path: str
    model:      str         = "base"
    language:   str | None  = None   # None → auto-detect


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/models")
async def list_models():
    available = whisper_engine.is_available()
    models = [
        {
            "name":       name,
            "size_mb":    whisper_engine.MODEL_SIZES_MB[name],
            "downloaded": whisper_engine.is_downloaded(name),
            "available":  available,
        }
        for name in whisper_engine.SUPPORTED_MODELS
    ]
    return {"models": models, "whisper_available": available}


@router.post("/transcribe", status_code=202)
async def start_transcribe(body: TranscribeRequest):
    if not whisper_engine.is_available():
        raise HTTPException(
            422,
            "faster-whisper is not installed. "
            "Run: pip install faster-whisper  (inside env/)",
        )
    if body.model not in whisper_engine.SUPPORTED_MODELS:
        raise HTTPException(
            400,
            f"Unknown model '{body.model}'. "
            f"Supported: {whisper_engine.SUPPORTED_MODELS}",
        )

    media_path = Path(body.media_path)
    if not media_path.exists():
        raise HTTPException(404, f"Media file not found: {media_path}")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status":   "extracting",
        "progress": 5,
        "segments": None,
        "error":    None,
    }

    asyncio.create_task(
        _run(job_id, media_path, body.model, body.language)
    )
    return {"job_id": job_id, "status": "extracting"}


@router.get("/{job_id}")
async def get_caption_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Caption job not found")
    return {"job_id": job_id, **job}


@router.delete("/{job_id}")
async def cancel_caption_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Caption job not found")
    job["status"] = "cancelled"
    return {"status": "cancelled"}


# ── Background task ───────────────────────────────────────────────────────────

async def _run(
    job_id:     str,
    media_path: Path,
    model:      str,
    language:   str | None,
) -> None:
    from api.ws import broadcast

    job = _jobs[job_id]
    tmp_wav = config.TEMP_DIR / f"caption_{job_id}.wav"

    async def _broadcast(extra: dict) -> None:
        await broadcast({"type": "caption_update", "job_id": job_id, **extra})

    try:
        # ── Step 1: extract audio ─────────────────────────────────────────────
        await whisper_engine.extract_audio(media_path, tmp_wav)

        if job["status"] == "cancelled":
            return

        job["status"]   = "transcribing"
        job["progress"] = 20
        await _broadcast({"status": "transcribing", "progress": 20})

        # ── Step 2: transcribe ────────────────────────────────────────────────
        # Runs in thread pool (CPU-bound); reports indeterminate progress.
        segments = await whisper_engine.transcribe(model, tmp_wav, language)

        if job["status"] == "cancelled":
            return

        job["status"]   = "done"
        job["progress"] = 100
        job["segments"] = segments
        await _broadcast({"status": "done", "progress": 100, "segments": segments})

    except Exception as exc:
        log.error("Caption job %s failed: %s", job_id, exc)
        job["status"] = "failed"
        job["error"]  = str(exc)
        await _broadcast({"status": "failed", "error": str(exc)})

    finally:
        if tmp_wav.exists():
            tmp_wav.unlink(missing_ok=True)
