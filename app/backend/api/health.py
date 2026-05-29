"""GET /api/health — lightweight liveness check."""
import time
from fastapi import APIRouter
from pydantic import BaseModel
import config

router  = APIRouter()
_started = time.time()


class HealthOut(BaseModel):
    status:   str
    version:  str
    phase:    int
    uptime_s: float
    ffmpeg_available: bool
    database_ok:      bool


@router.get("/health", response_model=HealthOut)
async def health():
    ffmpeg_ok = config.FFMPEG_PATH.exists()
    db_ok     = config.DATABASE_PATH.exists()
    return HealthOut(
        status           = "ok",
        version          = config.APP_VERSION,
        phase            = config.APP_PHASE,
        uptime_s         = round(time.time() - _started, 1),
        ffmpeg_available = ffmpeg_ok,
        database_ok      = db_ok,
    )
