"""AI analysis engine — scene detection, silence removal, beat detection, highlights."""
import asyncio
import logging
import re
from pathlib import Path

import config

log = logging.getLogger("avsp.ai")

_BEAT_SAMPLE_RATE = 22050
_BEAT_HOP_SIZE    = 512
_BEAT_FRAME_SIZE  = 2048


# ── Scene Detection ────────────────────────────────────────────────────────────

async def detect_scenes(media_path: Path, threshold: float = 0.3) -> list[dict]:
    """
    Detect scene changes via FFmpeg scene filter.
    Returns [{time_s, score}] sorted by time. Skips the first frame.
    """
    ffmpeg = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"
    cmd = [
        ffmpeg, "-i", str(media_path),
        "-vf", f"select=gt(scene\\,{threshold}),showinfo",
        "-an", "-vsync", "0", "-f", "null", "-",
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
    except asyncio.TimeoutError:
        log.warning("Scene detection timed out: %s", media_path.name)
        return []
    except Exception as exc:
        log.warning("Scene detection error for %s: %s", media_path.name, exc)
        return []

    scenes: list[dict] = []
    seen: set[int] = set()
    for line in stderr.decode("utf-8", errors="replace").splitlines():
        if "Parsed_showinfo" not in line:
            continue
        m = re.search(r"pts_time:(\d+\.?\d*)", line)
        if not m:
            continue
        t = float(m.group(1))
        if t < 0.1:
            continue
        bucket = int(t * 10)
        if bucket in seen:
            continue
        seen.add(bucket)
        scenes.append({"time_s": round(t, 3), "score": round(threshold, 2)})

    return sorted(scenes, key=lambda x: x["time_s"])


# ── Silence Detection ──────────────────────────────────────────────────────────

async def detect_silence(
    media_path: Path,
    noise_threshold_db: float = -40.0,
    min_duration_s: float = 0.5,
) -> list[dict]:
    """
    Detect silent segments via FFmpeg silencedetect.
    Returns [{start_s, end_s, duration_s}].
    """
    ffmpeg = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"
    cmd = [
        ffmpeg, "-i", str(media_path),
        "-af", f"silencedetect=n={noise_threshold_db}dB:d={min_duration_s}",
        "-f", "null", "-",
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
    except asyncio.TimeoutError:
        log.warning("Silence detection timed out: %s", media_path.name)
        return []
    except Exception as exc:
        log.warning("Silence detection error for %s: %s", media_path.name, exc)
        return []

    text = stderr.decode("utf-8", errors="replace")
    segments: list[dict] = []
    current_start: float | None = None

    for line in text.splitlines():
        ms = re.search(r"silence_start:\s*([\d.eE+\-]+)", line)
        me = re.search(r"silence_end:\s*([\d.eE+\-]+)", line)
        if ms:
            current_start = float(ms.group(1))
        if me and current_start is not None:
            end = float(me.group(1))
            dur = end - current_start
            segments.append({
                "start_s":    round(current_start, 3),
                "end_s":      round(end, 3),
                "duration_s": round(dur, 3),
            })
            current_start = None

    return segments


# ── Beat Detection ─────────────────────────────────────────────────────────────

async def detect_beats(media_path: Path, sensitivity: float = 0.5) -> dict:
    """
    Detect beat timestamps via energy-based onset detection (FFmpeg + numpy).
    Returns {beats: [time_s, ...], bpm: float}.
    """
    try:
        import numpy as np
    except ImportError:
        log.warning("numpy unavailable for beat detection")
        return {"beats": [], "bpm": 0.0}

    ffmpeg = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"
    cmd = [
        ffmpeg, "-i", str(media_path),
        "-filter:a", f"aresample={_BEAT_SAMPLE_RATE}",
        "-map", "0:a:0", "-c:a", "pcm_s16le", "-f", "s16le",
        "-loglevel", "error", "pipe:1",
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180.0)
    except asyncio.TimeoutError:
        log.warning("Beat detection timed out: %s", media_path.name)
        return {"beats": [], "bpm": 0.0}
    except Exception as exc:
        log.warning("Beat detection error for %s: %s", media_path.name, exc)
        return {"beats": [], "bpm": 0.0}

    if not stdout or len(stdout) < 4:
        return {"beats": [], "bpm": 0.0}

    samples = np.frombuffer(stdout, dtype=np.int16).astype(np.float32) / 32768.0
    hop     = _BEAT_HOP_SIZE
    frame   = _BEAT_FRAME_SIZE
    n_frames = max(0, (len(samples) - frame) // hop + 1)

    if n_frames < 4:
        return {"beats": [], "bpm": 0.0}

    energy = np.array([
        float(np.sum(samples[i * hop: i * hop + frame] ** 2) / frame)
        for i in range(n_frames)
    ], dtype=np.float32)

    onset = np.maximum(0.0, np.diff(energy, prepend=energy[0]))
    if onset.max() > 0:
        onset /= onset.max()

    # Adaptive local threshold
    win = max(1, int(0.5 * _BEAT_SAMPLE_RATE / hop))
    mult = 2.0 - 1.2 * float(sensitivity)
    thr  = np.array([
        float(np.mean(onset[max(0, i - win): min(n_frames, i + win + 1)])) * mult
        for i in range(n_frames)
    ], dtype=np.float32)

    min_gap = max(1, int(0.25 * _BEAT_SAMPLE_RATE / hop))
    beats_frames: list[int] = []
    last = -min_gap

    for i in range(1, n_frames - 1):
        if (onset[i] > thr[i]
                and onset[i] > onset[i - 1]
                and onset[i] >= onset[i + 1]
                and (i - last) >= min_gap):
            beats_frames.append(i)
            last = i

    beats_s = [round(float(f * hop) / _BEAT_SAMPLE_RATE, 3) for f in beats_frames]

    bpm = 0.0
    if len(beats_s) >= 2:
        ibi = np.diff(beats_s)
        med = float(np.median(ibi))
        if med > 0:
            bpm = 60.0 / med
            while bpm > 200: bpm /= 2
            while bpm < 40:  bpm *= 2
            bpm = round(bpm, 1)

    return {"beats": beats_s, "bpm": bpm}


# ── Highlight Detection ────────────────────────────────────────────────────────

async def detect_highlights(
    media_path: Path,
    highlight_count: int = 5,
    segment_duration_s: float = 5.0,
) -> list[dict]:
    """
    Score every second by scene changes + audio energy; return top N non-overlapping segments.
    Returns [{start_s, end_s, score, reason}].
    """
    try:
        import numpy as np
    except ImportError:
        return []

    duration = await _get_duration(media_path)
    if duration <= 0:
        return []

    n_secs = max(1, int(duration))

    # Parallel: run scene detect and waveform extraction
    scene_task  = asyncio.create_task(detect_scenes(media_path, threshold=0.15))
    energy_task = asyncio.create_task(_get_audio_energy(media_path, n_secs))
    scene_times, energy = await asyncio.gather(scene_task, energy_task)

    scores = np.zeros(n_secs, dtype=np.float32)

    for sc in scene_times:
        t = int(sc["time_s"])
        if 0 <= t < n_secs:
            scores[t] += 2.0

    if energy:
        e = np.array(energy[:n_secs], dtype=np.float32)
        if len(e) < n_secs:
            e = np.pad(e, (0, n_secs - len(e)))
        scores += e

    win = max(1, int(segment_duration_s / 2))
    smoothed = np.convolve(scores, np.ones(win) / win, mode="same")

    highlights: list[dict] = []
    remaining  = smoothed.copy()
    min_gap    = max(1, int(segment_duration_s))

    for _ in range(min(highlight_count, max(1, n_secs // min_gap))):
        if remaining.max() == 0:
            break
        peak = int(np.argmax(remaining))
        start = max(0.0, float(peak) - segment_duration_s / 2)
        end   = min(duration, start + segment_duration_s)
        start = max(0.0, end - segment_duration_s)

        near_scene = any(abs(sc["time_s"] - peak) < 2.0 for sc in scene_times)
        highlights.append({
            "start_s": round(start, 2),
            "end_s":   round(end, 2),
            "score":   round(float(smoothed[peak]), 3),
            "reason":  "scene change" if near_scene else "high audio energy",
        })

        lo = max(0, peak - min_gap)
        hi = min(n_secs, peak + min_gap + 1)
        remaining[lo:hi] = 0

    return sorted(highlights, key=lambda x: x["start_s"])


# ── Project Analysis ───────────────────────────────────────────────────────────

def analyze_project(timeline_state: dict, media_items: list[dict]) -> dict:
    """Pure-Python project analysis — no I/O needed."""
    tracks   = timeline_state.get("tracks", [])
    duration = timeline_state.get("duration_s", 0.0)

    clip_counts: dict[str, int] = {}
    used_ids:    set[str]       = set()
    total_clip_dur = 0.0
    effect_types:  dict[str, int] = {}
    transition_count = 0

    for track in tracks:
        ttype = track.get("type", "unknown")
        for clip in track.get("clips", []):
            clip_counts[ttype] = clip_counts.get(ttype, 0) + 1
            mid = clip.get("media_id", "")
            if mid:
                used_ids.add(mid)
            total_clip_dur += clip.get("end_s", 0) - clip.get("start_s", 0)
            for eff in clip.get("effects", []):
                t = eff.get("type", "unknown")
                effect_types[t] = effect_types.get(t, 0) + 1
            if clip.get("transition"):
                transition_count += 1

    unused = [m for m in media_items if m.get("id") not in used_ids]

    recs: list[dict] = []
    if clip_counts.get("video", 0) == 0:
        recs.append({"level": "warning", "text": "No video clips on timeline — add video from the media panel."})
    if clip_counts.get("audio", 0) == 0 and clip_counts.get("video", 0) > 0:
        recs.append({"level": "info", "text": "No background music track — add an audio file to the Audio track."})
    if clip_counts.get("subtitle", 0) == 0 and duration > 10:
        recs.append({"level": "info", "text": "No captions — use Auto Captions for accessibility."})
    if transition_count == 0 and clip_counts.get("video", 0) > 2:
        recs.append({"level": "info", "text": "No transitions between clips — add transitions in the Effects panel."})
    if unused:
        recs.append({"level": "info", "text": f"{len(unused)} imported file(s) not used on timeline."})
    if not recs:
        recs.append({"level": "success", "text": "Project looks great — ready to export!"})

    return {
        "duration_s":          round(duration, 2),
        "total_clips":         sum(clip_counts.values()),
        "clip_counts":         clip_counts,
        "total_clip_duration": round(total_clip_dur, 2),
        "unused_media_count":  len(unused),
        "unused_media":        [m.get("name", "") for m in unused],
        "effect_types":        effect_types,
        "transition_count":    transition_count,
        "recommendations":     recs,
    }


# ── Smart Resize ───────────────────────────────────────────────────────────────

_SOCIAL_FORMATS = [
    {"id": "instagram-reel",     "name": "Instagram Reels / TikTok",  "width": 1080, "height": 1920},
    {"id": "youtube-shorts",     "name": "YouTube Shorts",             "width": 1080, "height": 1920},
    {"id": "instagram-post",     "name": "Instagram Square",           "width": 1080, "height": 1080},
    {"id": "youtube-1080p",      "name": "YouTube / Landscape 1080p",  "width": 1920, "height": 1080},
    {"id": "twitter-720p",       "name": "Twitter / X (720p)",         "width": 1280, "height":  720},
    {"id": "instagram-portrait", "name": "Instagram Portrait 4:5",     "width": 1080, "height": 1350},
    {"id": "linkedin",           "name": "LinkedIn Video",             "width": 1200, "height":  628},
]

def get_smart_resize_options(source_width: int, source_height: int) -> list[dict]:
    if not source_width or not source_height:
        return _SOCIAL_FORMATS

    src_ar = source_width / source_height
    result = []
    for fmt in _SOCIAL_FORMATS:
        tw, th = fmt["width"], fmt["height"]
        tgt_ar = tw / th
        diff   = abs(src_ar - tgt_ar)

        if diff < 0.02:
            method   = "scale only"
            crop_pct = 0
        elif src_ar > tgt_ar:
            visible_w = int(source_height * tgt_ar)
            crop_pct  = round(100.0 * (1 - visible_w / source_width), 1)
            method    = f"crop {crop_pct}% width"
        else:
            visible_h = int(source_width / tgt_ar)
            crop_pct  = round(100.0 * (1 - visible_h / source_height), 1)
            method    = f"crop {crop_pct}% height"

        result.append({
            **fmt,
            "method":    method,
            "crop_pct":  crop_pct,
            "ffmpeg_vf": f"scale={tw}:{th}:force_original_aspect_ratio=increase,crop={tw}:{th}",
        })
    return result


# ── Export Recommendations ─────────────────────────────────────────────────────

def get_export_recommendations(analysis: dict, project: dict) -> list[dict]:
    width    = project.get("width",  1920)
    height   = project.get("height", 1080)
    duration = analysis.get("duration_s", 0)
    counts   = analysis.get("clip_counts", {})
    recs: list[dict] = []

    if height > width:
        recs.append({
            "preset_id": "instagram-reel",
            "reason":    "Vertical format — perfect for Instagram Reels and TikTok",
            "priority":  "primary",
        })
    elif width >= 3840:
        recs.append({
            "preset_id": "youtube-4k",
            "reason":    "4K source — preserve resolution for YouTube 4K",
            "priority":  "primary",
        })
    else:
        recs.append({
            "preset_id": "youtube-1080p",
            "reason":    "Landscape format — optimized for YouTube and web",
            "priority":  "primary",
        })

    recs.append({
        "preset_id": "web-mp4",
        "reason":    "Universal H.264 MP4 — plays everywhere",
        "priority":  "secondary",
    })

    if (counts.get("subtitle", 0) + counts.get("overlay", 0)) > 0:
        recs.append({
            "preset_id": "high-quality-mp4",
            "reason":    "Has text overlays — higher bitrate keeps text sharp",
            "priority":  "secondary",
        })

    if 0 < duration < 90:
        recs.append({
            "preset_id": "social-720p",
            "reason":    f"Short video ({duration:.0f}s) — smaller file for social sharing",
            "priority":  "info",
        })

    return recs


# ── Internal helpers ───────────────────────────────────────────────────────────

async def _get_duration(media_path: Path) -> float:
    ffprobe = str(config.FFPROBE_PATH) if config.FFPROBE_PATH.exists() else "ffprobe"
    cmd = [
        ffprobe, "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        str(media_path),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        return float(stdout.decode().strip())
    except Exception:
        return 0.0


async def _get_audio_energy(media_path: Path, n_buckets: int = 300) -> list[float]:
    try:
        from engines.waveform_engine import get_peaks
        return await get_peaks(media_path, n_buckets)
    except Exception:
        return []
