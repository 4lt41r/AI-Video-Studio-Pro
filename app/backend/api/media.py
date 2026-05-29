"""Media import and listing endpoints."""
import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import aiofiles
from database import get_db
import config
from engines import ffprobe_engine, thumbnail_engine, waveform_engine, proxy_engine

router = APIRouter()

VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv', '.ts', '.mts', '.mxf'}
AUDIO_EXTS = {'.mp3', '.aac', '.wav', '.flac', '.ogg', '.m4a', '.wma'}
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}


def _get_media_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in VIDEO_EXTS: return "video"
    if ext in AUDIO_EXTS: return "audio"
    if ext in IMAGE_EXTS: return "image"
    return "unknown"


class MediaImport(BaseModel):
    paths: list[str]


class MediaOut(BaseModel):
    id:         str
    project_id: str
    name:       str
    path:       str
    type:       str
    duration_s: Optional[float] = None
    width:      Optional[int]   = None
    height:     Optional[int]   = None
    fps:        Optional[float] = None
    has_audio:  bool = True
    size_bytes: int = 0
    thumbnail:  Optional[str] = None
    proxy_path: Optional[str] = None
    created_at: str
    missing:    bool = False


def _row_to_media(row) -> MediaOut:
    return MediaOut(
        id=row["id"], project_id=row["project_id"],
        name=row["name"], path=row["path"], type=row["type"],
        duration_s=row["duration_s"], width=row["width"],
        height=row["height"], fps=row["fps"],
        has_audio=bool(row["has_audio"] if row["has_audio"] is not None else 1),
        size_bytes=row["size_bytes"] or 0,
        thumbnail=row["thumbnail"],
        proxy_path=row["proxy_path"] if "proxy_path" in row.keys() else None,
        created_at=row["created_at"],
        missing=not Path(row["path"]).exists(),
    )


@router.get("/{project_id}/media", summary="List project media")
async def list_media(project_id: str):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM media WHERE project_id=? ORDER BY created_at DESC",
            (project_id,),
        )
    return {"media": [_row_to_media(r) for r in rows]}


@router.post("/{project_id}/media", status_code=201, summary="Import media files")
async def import_media(project_id: str, body: MediaImport):
    # Verify project exists
    async with get_db() as db:
        proj = await db.execute_fetchall("SELECT id FROM projects WHERE id=?", (project_id,))
    if not proj:
        raise HTTPException(404, "Project not found")

    now     = datetime.now(timezone.utc).isoformat()
    created = []

    # Ensure thumbnail directory exists
    thumb_dir = config.PROJECTS_DIR / project_id / "thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    async with get_db() as db:
        for raw_path in body.paths:
            p = Path(raw_path)
            if not p.exists():
                continue
            media_type = _get_media_type(p)
            if media_type == "unknown":
                continue

            mid  = str(uuid.uuid4())
            size = p.stat().st_size

            # Extract metadata via FFprobe
            meta: dict = {}
            if media_type in ("video", "audio"):
                meta = await ffprobe_engine.probe(p)

            duration_s = meta.get("duration_s")
            width      = meta.get("width")
            height     = meta.get("height")
            fps        = meta.get("fps")
            has_audio  = int(bool(meta.get("has_audio", True)))

            # Generate thumbnail
            thumb_url: Optional[str] = None
            if media_type in ("video", "image"):
                thumb_path = thumb_dir / f"{mid}.jpg"
                ok = await thumbnail_engine.generate(p, thumb_path)
                if ok:
                    thumb_url = f"/media-files/{project_id}/thumbnails/{mid}.jpg"

            await db.execute(
                "INSERT INTO media "
                "(id,project_id,name,path,type,size_bytes,duration_s,width,height,fps,has_audio,thumbnail,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (mid, project_id, p.name, str(p), media_type,
                 size, duration_s, width, height, fps, has_audio, thumb_url, now),
            )
            created.append(MediaOut(
                id=mid, project_id=project_id,
                name=p.name, path=str(p), type=media_type,
                size_bytes=size, duration_s=duration_s,
                width=width, height=height, fps=fps,
                has_audio=bool(has_audio),
                thumbnail=thumb_url, created_at=now,
                missing=False,
            ).model_dump())

        await db.commit()

    return {"imported": len(created), "media": created}


_MIME: dict[str, str] = {
    '.mp4': 'video/mp4',   '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.m4v': 'video/mp4',
    '.wmv': 'video/x-ms-wmv',   '.flv':  'video/x-flv', '.ts': 'video/mp2t',
    '.mp3': 'audio/mpeg',  '.aac': 'audio/aac',  '.wav': 'audio/wav',
    '.flac': 'audio/flac', '.ogg': 'audio/ogg',  '.m4a': 'audio/mp4',
    '.jpg': 'image/jpeg',  '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif',   '.webp': 'image/webp',
}

def _mime(ext: str) -> str:
    return _MIME.get(ext.lower(), 'application/octet-stream')


