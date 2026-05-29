"""Waveform engine — extract audio peak data for timeline visualization."""
import asyncio
import logging
import struct
from pathlib import Path

import config

log = logging.getLogger("avsp.waveform")

_SAMPLE_RATE = 2000   # Hz — low rate gives small data while preserving shape
_MAX_PEAKS   = 500    # max bars returned to frontend


async def get_peaks(media_path: Path, num_peaks: int = 200) -> list[float]:
    """
    Extract normalized RMS peak values (0..1) from any audio/video file.
    Resamples to _SAMPLE_RATE Hz mono via FFmpeg pipe, then buckets into
    num_peaks values. Returns [] if no audio stream is found.
    """
    num_peaks = min(num_peaks, _MAX_PEAKS)
    ffmpeg = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"

    cmd = [
        ffmpeg,
        "-i",      str(media_path),
        "-filter:a", f"aresample={_SAMPLE_RATE}",
        "-map",    "0:a:0",           # first audio stream
        "-c:a",    "pcm_s16le",
        "-f",      "s16le",
        "-loglevel", "error",
        "pipe:1",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60.0)
    except asyncio.TimeoutError:
        log.warning("Waveform extraction timed out for %s", media_path.name)
        return []
    except Exception as exc:
        log.warning("Waveform extraction failed for %s: %s", media_path.name, exc)
        return []

    if not stdout or len(stdout) < 2:
        return []

    # Parse raw signed 16-bit little-endian samples
    sample_count = len(stdout) // 2
    samples = struct.unpack_from(f"<{sample_count}h", stdout)

    if sample_count == 0:
        return []

    # Bucket into num_peaks groups and compute RMS per bucket
    bucket_size = max(1, sample_count // num_peaks)
    peaks: list[float] = []

    for i in range(num_peaks):
        start = i * bucket_size
        end   = min(start + bucket_size, sample_count)
        if start >= sample_count:
            peaks.append(0.0)
            continue
        bucket = samples[start:end]
        rms    = (sum(s * s for s in bucket) / len(bucket)) ** 0.5
        # Normalize: int16 max = 32767
        peaks.append(min(1.0, rms / 32767.0))

    return peaks
