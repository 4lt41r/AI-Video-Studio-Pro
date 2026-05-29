"""Run ffprobe and return structured media metadata."""
import asyncio
import json
import logging
from pathlib import Path

import config

log = logging.getLogger(__name__)


async def probe(path: Path) -> dict:
    """
    Returns dict with keys:
      duration_s, width, height, fps, codec, has_audio
    All values may be None if unavailable or ffprobe is missing.
    """
    result: dict = {
        "duration_s": None,
        "width":      None,
        "height":     None,
        "fps":        None,
        "codec":      None,
        "has_audio":  False,
    }

    if not config.FFPROBE_PATH.exists():
        log.warning("ffprobe not found at %s — skipping metadata", config.FFPROBE_PATH)
        return result

    cmd = [
        str(config.FFPROBE_PATH),
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        str(path),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    except asyncio.TimeoutError:
        log.error("ffprobe timed out for %s", path)
        return result
    except Exception as e:
        log.error("ffprobe failed for %s: %s", path, e)
        return result

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        log.error("ffprobe returned invalid JSON for %s", path)
        return result

    fmt = data.get("format", {})
    if fmt.get("duration"):
        try:
            result["duration_s"] = round(float(fmt["duration"]), 3)
        except ValueError:
            pass

    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type", "")
        if codec_type == "audio":
            result["has_audio"] = True
        if codec_type == "video" and result["width"] is None:
            result["width"]  = stream.get("width")
            result["height"] = stream.get("height")
            result["codec"]  = stream.get("codec_name")
            r_fps = stream.get("r_frame_rate", "0/1")
            try:
                num, den = r_fps.split("/")
                den = int(den)
                if den:
                    result["fps"] = round(int(num) / den, 3)
            except (ValueError, ZeroDivisionError):
                pass

    return result