@router.get("/{project_id}/media/{media_id}/stream", summary="Stream a media file (Range-aware)")
async def stream_media(project_id: str, media_id: str, request: Request):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT path FROM media WHERE id=? AND project_id=?", (media_id, project_id)
        )
    if not rows:
        raise HTTPException(404, "Media not found")

    path = Path(rows[0]["path"])
    if not path.exists():
        raise HTTPException(404, "File not found on disk")

    file_size  = path.stat().st_size
    media_type = _mime(path.suffix)
    range_hdr  = request.headers.get("range", "")

    # ── Range request (seek support) ─────────────────────────────────────────
    if range_hdr.startswith("bytes="):
        try:
            rng   = range_hdr[6:].split("-")
            start = int(rng[0]) if rng[0] else 0
            end   = int(rng[1]) if len(rng) > 1 and rng[1] else file_size - 1
        except (ValueError, IndexError):
            raise HTTPException(416, "Invalid Range header")

        end   = min(end, file_size - 1)
        chunk = end - start + 1

        async def _ranged():
            async with aiofiles.open(path, "rb") as f:
                await f.seek(start)
                remaining = chunk
                while remaining > 0:
                    data = await f.read(min(65536, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            _ranged(),
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range":  f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(chunk),
            },
        )

    # ── Full file ─────────────────────────────────────────────────────────────
    async def _full():
        async with aiofiles.open(path, "rb") as f:
            while True:
                data = await f.read(65536)
                if not data:
                    break
                yield data

    return StreamingResponse(
        _full(),
        media_type=media_type,
        headers={
            "Accept-Ranges":  "bytes",
            "Content-Length": str(file_size),
        },
    )


@router.get("/{project_id}/media/{media_id}/waveform", summary="Get audio waveform peaks")
async def get_waveform(project_id: str, media_id: str, peaks: int = 200):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT path, has_audio FROM media WHERE id=? AND project_id=?",
            (media_id, project_id),
        )
    if not rows:
        raise HTTPException(404, "Media not found")

    row = rows[0]
    if not row["has_audio"]:
        return {"peaks": []}

    path = Path(row["path"])
    if not path.exists():
        raise HTTPException(404, "File not found on disk")

    data = await waveform_engine.get_peaks(path, num_peaks=min(peaks, 500))
    return {"peaks": data}


@router.post("/{project_id}/media/{media_id}/extract-audio", status_code=201, summary="Extract audio track from video")
async def extract_audio(project_id: str, media_id: str):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM media WHERE id=? AND project_id=?",
            (media_id, project_id),
        )
    if not rows:
        raise HTTPException(404, "Media not found")

    row = rows[0]
    if row["type"] not in ("video",):
        raise HTTPException(400, "Source must be a video file")
    if not row["has_audio"]:
        raise HTTPException(400, "Video has no audio track")

    src_path  = Path(row["path"])
    media_dir = config.PROJECTS_DIR / project_id / "media"
    media_dir.mkdir(parents=True, exist_ok=True)

    mid      = str(uuid.uuid4())
    out_name = src_path.stem + f"_audio_{mid[:8]}.wav"
    out_path = media_dir / out_name

    ffmpeg = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"
    cmd = [
        ffmpeg, "-y",
        "-i",  str(src_path),
        "-vn",          # no video
        "-c:a", "pcm_s16le",
        str(out_path),
        "-loglevel", "warning",
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=120.0)
    if proc.returncode != 0:
        raise HTTPException(
            500,
            "Audio extraction failed: " + stderr_bytes.decode(errors="replace")[:300],
        )

    if not out_path.exists():
        raise HTTPException(500, "Extraction produced no output file")

    # Probe the new audio file and register it
    now  = datetime.now(timezone.utc).isoformat()
    meta = await ffprobe_engine.probe(out_path)

    async with get_db() as db:
        await db.execute(
            "INSERT INTO media "
            "(id,project_id,name,path,type,size_bytes,duration_s,width,height,fps,has_audio,thumbnail,created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (mid, project_id, out_name, str(out_path), "audio",
             out_path.stat().st_size,
             meta.get("duration_s"), None, None, None,
             1, None, now),
        )
        await db.commit()

    return MediaOut(
        id=mid, project_id=project_id,
        name=out_name, path=str(out_path), type="audio",
        size_bytes=out_path.stat().st_size,
        duration_s=meta.get("duration_s"),
        has_audio=True, created_at=now, missing=False,
    )


@router.post("/{project_id}/media/{media_id}/proxy", status_code=202, summary="Generate low-res proxy")
async def generate_proxy(project_id: str, media_id: str):
    async with get_db() as db:
        rows = await db.execute_fetchall(
            "SELECT * FROM media WHERE id=? AND project_id=?", (media_id, project_id)
        )
    if not rows:
        raise HTTPException(404, "Media not found")

    row  = rows[0]
    path = Path(row["path"])
    if not path.exists():
        raise HTTPException(404, "Source file not found on disk")
    if row["type"] not in ("video",):
        raise HTTPException(400, "Proxy generation is only supported for video files")

    proxy_dir  = config.PROJECTS_DIR / project_id / "proxies"
    proxy_path = await proxy_engine.generate(path, proxy_dir, media_id)
    if proxy_path is None:
        raise HTTPException(500, "Proxy generation failed — check logs")

    proxy_url = f"/media-files/{project_id}/proxies/{proxy_path.name}"
    async with get_db() as db:
        await db.execute(
            "UPDATE media SET proxy_path=? WHERE id=?", (proxy_url, media_id)
        )
        await db.commit()

    return {"proxy_path": proxy_url, "size_mb": round(proxy_path.stat().st_size / 1024 ** 2, 1)}


@router.delete("/{project_id}/media/{media_id}", status_code=204, summary="Remove media")
async def delete_media(project_id: str, media_id: str):
    async with get_db() as db:
        # Also clean up thumbnail file
        rows = await db.execute_fetchall(
            "SELECT thumbnail FROM media WHERE id=? AND project_id=?", (media_id, project_id)
        )
        if rows and rows[0]["thumbnail"]:
            # thumbnail URL is /media-files/{project_id}/thumbnails/{id}.jpg
            thumb_path = config.PROJECTS_DIR / project_id / "thumbnails" / f"{media_id}.jpg"
            if thumb_path.exists():
                thumb_path.unlink(missing_ok=True)

        await db.execute(
            "DELETE FROM media WHERE id=? AND project_id=?", (media_id, project_id)
        )
        await db.commit()
