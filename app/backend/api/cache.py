"""Cache and temp management API."""
from fastapi import APIRouter
from engines import cache_engine

router = APIRouter()


@router.get("/stats")
async def cache_stats():
    return cache_engine.get_cache_stats()


@router.post("/clear-temp")
async def clear_temp():
    result = cache_engine.cleanup_temp(max_age_hours=0)
    return {**result, "freed_mb": round(result["freed_bytes"] / 1024 ** 2, 1)}


@router.post("/clear-thumbnails")
async def clear_thumbnails():
    result = cache_engine.clear_thumbnails()
    return {**result, "freed_mb": round(result["freed_bytes"] / 1024 ** 2, 1)}


@router.post("/enforce-limit")
async def enforce_limit(max_gb: float = 5.0):
    result = cache_engine.cleanup_cache(int(max_gb * 1024 ** 3))
    return {**result, "freed_mb": round(result["freed_bytes"] / 1024 ** 2, 1)}
