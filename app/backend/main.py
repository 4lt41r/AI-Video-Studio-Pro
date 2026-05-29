#!/usr/bin/env python3
"""AI Video Studio Pro — FastAPI Backend"""
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import config
from database import init_db
from api import health, projects, media, timeline, export, jobs, system, ws, caption, ai
from api.templates import router as templates_router, presets_router
from api.plugins import router as plugins_router
from api.cache   import router as cache_router
import engines.plugin_engine as plugin_engine
import engines.cache_engine  as cache_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("avsp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting %s v%s (Phase %s)", config.APP_NAME, config.APP_VERSION, config.APP_PHASE)
    await init_db()
    log.info("Database ready at %s", config.DATABASE_PATH)
    log.info("Root: %s", config.ROOT)

    # Crash recovery — write sentinel; previous sentinel = crash
    from api.system import _CRASH_SENTINEL
    import json
    if _CRASH_SENTINEL.exists():
        log.warning("Previous session crash detected — sentinel found at %s", _CRASH_SENTINEL)
    _CRASH_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
    _CRASH_SENTINEL.write_text(
        json.dumps({"started_at": datetime.now(timezone.utc).isoformat()}),
        encoding="utf-8",
    )

    # Temp cleanup on startup (files older than 24h)
    cleaned = cache_engine.cleanup_temp(max_age_hours=24)
    if cleaned["deleted_files"]:
        log.info("Startup temp cleanup: removed %d files", cleaned["deleted_files"])

    # Load plugins
    loaded_plugins = plugin_engine.load_all_plugins()
    for manifest, p_router in loaded_plugins:
        prefix = manifest.get("api_prefix", f"/api/plugins/{manifest['id']}")
        app.include_router(p_router, prefix=prefix, tags=[f"plugin:{manifest['id']}"])
        log.info("Plugin route registered: %s → %s", manifest["id"], prefix)
    log.info("%d plugin(s) loaded", len(loaded_plugins))

    yield

    # Clean shutdown — remove crash sentinel
    try:
        _CRASH_SENTINEL.unlink(missing_ok=True)
    except Exception:
        pass
    log.info("Shutdown complete.")


app = FastAPI(
    title="AI Video Studio Pro API",
    version=config.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router,    prefix="/api",           tags=["health"])
app.include_router(projects.router,  prefix="/api/projects",  tags=["projects"])
app.include_router(media.router,     prefix="/api/projects",  tags=["media"])
app.include_router(timeline.router,  prefix="/api/projects",  tags=["timeline"])
app.include_router(export.router,    prefix="/api/export",    tags=["export"])
app.include_router(jobs.router,      prefix="/api/jobs",      tags=["jobs"])
app.include_router(system.router,    prefix="/api/system",    tags=["system"])
app.include_router(ws.router,        prefix="",               tags=["websocket"])
app.include_router(caption.router,   prefix="/api/caption",   tags=["caption"])
app.include_router(ai.router,        prefix="/api/ai",        tags=["ai"])
app.include_router(templates_router, prefix="/api/templates", tags=["templates"])
app.include_router(presets_router,   prefix="/api/presets",   tags=["presets"])
app.include_router(plugins_router,   prefix="/api/plugins",   tags=["plugins"])
app.include_router(cache_router,     prefix="/api/cache",     tags=["cache"])

# Serve project media files (thumbnails, etc.) as static content
config.PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/media-files",
    StaticFiles(directory=str(config.PROJECTS_DIR)),
    name="media-files",
)


# Serve built React SPA (production mode — dist/ present)
if config.FRONTEND_DIST.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(config.FRONTEND_DIST), html=True),
        name="frontend",
    )
    log.info("Serving built frontend from %s", config.FRONTEND_DIST)
else:
    log.info("No dist/ found — expecting Vite dev server on :5173")


@app.exception_handler(Exception)
async def global_error(request, exc):
    log.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        log_level="info",
    )
