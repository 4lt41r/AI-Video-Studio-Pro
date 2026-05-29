"""faster-whisper local transcription engine."""
import asyncio
import logging
from pathlib import Path

import config

log = logging.getLogger("avsp.whisper")

SUPPORTED_MODELS = ["tiny", "base", "small", "medium"]
MODEL_SIZES_MB    = {"tiny": 75, "base": 145, "small": 465, "medium": 1530}


def is_available() -> bool:
    """Return True if faster-whisper is importable."""
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def _whisper_cache_dir() -> Path:
    d = config.MODELS_DIR / "whisper"
    d.mkdir(parents=True, exist_ok=True)
    return d


def is_downloaded(name: str) -> bool:
    """Return True if the model has been downloaded into models/whisper/."""
    d = _whisper_cache_dir() / name
    # faster-whisper stores config.json + model.bin in the named subfolder
    return d.exists() and (d / "model.bin").exists()


async def extract_audio(input_path: Path, output_path: Path) -> None:
    """Extract 16 kHz mono WAV from any media file using FFmpeg."""
    ffmpeg = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"
    cmd = [
        ffmpeg, "-y",
        "-i",  str(input_path),
        "-ar", "16000",
        "-ac", "1",
        "-f",  "wav",
        str(output_path),
        "-loglevel", "warning",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            "FFmpeg audio extraction failed: "
            + stderr_bytes.decode(errors="replace")[:400]
        )


def _transcribe_sync(
    model_name: str,
    audio_path: Path,
    language: str | None,
) -> list[dict]:
    """Synchronous transcription — intended to run in a thread pool executor."""
    from faster_whisper import WhisperModel  # type: ignore

    cache_dir = str(_whisper_cache_dir())
    log.info("Loading Whisper model '%s' (cache: %s)", model_name, cache_dir)

    model = WhisperModel(
        model_name,
        device="cpu",
        compute_type="int8",
        download_root=cache_dir,
    )

    segments_iter, _info = model.transcribe(
        str(audio_path),
        language=language or None,
        word_timestamps=False,
        beam_size=5,
        best_of=5,
    )

    result: list[dict] = []
    for seg in segments_iter:
        text = seg.text.strip()
        if text:
            result.append({
                "start": round(seg.start, 3),
                "end":   round(seg.end, 3),
                "text":  text,
            })

    log.info("Transcription complete — %d segments", len(result))
    return result


async def transcribe(
    model_name: str,
    audio_path: Path,
    language: str | None = None,
) -> list[dict]:
    """Run faster-whisper in the default thread pool; return [{start, end, text}]."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        _transcribe_sync,
        model_name,
        audio_path,
        language,
    )
