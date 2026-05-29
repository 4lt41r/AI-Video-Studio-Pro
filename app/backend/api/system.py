"""System utilities: restart, file pickers, storage info, logs, deps, crash recovery."""
import asyncio
import os
import sys
import shutil
import subprocess
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import config

_CRASH_SENTINEL = config.TEMP_DIR / ".crash_sentinel"

router = APIRouter()


@router.get("/crash-state", summary="Check if last session crashed")
async def crash_state():
    crashed = _CRASH_SENTINEL.exists()
    last_project = None
    if crashed:
        try:
            import json
            data = json.loads(_CRASH_SENTINEL.read_text(encoding="utf-8"))
            last_project = data.get("last_project_id")
        except Exception:
            pass
    return {"crashed": crashed, "last_project_id": last_project}


@router.post("/crash-state/clear", summary="Clear crash state")
async def clear_crash_state():
    try:
        _CRASH_SENTINEL.unlink(missing_ok=True)
    except Exception:
        pass
    return {"cleared": True}


@router.get("/info", summary="System info")
async def system_info():
    ffmpeg_ok = config.FFMPEG_PATH.exists()
    db_ok     = config.DATABASE_PATH.exists()
    exports_size = sum(
        f.stat().st_size for f in config.EXPORTS_DIR.rglob("*") if f.is_file()
    ) if config.EXPORTS_DIR.exists() else 0
    cache_size = sum(
        f.stat().st_size for f in config.CACHE_DIR.rglob("*") if f.is_file()
    ) if config.CACHE_DIR.exists() else 0

    disk = shutil.disk_usage(config.ROOT)

    # Memory usage — psutil preferred, fallback to None
    memory_mb = None
    memory_pct = None
    try:
        import psutil
        proc = psutil.Process()
        mem  = proc.memory_info()
        memory_mb  = round(mem.rss / 1024 ** 2, 1)
        vm = psutil.virtual_memory()
        memory_pct = round(vm.percent, 1)
    except Exception:
        pass

    return {
        "root":             str(config.ROOT),
        "version":          config.APP_VERSION,
        "phase":            config.APP_PHASE,
        "ffmpeg_available": ffmpeg_ok,
        "ffmpeg_path":      str(config.FFMPEG_PATH),
        "database_ok":      db_ok,
        "exports_size_mb":  round(exports_size / 1024 ** 2, 1),
        "cache_size_mb":    round(cache_size   / 1024 ** 2, 1),
        "disk_free_gb":     round(disk.free    / 1024 ** 3, 1),
        "disk_total_gb":    round(disk.total   / 1024 ** 3, 1),
        "memory_mb":        memory_mb,
        "memory_pct":       memory_pct,
    }


@router.post("/restart", summary="Restart backend process")
async def restart_backend():
    async def _exec():
        await asyncio.sleep(0.35)
        argv0 = os.path.abspath(sys.argv[0]) if sys.argv else __file__
        os.execv(sys.executable, [sys.executable, argv0] + sys.argv[1:])
    asyncio.create_task(_exec())
    return {"status": "restarting", "message": "Backend restarting in ~400ms"}


# ── Log file browser ──────────────────────────────────────────────────────────

@router.get("/logs", summary="List log files")
async def list_logs():
    logs = []
    if config.LOGS_DIR.exists():
        for f in sorted(
            (x for x in config.LOGS_DIR.iterdir() if x.is_file()),
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        ):
            if f.suffix in (".md", ".log", ".txt"):
                st = f.stat()
                logs.append({
                    "name":        f.name,
                    "size_bytes":  st.st_size,
                    "modified_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
                })
    return {"logs": logs}


@router.get("/logs/{filename}", summary="Read a log file (last N lines)")
async def read_log(filename: str, lines: int = 300):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    log_file = config.LOGS_DIR / filename
    if not log_file.exists() or not log_file.is_file():
        raise HTTPException(404, f"Log file '{filename}' not found")
    try:
        text = log_file.read_text(encoding="utf-8", errors="replace")
        all_lines = text.splitlines()
        tail = all_lines[-lines:] if len(all_lines) > lines else all_lines
        return {
            "filename":    filename,
            "content":     "\n".join(tail),
            "total_lines": len(all_lines),
            "shown_lines": len(tail),
        }
    except Exception as exc:
        raise HTTPException(500, str(exc))


# ── Dependency health check ───────────────────────────────────────────────────

