"""FFmpeg render engine — builds filter_complex and renders timeline to MP4."""
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Coroutine

import config

log = logging.getLogger("avsp.render")

# Map of export_id → running subprocess (max 1 at a time)
_active: dict[str, asyncio.subprocess.Process] = {}


def is_busy() -> bool:
    return bool(_active)


def cancel(export_id: str) -> bool:
    p = _active.get(export_id)
    if p:
        try:
            p.kill()
        except Exception:
            pass
        return True
    return False


_XFADE_TYPES: dict[str, str] = {
    "fade":       "fade",
    "dissolve":   "dissolve",
    "slideLeft":  "slideleft",
    "slideRight": "slideright",
    "zoom":       "zoomin",
    "wipeLeft":   "wipeleft",
    "wipeRight":  "wiperight",
    "fadeBlack":  "fadeblack",
    "circleOpen": "circleopen",
}


def _effects_to_vf(effects: list[dict]) -> str:
    """Convert ClipEffect[] to an FFmpeg video filter chain string (comma-separated)."""
    # Sort: presets first, then adjustments, then spatial effects, then LUT
    ORDER = {
        "warm": 0, "cool": 0, "cinematic": 0, "vintage": 0,
        "vivid": 0, "faded": 0, "drama": 0, "bw": 0,
        "brightness": 1, "contrast": 1, "saturation": 1, "sharpness": 2,
        "blur": 2, "vignette": 2, "lut3d": 3,
    }
    sorted_effects = sorted(effects, key=lambda e: ORDER.get(e.get("type", ""), 1))

    parts: list[str] = []
    for e in sorted_effects:
        t = e.get("type", "")
        p = e.get("params") or {}

        if t == "brightness":
            v = float(p.get("value", 0))
            parts.append(f"eq=brightness={v:.3f}")
        elif t == "contrast":
            v = float(p.get("value", 1.0))
            parts.append(f"eq=contrast={v:.3f}")
        elif t == "saturation":
            v = float(p.get("value", 1.0))
            parts.append(f"eq=saturation={v:.3f}")
        elif t == "sharpness":
            v = float(p.get("value", 1.0))
            parts.append(f"unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount={v:.2f}")
        elif t == "blur":
            sigma = float(p.get("sigma", 2.0))
            parts.append(f"gblur=sigma={sigma:.2f}")
        elif t == "vignette":
            angle = float(p.get("angle", 1.0))
            parts.append(f"vignette=a={angle:.2f}")
        elif t == "bw":
            parts.append("hue=s=0")
        elif t == "warm":
            parts.append("curves=r='0/0 0.5/0.58 1/1':g='0/0 0.5/0.52 1/1':b='0/0 0.5/0.43 1/0.92'")
        elif t == "cool":
            parts.append("curves=r='0/0 0.5/0.43 1/0.9':g='0/0 0.5/0.50 1/0.95':b='0/0 0.5/0.58 1/1'")
        elif t == "cinematic":
            parts.append(
                "curves=r='0/0.04 1/0.92':g='0/0.02 1/0.88':b='0/0.06 1/0.94',"
                "eq=saturation=0.85:contrast=1.08"
            )
        elif t == "vintage":
            parts.append(
                "curves=r='0/0.1 0.8/0.9 1/1':g='0/0.05 1/0.85':b='0/0.15 1/0.75',"
                "eq=saturation=0.72:contrast=0.88"
            )
        elif t == "vivid":
            parts.append("eq=saturation=1.85:contrast=1.12")
        elif t == "faded":
            parts.append("eq=brightness=0.06:contrast=0.88:saturation=0.68")
        elif t == "drama":
            parts.append(
                "curves=r='0/0 0.4/0.5 1/1':g='0/0 0.45/0.5 1/1':b='0/0 0.45/0.4 1/1',"
                "eq=contrast=1.2:saturation=0.9"
            )
        elif t == "lut3d":
            path = str(p.get("path", ""))
            if path:
                safe = path.replace("\\", "/").replace("'", "\\'")
                parts.append(f"lut3d='{safe}'")

    return ",".join(parts)


