"""Generate thumbnail images from video/image files using FFmpeg."""
import asyncio
import logging
from pathlib import Path

import config

log = logging.getLogger(__name__)

THUMB_W = 256
THUMB_H = 144


async def generate(
    source: Path,
    output: Path,
    time_s: float = 1.0,
    width:  int   = THUMB_W,
    height: int   = THUMB_H,
) -> bool:
    """
    Generate a JPEG thumbnail at `time_s` seconds into `source`.
    Returns True if thumbnail was created successfully.
    """
    if not config.FFMPEG_PATH.exists():
        log.warning("ffmpeg not found — skipping thumbnail for %s", source)
        return False

    output.parent.mkdir(parents=True, exist_ok=True)

    # Clamp seek time: don't seek past 5 s to avoid slow seeks on long files
    seek = min(time_s, 5.0)

    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
    )
    cmd = [
        str(config.FFMPEG_PATH), "-y",
        "-ss", str(seek),
        "-i", str(source),
        "-vframes", "1",
        "-vf", vf,
        "-q:v", "3",
        str(output),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=30)
    except asyncio.TimeoutError:
        log.error("thumbnail generation timed out for %s", source)
        return False
    except Exception as e:
        log.error("thumbnail generation failed for %s: %s", source, e)
        return False

    ok = output.exists() and output.stat().st_size > 0
    if not ok:
        log.warning("thumbnail output empty or missing for %s", source)
    return ok
