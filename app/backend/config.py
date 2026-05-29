"""Portable path resolver — all paths relative to project ROOT."""
import json
from pathlib import Path

# backend/ → app/ → project root
ROOT = Path(__file__).resolve().parent.parent.parent

def _load_config(name: str) -> dict:
    try:
        return json.loads((ROOT / "config" / name).read_text(encoding="utf-8"))
    except Exception:
        return {}

_app  = _load_config("app.config.json")
_path = _load_config("paths.config.json")

# ── Directory paths ───────────────────────────────────────────────────────────
PROJECTS_DIR  = ROOT / "projects"
UPLOADS_DIR   = ROOT / "uploads"
EXPORTS_DIR   = ROOT / "exports"
CACHE_DIR     = ROOT / "cache"
TEMP_DIR      = ROOT / "temp"
DATABASE_DIR  = ROOT / "database"
MODELS_DIR    = ROOT / "models"
ASSETS_DIR    = ROOT / "assets"
LOGS_DIR      = ROOT / "logs"
PLUGINS_DIR       = ROOT / "plugins"
BIN_DIR           = ROOT / "bin"
FRONTEND_DIST     = ROOT / "app" / "frontend" / "dist"
TEMPLATES_DIR     = ROOT / "templates"
USER_TEMPLATES_DIR = TEMPLATES_DIR / "user"
USER_PRESETS_DIR  = TEMPLATES_DIR / "presets"

# ── File paths ────────────────────────────────────────────────────────────────
DATABASE_PATH = DATABASE_DIR / "app.sqlite"
FFMPEG_PATH   = BIN_DIR / "ffmpeg" / "ffmpeg.exe"
FFPROBE_PATH  = BIN_DIR / "ffmpeg" / "ffprobe.exe"

# Preferred font for drawtext (checked in order; first that exists wins)
_FONT_CANDIDATES = [
    ROOT / "assets" / "fonts" / "Roboto-Regular.ttf",
    ROOT / "assets" / "fonts" / "Arial.ttf",
    Path("C:/Windows/Fonts/arial.ttf"),
    Path("C:/Windows/Fonts/calibri.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/TTF/DejaVuSans.ttf"),
    Path("/System/Library/Fonts/Helvetica.ttc"),
]
FONT_PATH: Path | None = next((f for f in _FONT_CANDIDATES if f.exists()), None)

# ── App settings ──────────────────────────────────────────────────────────────
APP_NAME    = _app.get("app", {}).get("name", "AI Video Studio Pro")
APP_VERSION = _app.get("app", {}).get("version", "0.1.0")
APP_PHASE   = _app.get("app", {}).get("phase", 1)
HOST        = _app.get("server", {}).get("host", "127.0.0.1")
PORT        = int(_app.get("server", {}).get("port", 8000))

# ── Ensure required directories exist ────────────────────────────────────────
def ensure_dirs():
    for d in [PROJECTS_DIR, UPLOADS_DIR, EXPORTS_DIR, CACHE_DIR,
              TEMP_DIR, DATABASE_DIR, LOGS_DIR,
              USER_TEMPLATES_DIR, USER_PRESETS_DIR]:
        d.mkdir(parents=True, exist_ok=True)

ensure_dirs()