def _escape_drawtext(text: str) -> str:
    """Escape special characters for FFmpeg drawtext text= option."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'",  "\\'")
    text = text.replace(":",  "\\:")
    text = text.replace("%",  "\\%")
    text = text.replace("\n", "\\n")
    return text


def _atempo_chain(speed: float) -> list[str]:
    """Chain atempo filters to handle speeds outside the 0.5–2.0 per-filter range."""
    parts: list[str] = []
    s = speed
    while s > 2.0:
        parts.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        parts.append("atempo=0.5")
        s /= 0.5
    parts.append(f"atempo={s:.5f}")
    return parts


def _build_cmd(
    tracks: list[dict],
    media_map: dict[str, dict],
    preset: dict,
    output_path: Path,
    crf_override: int | None,
) -> tuple[list[str], float]:
    """
    Build the FFmpeg command for the given timeline state.
    Returns (cmd_list, total_duration_s).
    Raises ValueError if the timeline has no renderable video clips.
    """
    w         = int(preset.get("width", 1920))
    h         = int(preset.get("height", 1080))
    fps       = float(preset.get("fps", 30))
    vcodec    = preset.get("video_codec", "libx264")
    acodec    = preset.get("audio_codec", "aac")
    crf       = crf_override if crf_override is not None else int(preset.get("crf", 18))
    pspeed    = preset.get("preset_speed", "fast")
    abitrate  = preset.get("audio_bitrate", "192k")

    # Collect video track clips sorted by timeline position
    clips: list[dict] = []
    for track in tracks:
        if track.get("type") == "video":
            clips.extend(sorted(track.get("clips", []), key=lambda c: float(c["start_s"])))

    if not clips:
        raise ValueError("No video clips in timeline — nothing to render")

    inputs:       list[str] = []
    filter_parts: list[str] = []
    input_idx  = 0
    clip_labels:      list[tuple[str, str]] = []  # (video_label, audio_label)
    clip_durations:   list[float] = []
    renderable_clips: list[dict]  = []

    for ci, clip in enumerate(clips):
        media = media_map.get(clip.get("media_id", ""))
        if not media:
            log.warning("Clip %s references unknown media %s — skipping", ci, clip.get("media_id"))
            continue

        timeline_dur   = float(clip["end_s"]) - float(clip["start_s"])
        speed          = float(clip.get("speed", 1.0)) or 1.0
        volume         = float(clip.get("volume", 1.0))
        src_start      = float(clip.get("source_start_s", 0.0))
        src_dur        = timeline_dur * speed
        is_image       = media.get("type") == "image"
        mute_audio     = bool(clip.get("mute_audio", False))
        has_audio      = bool(media.get("has_audio", 1)) and not is_image and not mute_audio
        fade_in_s      = float(clip.get("fade_in_s",  0.0))
        fade_out_s     = float(clip.get("fade_out_s", 0.0))
        noise_red      = float(clip.get("noise_reduction", 0.0))

        # ── Input ────────────────────────────────────────────────────────────
        vi = input_idx
        if is_image:
            inputs += ["-loop", "1", "-t", f"{timeline_dur:.6f}", "-i", media["path"]]
        else:
            inputs += ["-ss", f"{src_start:.6f}", "-t", f"{src_dur:.6f}", "-i", media["path"]]
        input_idx += 1

        # ── Video filter chain ────────────────────────────────────────────────
        if speed != 1.0 and not is_image:
            pts = f"setpts={1.0 / speed:.5f}*PTS"
        else:
            pts = "setpts=PTS-STARTPTS"
        vf = (
            f"{pts},"
            f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,"
            f"fps={fps},format=yuv420p"
        )
        # Video fade
        if fade_in_s > 0:
            vf += f",fade=in:st=0:d={fade_in_s:.3f}"
        if fade_out_s > 0 and timeline_dur > fade_out_s:
            vf += f",fade=out:st={timeline_dur - fade_out_s:.3f}:d={fade_out_s:.3f}"
        # Per-clip color/spatial effects
        effects_vf = _effects_to_vf(clip.get("effects") or [])
        if effects_vf:
            vf += f",{effects_vf}"
        filter_parts.append(f"[{vi}:v]{vf}[v{ci}]")

        # ── Audio filter chain ────────────────────────────────────────────────
        if has_audio:
            af = "asetpts=PTS-STARTPTS"
            if volume != 1.0:
                af += f",volume={volume:.4f}"
            if speed != 1.0:
                af += "," + ",".join(_atempo_chain(speed))
            if noise_red > 0:
                strength = max(0.00001, min(0.1, noise_red * 0.1))
                af += f",anlmdn=s={strength:.5f}"
            if fade_in_s > 0:
                af += f",afade=in:st=0:d={fade_in_s:.3f}"
            if fade_out_s > 0 and timeline_dur > fade_out_s:
                af += f",afade=out:st={timeline_dur - fade_out_s:.3f}:d={fade_out_s:.3f}"
            filter_parts.append(f"[{vi}:a]{af}[a{ci}]")
        else:
            ai = input_idx
            inputs += ["-f", "lavfi", "-i",
                       "anullsrc=channel_layout=stereo:sample_rate=44100"]
            input_idx += 1
            filter_parts.append(
                f"[{ai}:a]atrim=duration={timeline_dur:.6f},asetpts=PTS-STARTPTS[a{ci}]"
            )

        clip_labels.append((f"v{ci}", f"a{ci}"))
        clip_durations.append(timeline_dur)
        renderable_clips.append(clip)

    if not clip_labels:
        raise ValueError("No renderable clips found (all media missing?)")

    n = len(clip_labels)
    trans_data: list[dict | None] = [
        renderable_clips[j + 1].get("transition")
        for j in range(n - 1)
    ]
    has_transitions = any(
        t and t.get("type") and t.get("type") != "none"
        for t in trans_data
    )

    if n == 1:
        map_v = f"[{clip_labels[0][0]}]"
        map_a = f"[{clip_labels[0][1]}]"
    elif has_transitions:
        accum  = 0.0
        prev_v = clip_labels[0][0]
        prev_a = clip_labels[0][1]
        for j in range(n - 1):
            cur_v  = clip_labels[j + 1][0]
            cur_a  = clip_labels[j + 1][1]
            trans  = trans_data[j]
            t_type = _XFADE_TYPES.get(trans.get("type", "fade"), "fade") if trans else "fade"
            t_dur  = float(trans.get("duration_s", 0.5)) if trans else 0.5
            t_dur  = max(0.1, min(t_dur, clip_durations[j], clip_durations[j + 1]))
            offset = max(0.0, accum + clip_durations[j] - t_dur)
            out_v  = f"xfv{j}"
            out_a  = f"xfa{j}"
            filter_parts.append(
                f"[{prev_v}][{cur_v}]xfade=transition={t_type}:duration={t_dur:.3f}:offset={offset:.3f}[{out_v}]"
            )
            filter_parts.append(
                f"[{prev_a}][{cur_a}]acrossfade=d={t_dur:.3f}[{out_a}]"
            )
            prev_v = out_v
            prev_a = out_a
            accum += clip_durations[j] - t_dur
        map_v = f"[{prev_v}]"
        map_a = f"[{prev_a}]"
    else:
        concat_in = "".join(f"[{v}][{a}]" for v, a in clip_labels)
        filter_parts.append(f"{concat_in}concat=n={n}:v=1:a=1[outv][outa]")
        map_v, map_a = "[outv]", "[outa]"

    # ── Audio-only track clips (background music, SFX) ────────────────────────
    # Collect clips from non-video, non-subtitle tracks and mix them with main audio.
    audio_mix_labels: list[str] = []
    aci = 0  # audio-only clip index
    for track in tracks:
        if track.get("type") not in ("audio",):
            continue
        if track.get("muted", False):
            continue
        for clip in sorted(track.get("clips", []), key=lambda c: float(c.get("start_s", 0))):
            media = media_map.get(clip.get("media_id", ""))
            if not media:
                continue
            if media.get("type") == "image":
                continue

            timeline_start = float(clip.get("start_s", 0))
            timeline_dur   = float(clip["end_s"]) - float(clip["start_s"])
            src_start      = float(clip.get("source_start_s", 0.0))
            speed          = float(clip.get("speed", 1.0)) or 1.0
            volume         = float(clip.get("volume", 1.0))
            src_dur        = timeline_dur * speed
            fade_in_s      = float(clip.get("fade_in_s",  0.0))
            fade_out_s     = float(clip.get("fade_out_s", 0.0))
            noise_red      = float(clip.get("noise_reduction", 0.0))
            delay_ms       = int(timeline_start * 1000)

            vi = input_idx
            inputs += ["-ss", f"{src_start:.6f}", "-t", f"{src_dur:.6f}", "-i", media["path"]]
            input_idx += 1

            af = "asetpts=PTS-STARTPTS"
            if volume != 1.0:
                af += f",volume={volume:.4f}"
            if speed != 1.0:
                af += "," + ",".join(_atempo_chain(speed))
            if noise_red > 0:
                strength = max(0.00001, min(0.1, noise_red * 0.1))
                af += f",anlmdn=s={strength:.5f}"
            if fade_in_s > 0:
                af += f",afade=in:st=0:d={fade_in_s:.3f}"
            if fade_out_s > 0 and timeline_dur > fade_out_s:
                af += f",afade=out:st={timeline_dur - fade_out_s:.3f}:d={fade_out_s:.3f}"
            if delay_ms > 0:
                af += f",adelay={delay_ms}:all=1"

            lbl = f"mus{aci}"
            filter_parts.append(f"[{vi}:a]{af}[{lbl}]")
            audio_mix_labels.append(lbl)
            aci += 1

    if audio_mix_labels:
        main_a_lbl = map_a.strip("[]")
        mix_inputs = f"[{main_a_lbl}]" + "".join(f"[{l}]" for l in audio_mix_labels)
        n_mix      = 1 + len(audio_mix_labels)
        filter_parts.append(
            f"{mix_inputs}amix=inputs={n_mix}:duration=first:dropout_transition=0[mixed_a]"
        )
        map_a = "[mixed_a]"

    # ── drawtext overlays for text/subtitle clips ─────────────────────────────
    if config.FONT_PATH:
        text_clips: list[dict] = []
        for track in tracks:
            if track.get("type") in ("subtitle", "text", "overlay"):
                for clip in sorted(track.get("clips", []), key=lambda c: float(c.get("start_s", 0))):
                    if clip.get("text_content"):
                        text_clips.append(clip)

        if text_clips:
            font_path_str = str(config.FONT_PATH).replace("\\", "/")
            prev = map_v.strip("[]")

            for ti, tc in enumerate(text_clips):
                style   = tc.get("text_style") or {}
                text    = _escape_drawtext(str(tc.get("text_content", "")))
                start_t = float(tc.get("start_s", 0))
                end_t   = float(tc.get("end_s", 0))
                size    = int(style.get("size", 36))
                color   = str(style.get("color", "#ffffff")).lstrip("#") or "ffffff"
                x_pct   = float(style.get("x_pct", 50))
                y_pct   = float(style.get("y_pct", 85))
                shadow  = bool(style.get("shadow", True))
                bg_hex  = str(style.get("bg_color", "") or "")
                stroke_w = int(style.get("stroke_width", 0))
                stroke_c = str(style.get("stroke_color", "#000000")).lstrip("#") or "000000"

                x_expr = "(w-text_w)/2" if abs(x_pct - 50) < 1 else f"w*{x_pct/100:.4f}-text_w/2"
                y_expr = f"h*{y_pct/100:.4f}-text_h/2"
                next_lbl = f"txtv{ti}"

                dt = (
                    f"drawtext="
                    f"text='{text}'"
                    f":fontfile='{font_path_str}'"
                    f":fontsize={size}"
                    f":fontcolor=0x{color}"
                    f":x={x_expr}"
                    f":y={y_expr}"
                    f":enable='between(t,{start_t:.3f},{end_t:.3f})'"
                )
                if shadow:
                    dt += ":shadowx=2:shadowy=2:shadowcolor=0x000000@0.80"
                if stroke_w > 0:
                    dt += f":borderw={stroke_w}:bordercolor=0x{stroke_c}"
                if bg_hex:
                    alpha = bg_hex[7:9] if len(bg_hex) == 9 else "cc"
                    box_color = bg_hex[1:7] if bg_hex.startswith("#") else bg_hex[:6]
                    try:
                        alpha_f = int(alpha, 16) / 255.0
                    except ValueError:
                        alpha_f = 0.8
                    dt += f":box=1:boxcolor=0x{box_color}@{alpha_f:.2f}:boxborderw=6"

                filter_parts.append(f"[{prev}]{dt}[{next_lbl}]")
                prev = next_lbl

            map_v = f"[{prev}]"

    filter_complex = ";".join(filter_parts)
    if has_transitions:
        xfade_overlap = sum(
            float(t.get("duration_s", 0.5))
            for t in trans_data
            if t and t.get("type") and t.get("type") != "none"
        )
        total_dur = sum(clip_durations) - xfade_overlap
    else:
        total_dur = sum(float(c["end_s"]) - float(c["start_s"]) for c in clips)

    ffmpeg_bin = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"

    cmd = (
        [ffmpeg_bin]
        + inputs
        + [
            "-filter_complex", filter_complex,
            "-map", map_v,
            "-map", map_a,
            "-c:v", vcodec,
            "-crf", str(crf),
            "-preset", pspeed,
            "-c:a", acodec,
            "-b:a", abitrate,
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            "-loglevel", "warning",
            "-y",
            str(output_path),
        ]
    )

    return cmd, total_dur


async def render(
    export_id: str,
    tracks: list[dict],
    media_map: dict[str, dict],
    preset: dict,
    output_path: Path,
    crf_override: int | None,
    update_cb: Callable[..., Coroutine[Any, Any, None]],
) -> None:
    """
    Render the timeline to output_path.
    update_cb(status, progress, error) is awaited on status changes.
    Progress values are 0–100; status is 'running' | 'done' | 'failed'.
    """
    from api.ws import broadcast

    log_path = config.LOGS_DIR / f"export-{export_id}.log"

    try:
        cmd, total_dur = _build_cmd(tracks, media_map, preset, output_path, crf_override)
    except ValueError as exc:
        log.error("Render %s build error: %s", export_id, exc)
        await update_cb("failed", 0.0, str(exc))
        return

    # Write command to log for debugging
    with log_path.open("w", encoding="utf-8") as lf:
        lf.write(f"# Export {export_id}\n")
        lf.write(f"# {datetime.now(timezone.utc).isoformat()}\n")
        lf.write("# FFmpeg command:\n")
        lf.write("  " + " ".join(f'"{a}"' if " " in a else a for a in cmd) + "\n\n")

    log.info("Render %s starting → %s", export_id, output_path.name)

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except Exception as exc:
        log.error("Render %s failed to start: %s", export_id, exc)
        await update_cb("failed", 0.0, f"FFmpeg launch failed: {exc}")
        return

    _active[export_id] = process
    stderr_chunks: list[bytes] = []

    async def _drain_stderr() -> None:
        assert process.stderr
        async for chunk in process.stderr:
            stderr_chunks.append(chunk)

    async def _read_progress() -> None:
        assert process.stdout
        async for raw in process.stdout:
            line = raw.decode(errors="replace").strip()
            # FFmpeg -progress pipe:1 outputs "out_time_ms=<microseconds>" lines
            if line.startswith("out_time_ms="):
                try:
                    us = int(line.split("=", 1)[1])
                    if total_dur > 0:
                        pct = min(99.0, (us / 1_000_000.0) / total_dur * 100.0)
                        await update_cb("running", pct, None)
                        await broadcast({
                            "type": "job_update",
                            "job": {
                                "id": export_id,
                                "type": "export",
                                "status": "running",
                                "progress": round(pct, 1),
                            },
                        })
                except (ValueError, ZeroDivisionError):
                    pass

    try:
        await asyncio.gather(_read_progress(), _drain_stderr())
        await process.wait()
    except asyncio.CancelledError:
        process.kill()
        _active.pop(export_id, None)
        raise
    finally:
        _active.pop(export_id, None)

    # Append any stderr output to the log
    stderr_text = b"".join(stderr_chunks).decode(errors="replace")
    if stderr_text.strip():
        with log_path.open("a", encoding="utf-8") as lf:
            lf.write("\n# FFmpeg stderr:\n" + stderr_text)

    rc = process.returncode
    if rc == 0 and output_path.exists() and output_path.stat().st_size > 0:
        log.info("Render %s done → %s (%.1f MB)", export_id, output_path.name,
                 output_path.stat().st_size / 1_048_576)
        await update_cb("done", 100.0, None)
        await broadcast({
            "type": "job_update",
            "job": {
                "id": export_id,
                "type": "export",
                "status": "done",
                "progress": 100,
                "result": str(output_path),
            },
        })
    else:
        err = f"FFmpeg exited {rc}" + (
            f": {stderr_text[:400].strip()}" if stderr_text.strip() else ""
        )
        log.error("Render %s failed: %s", export_id, err)
        await update_cb("failed", 0.0, err)
        await broadcast({
            "type": "job_update",
            "job": {
                "id": export_id,
                "type": "export",
                "status": "failed",
                "error": err,
            },
        })
