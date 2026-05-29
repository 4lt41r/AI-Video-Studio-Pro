"""Proxy media generation — creates low-res preview copies of large video files."""
import asyncio
import logging
from pathlib import Path

import config

log = logging.getLogger("avsp.proxy")

# Files wider than this get a proxy generated on import
PROXY_WIDTH_THRESHOLD = 1920
# Files larger than this (bytes) also get a proxy
PROXY_SIZE_THRESHOLD  = 500 * 1024 * 1024  # 500 MB

# Target proxy height (width auto-calculated to keep aspect ratio)
PROXY_HEIGHT = 360


def should_proxy(width: int | None, height: int | None, size_bytes: int) -> bool:
    """Return True if this file is large enough to warrant a proxy."""
    if width and width > PROXY_WIDTH_THRESHOLD:
        return True
    if height and height > PROXY_WIDTH_THRESHOLD:
        return True
    if size_bytes > PROXY_SIZE_THRESHOLD:
        return True
    return False


async def generate(source_path: Path, proxy_dir: Path, media_id: str) -> Path | None:
    """
    Generate a 360p proxy at proxy_dir/{media_id}_proxy.mp4.
    Returns the proxy path on success, None on failure.
    """
    proxy_dir.mkdir(parents=True, exist_ok=True)
    out = proxy_dir / f"{media_id}_proxy.mp4"

    if out.exists():
        log.info("Proxy already exists: %s", out)
        return out

    ffmpeg_bin = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i", str(source_path),
        "-vf", f"scale=-2:{PROXY_HEIGHT}",
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:a", "64k",
        "-movflags", "+faststart",
        str(out),
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        if proc.returncode != 0:
            log.error("Proxy generation failed for %s: %s", source_path.name,
                      stderr.decode(errors="replace")[-500:])
            return None
        log.info("Proxy generated: %s (%.1f MB)", out.name, out.stat().st_size / 1024 ** 2)
        return out
    except asyncio.TimeoutError:
        log.error("Proxy generation timed out for %s", source_path.name)
        return None
    except Exception as exc:
        log.error("Proxy generation error for %s: %s", source_path.name, exc)
        return None
