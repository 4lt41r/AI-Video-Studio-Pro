"""Cache and temp folder management — stats, size enforcement, cleanup."""
import logging
import shutil
from pathlib import Path

import config

log = logging.getLogger("avsp.cache")


def _scan_dir(directory: Path) -> dict:
    """Return {size_bytes, file_count, files: [(path, mtime, size)]} for a directory."""
    if not directory.exists():
        return {"size_bytes": 0, "file_count": 0, "files": []}
    files = []
    for f in directory.rglob("*"):
        if f.is_file():
            try:
                st = f.stat()
                files.append((f, st.st_mtime, st.st_size))
            except OSError:
                pass
    total = sum(s for _, _, s in files)
    return {"size_bytes": total, "file_count": len(files), "files": files}


def get_cache_stats() -> dict:
    """Return size/count breakdown by category."""
    cats = {
        "thumbnails": config.PROJECTS_DIR,   # scanned selectively below
        "proxies":    None,
        "exports":    config.EXPORTS_DIR,
        "temp":       config.TEMP_DIR,
        "cache":      config.CACHE_DIR,
    }

    # Thumbnails — gather across all project subdirs
    thumb_bytes = 0
    thumb_count = 0
    proxy_bytes = 0
    proxy_count = 0
    if config.PROJECTS_DIR.exists():
        for proj_dir in config.PROJECTS_DIR.iterdir():
            if not proj_dir.is_dir():
                continue
            t_dir = proj_dir / "thumbnails"
            if t_dir.exists():
                info = _scan_dir(t_dir)
                thumb_bytes += info["size_bytes"]
                thumb_count += info["file_count"]
            p_dir = proj_dir / "proxies"
            if p_dir.exists():
                info = _scan_dir(p_dir)
                proxy_bytes += info["size_bytes"]
                proxy_count += info["file_count"]

    exports_info = _scan_dir(config.EXPORTS_DIR)
    temp_info    = _scan_dir(config.TEMP_DIR)
    cache_info   = _scan_dir(config.CACHE_DIR)

    def mb(b): return round(b / 1024 ** 2, 1)

    return {
        "thumbnails": {"size_mb": mb(thumb_bytes),          "file_count": thumb_count},
        "proxies":    {"size_mb": mb(proxy_bytes),          "file_count": proxy_count},
        "exports":    {"size_mb": mb(exports_info["size_bytes"]), "file_count": exports_info["file_count"]},
        "temp":       {"size_mb": mb(temp_info["size_bytes"]),    "file_count": temp_info["file_count"]},
        "cache":      {"size_mb": mb(cache_info["size_bytes"]),   "file_count": cache_info["file_count"]},
        "total_mb":   mb(thumb_bytes + proxy_bytes + exports_info["size_bytes"]
                         + temp_info["size_bytes"] + cache_info["size_bytes"]),
    }


def cleanup_temp(max_age_hours: float = 0) -> dict:
    """
    Delete files in TEMP_DIR.
    If max_age_hours > 0, only delete files older than that many hours.
    Returns {deleted_files, freed_bytes}.
    """
    import time
    deleted = 0
    freed   = 0
    cutoff  = time.time() - max_age_hours * 3600 if max_age_hours > 0 else None

    if not config.TEMP_DIR.exists():
        return {"deleted_files": 0, "freed_bytes": 0}

    for f in config.TEMP_DIR.rglob("*"):
        if not f.is_file():
            continue
        try:
            if cutoff is None or f.stat().st_mtime < cutoff:
                size = f.stat().st_size
                f.unlink()
                deleted += 1
                freed   += size
        except OSError:
            pass

    log.info("Temp cleanup: deleted %d files, freed %.1f MB", deleted, freed / 1024 ** 2)
    return {"deleted_files": deleted, "freed_bytes": freed}


def cleanup_cache(max_size_bytes: int) -> dict:
    """
    If CACHE_DIR exceeds max_size_bytes, delete oldest files (LRU) until below limit.
    Returns {deleted_files, freed_bytes}.
    """
    info = _scan_dir(config.CACHE_DIR)
    if info["size_bytes"] <= max_size_bytes:
        return {"deleted_files": 0, "freed_bytes": 0}

    # Sort oldest first
    files_sorted = sorted(info["files"], key=lambda x: x[1])
    deleted = 0
    freed   = 0
    current_size = info["size_bytes"]

    for fpath, _, fsize in files_sorted:
        if current_size <= max_size_bytes:
            break
        try:
            fpath.unlink()
            current_size -= fsize
            deleted      += 1
            freed        += fsize
        except OSError:
            pass

    log.info("Cache cleanup: deleted %d files, freed %.1f MB", deleted, freed / 1024 ** 2)
    return {"deleted_files": deleted, "freed_bytes": freed}


def clear_thumbnails() -> dict:
    """Delete all generated thumbnails across all projects."""
    deleted = 0
    freed   = 0
    if not config.PROJECTS_DIR.exists():
        return {"deleted_files": 0, "freed_bytes": 0}
    for proj_dir in config.PROJECTS_DIR.iterdir():
        if not proj_dir.is_dir():
            continue
        t_dir = proj_dir / "thumbnails"
        if t_dir.exists():
            for f in t_dir.rglob("*"):
                if f.is_file():
                    try:
                        freed   += f.stat().st_size
                        f.unlink()
                        deleted += 1
                    except OSError:
                        pass
    log.info("Thumbnail clear: deleted %d files", deleted)
    return {"deleted_files": deleted, "freed_bytes": freed}