@router.get("/deps", summary="Check all dependencies")
async def check_deps():
    deps = []

    # FFmpeg
    ffmpeg_ok  = config.FFMPEG_PATH.exists()
    ffmpeg_ver = None
    if ffmpeg_ok:
        try:
            r = subprocess.run(
                [str(config.FFMPEG_PATH), "-version"],
                capture_output=True, text=True, timeout=5,
            )
            line = r.stdout.split("\n")[0]
            ffmpeg_ver = line.split("version ")[1].split(" ")[0] if "version " in line else "installed"
        except Exception:
            ffmpeg_ver = "installed"
    deps.append({
        "name": "FFmpeg", "key": "ffmpeg",
        "status": "ok" if ffmpeg_ok else "missing",
        "version": ffmpeg_ver,
        "required": True,
        "note": "Core render engine — required for all video processing",
    })

    # Python
    deps.append({
        "name": "Python", "key": "python",
        "status": "ok",
        "version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "required": True,
        "note": "Backend runtime",
    })

    # FastAPI
    try:
        import fastapi
        deps.append({"name": "FastAPI", "key": "fastapi", "status": "ok",
                     "version": fastapi.__version__, "required": True,
                     "note": "HTTP API framework"})
    except ImportError:
        deps.append({"name": "FastAPI", "key": "fastapi", "status": "missing",
                     "version": None, "required": True, "note": "HTTP API framework"})

    # aiosqlite
    try:
        import aiosqlite
        deps.append({"name": "aiosqlite", "key": "aiosqlite", "status": "ok",
                     "version": aiosqlite.__version__, "required": True,
                     "note": "Async SQLite driver"})
    except ImportError:
        deps.append({"name": "aiosqlite", "key": "aiosqlite", "status": "missing",
                     "version": None, "required": True, "note": "Async SQLite driver"})

    # numpy
    try:
        import numpy as np
        deps.append({"name": "numpy", "key": "numpy", "status": "ok",
                     "version": np.__version__, "required": True,
                     "note": "Required for beat detection and audio analysis"})
    except ImportError:
        deps.append({"name": "numpy", "key": "numpy", "status": "missing",
                     "version": None, "required": True,
                     "note": "Required for beat detection and audio analysis"})

    # faster-whisper
    try:
        import faster_whisper as fw
        deps.append({"name": "faster-whisper", "key": "faster_whisper", "status": "ok",
                     "version": getattr(fw, "__version__", "installed"), "required": False,
                     "note": "Optional — required for AI auto-captions"})
    except ImportError:
        deps.append({"name": "faster-whisper", "key": "faster_whisper", "status": "missing",
                     "version": None, "required": False,
                     "note": "Optional — required for AI auto-captions"})

    # Whisper models on disk
    model_dir = config.MODELS_DIR / "whisper"
    whisper_models = []
    if model_dir.exists():
        for d in sorted(model_dir.iterdir()):
            if d.is_dir() and (d / "model.bin").exists():
                size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
                whisper_models.append({
                    "name":    d.name,
                    "size_mb": round(size / 1024 ** 2),
                })

    # Storage breakdown
    disk = shutil.disk_usage(config.ROOT)

    def _dir_mb(p):
        if not p.exists():
            return 0.0
        return round(sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) / 1024 ** 2, 1)

    storage = {
        "disk_total_gb":  round(disk.total / 1024 ** 3, 1),
        "disk_free_gb":   round(disk.free  / 1024 ** 3, 1),
        "disk_used_gb":   round(disk.used  / 1024 ** 3, 1),
        "projects_mb":    _dir_mb(config.PROJECTS_DIR),
        "exports_mb":     _dir_mb(config.EXPORTS_DIR),
        "cache_mb":       _dir_mb(config.CACHE_DIR),
        "models_mb":      _dir_mb(config.MODELS_DIR),
        "temp_mb":        _dir_mb(config.TEMP_DIR),
    }

    return {
        "deps":           deps,
        "whisper_models": whisper_models,
        "storage":        storage,
    }


# ── File pickers ──────────────────────────────────────────────────────────────

_VIDEO_FILTER = "Video Files|*.mp4;*.mov;*.avi;*.mkv;*.webm;*.m4v;*.wmv;*.flv;*.ts;*.mts|All Files|*.*"


@router.get("/pick-file", summary="Native file picker")
async def pick_file(multiple: bool = False):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _pick_file_sync, multiple)


@router.get("/pick-folder", summary="Native folder picker")
async def pick_folder():
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _pick_folder_sync)


def _pick_file_sync(multiple: bool) -> dict:
    if multiple:
        script = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$f = New-Object System.Windows.Forms.OpenFileDialog; "
            f"$f.Filter = '{_VIDEO_FILTER}'; "
            "$f.Multiselect = $true; "
            "if ($f.ShowDialog() -eq 'OK') { $f.FileNames -join '|' } else { '' }"
        )
    else:
        script = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$f = New-Object System.Windows.Forms.OpenFileDialog; "
            f"$f.Filter = '{_VIDEO_FILTER}'; "
            "if ($f.ShowDialog() -eq 'OK') { $f.FileName } else { '' }"
        )
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script],
            capture_output=True, text=True, timeout=120,
        )
        output = r.stdout.strip()
        if not output:
            return {"paths": [], "cancelled": True} if multiple else {"path": "", "cancelled": True}
        if multiple:
            paths = [p for p in output.split("|") if p]
            return {"paths": paths, "cancelled": len(paths) == 0}
        return {"path": output, "cancelled": False}
    except Exception as exc:
        return {"error": str(exc), "path": "", "cancelled": True}


def _pick_folder_sync() -> dict:
    script = (
        "Add-Type -AssemblyName System.Windows.Forms; "
        "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
        "if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }"
    )
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script],
            capture_output=True, text=True, timeout=120,
        )
        output = r.stdout.strip()
        return {"path": output, "cancelled": not bool(output)}
    except Exception as exc:
        return {"error": str(exc), "path": "", "cancelled": True}
