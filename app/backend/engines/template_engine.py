"""Template engine — built-in templates and user template file I/O."""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import config

# ── Default text style (mirrors frontend DEFAULT_TEXT_STYLE) ──────────────────

_DEFAULT_STYLE = {
    "font":         "Arial",
    "size":         36,
    "color":        "#ffffff",
    "bg_color":     "",
    "bold":         False,
    "italic":       False,
    "align":        "center",
    "x_pct":        50,
    "y_pct":        85,
    "shadow":       True,
    "stroke_width": 0,
    "stroke_color": "#000000",
}

def _style(**overrides) -> dict:
    return {**_DEFAULT_STYLE, **overrides}


# ── Built-in template definitions ─────────────────────────────────────────────

BUILTIN_TEMPLATES: list[dict] = [
    {
        "id":               "instagram-reel",
        "name":             "Instagram Reel",
        "category":         "reels",
        "aspect_ratio":     "9:16",
        "width":            1080,
        "height":           1920,
        "fps":              30,
        "description":      "Vertical 9:16 with title card + caption strip",
        "tags":             ["social", "vertical", "instagram"],
        "preview_gradient": ["#ec4899", "#9333ea"],
        "duration_hint_s":  30,
        "export_preset":    "instagram-reel",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "YOUR TITLE HERE",
                "start_s":   1.0,
                "duration_s":3.0,
                "style":     _style(size=72, bold=True, y_pct=40, shadow=True),
            },
            {
                "text":      "Add your tagline here",
                "start_s":   1.5,
                "duration_s":2.5,
                "style":     _style(size=32, y_pct=55, color="#ffffffcc"),
            },
            {
                "text":      "Follow for more ✨",
                "start_s":   26.0,
                "duration_s":3.5,
                "style":     _style(size=36, bold=True, y_pct=80, bg_color="#000000aa"),
            },
        ],
    },
    {
        "id":               "youtube-intro",
        "name":             "YouTube Intro",
        "category":         "youtube",
        "aspect_ratio":     "16:9",
        "width":            1920,
        "height":           1080,
        "fps":              30,
        "description":      "16:9 intro card with channel title and episode title",
        "tags":             ["youtube", "landscape", "intro"],
        "preview_gradient": ["#dc2626", "#991b1b"],
        "duration_hint_s":  10,
        "export_preset":    "youtube-1080p",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "CHANNEL NAME",
                "start_s":   0.5,
                "duration_s":4.0,
                "style":     _style(size=80, bold=True, y_pct=42, stroke_width=3, stroke_color="#dc2626"),
            },
            {
                "text":      "Episode Title Goes Here",
                "start_s":   1.0,
                "duration_s":3.5,
                "style":     _style(size=36, italic=True, y_pct=58, color="#ffffffaa"),
            },
        ],
    },
    {
        "id":               "youtube-shorts",
        "name":             "YouTube Shorts",
        "category":         "youtube",
        "aspect_ratio":     "9:16",
        "width":            1080,
        "height":           1920,
        "fps":              60,
        "description":      "9:16 vertical Shorts with bold hook text",
        "tags":             ["youtube", "vertical", "shorts"],
        "preview_gradient": ["#dc2626", "#f97316"],
        "duration_hint_s":  60,
        "export_preset":    "youtube-shorts",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "WAIT FOR IT... 👀",
                "start_s":   0.0,
                "duration_s":3.0,
                "style":     _style(size=60, bold=True, y_pct=15, stroke_width=3, stroke_color="#000000"),
            },
            {
                "text":      "Subscribe for more!",
                "start_s":   55.0,
                "duration_s":4.0,
                "style":     _style(size=40, bold=True, y_pct=85, bg_color="#dc2626ee"),
            },
        ],
    },
    {
        "id":               "tiktok-reel",
        "name":             "TikTok Reel",
        "category":         "reels",
        "aspect_ratio":     "9:16",
        "width":            1080,
        "height":           1920,
        "fps":              30,
        "description":      "Trendy TikTok-style with animated caption strip",
        "tags":             ["tiktok", "vertical", "social"],
        "preview_gradient": ["#06b6d4", "#3b82f6"],
        "duration_hint_s":  60,
        "export_preset":    "tiktok",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "POV: You discovered this hack 🔥",
                "start_s":   0.0,
                "duration_s":4.0,
                "style":     _style(size=48, bold=True, y_pct=20, stroke_width=2, stroke_color="#000000"),
            },
            {
                "text":      "Part 1 / 3",
                "start_s":   0.0,
                "duration_s":60.0,
                "style":     _style(size=24, y_pct=8, align="left", x_pct=10, color="#ffffffcc"),
            },
        ],
    },
    {
        "id":               "product-ad",
        "name":             "Product Ad",
        "category":         "business",
        "aspect_ratio":     "1:1",
        "width":            1080,
        "height":           1080,
        "fps":              30,
        "description":      "Square 1:1 product advertisement with name + CTA",
        "tags":             ["business", "square", "ad"],
        "preview_gradient": ["#6366f1", "#9333ea"],
        "duration_hint_s":  30,
        "export_preset":    "instagram-post",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "PRODUCT NAME",
                "start_s":   1.0,
                "duration_s":4.0,
                "style":     _style(size=64, bold=True, y_pct=30, letter_spacing=4),
            },
            {
                "text":      "The premium choice for modern life",
                "start_s":   2.0,
                "duration_s":3.0,
                "style":     _style(size=28, italic=True, y_pct=45, color="#ffffffbb"),
            },
            {
                "text":      "SHOP NOW →",
                "start_s":   25.0,
                "duration_s":4.0,
                "style":     _style(size=36, bold=True, y_pct=78, bg_color="#6366f1ee", stroke_width=0),
            },
        ],
    },
    {
        "id":               "festival-promo",
        "name":             "Festival Promo",
        "category":         "events",
        "aspect_ratio":     "9:16",
        "width":            1080,
        "height":           1920,
        "fps":              30,
        "description":      "Festival or event promo with title, date, and venue",
        "tags":             ["event", "festival", "vertical"],
        "preview_gradient": ["#f59e0b", "#ef4444"],
        "duration_hint_s":  30,
        "export_preset":    "instagram-reel",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "FESTIVAL NAME 2026",
                "start_s":   1.0,
                "duration_s":5.0,
                "style":     _style(size=68, bold=True, y_pct=35, stroke_width=3, stroke_color="#f59e0b"),
            },
            {
                "text":      "📅  July 4–6, 2026",
                "start_s":   2.0,
                "duration_s":4.5,
                "style":     _style(size=34, y_pct=52),
            },
            {
                "text":      "📍  Venue Name, City",
                "start_s":   2.5,
                "duration_s":4.0,
                "style":     _style(size=28, y_pct=60, color="#ffffffaa"),
            },
            {
                "text":      "Tickets available now! Link in bio.",
                "start_s":   26.0,
                "duration_s":3.5,
                "style":     _style(size=30, bold=True, y_pct=82, bg_color="#000000bb"),
            },
        ],
    },
    {
        "id":               "hotel-greeting",
        "name":             "Hotel Greeting",
        "category":         "business",
        "aspect_ratio":     "16:9",
        "width":            1920,
        "height":           1080,
        "fps":              30,
        "description":      "Elegant welcome video for hospitality brands",
        "tags":             ["hotel", "hospitality", "landscape"],
        "preview_gradient": ["#0891b2", "#1d4ed8"],
        "duration_hint_s":  30,
        "export_preset":    "youtube-1080p",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "Welcome to",
                "start_s":   1.0,
                "duration_s":5.0,
                "style":     _style(size=40, italic=True, y_pct=38, color="#ffffffcc"),
            },
            {
                "text":      "THE GRAND HOTEL",
                "start_s":   1.5,
                "duration_s":5.0,
                "style":     _style(size=72, bold=True, y_pct=52, stroke_width=1, stroke_color="#0891b2"),
            },
            {
                "text":      "Where luxury meets comfort",
                "start_s":   2.5,
                "duration_s":4.0,
                "style":     _style(size=28, italic=True, y_pct=65, color="#ffffffaa"),
            },
        ],
    },
    {
        "id":               "salon-promo",
        "name":             "Salon Promo",
        "category":         "business",
        "aspect_ratio":     "16:9",
        "width":            1920,
        "height":           1080,
        "fps":              30,
        "description":      "Hair or beauty salon promotional video",
        "tags":             ["salon", "beauty", "business"],
        "preview_gradient": ["#d97706", "#f59e0b"],
        "duration_hint_s":  60,
        "export_preset":    "facebook-1080p",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "SALON NAME",
                "start_s":   0.5,
                "duration_s":5.0,
                "style":     _style(size=80, bold=True, y_pct=40, stroke_width=2, stroke_color="#d97706"),
            },
            {
                "text":      "Book your appointment today",
                "start_s":   2.0,
                "duration_s":4.0,
                "style":     _style(size=32, italic=True, y_pct=57, color="#ffffffaa"),
            },
            {
                "text":      "📞  +1 (555) 000-0000  ·  @salon_handle",
                "start_s":   55.0,
                "duration_s":4.5,
                "style":     _style(size=26, y_pct=85, bg_color="#000000cc"),
            },
        ],
    },
    {
        "id":               "announcement",
        "name":             "Announcement",
        "category":         "events",
        "aspect_ratio":     "16:9",
        "width":            1920,
        "height":           1080,
        "fps":              30,
        "description":      "Breaking news or important announcement layout",
        "tags":             ["announcement", "news", "landscape"],
        "preview_gradient": ["#10b981", "#0891b2"],
        "duration_hint_s":  15,
        "export_preset":    "youtube-1080p",
        "is_builtin":       True,
        "text_clips": [
            {
                "text":      "📢  ANNOUNCEMENT",
                "start_s":   0.5,
                "duration_s":2.0,
                "style":     _style(size=36, bold=True, y_pct=25, align="left", x_pct=12, bg_color="#10b981ee"),
            },
            {
                "text":      "BIG NEWS HEADLINE HERE",
                "start_s":   1.0,
                "duration_s":6.0,
                "style":     _style(size=72, bold=True, y_pct=50, stroke_width=2, stroke_color="#10b981"),
            },
            {
                "text":      "More details below ↓",
                "start_s":   3.0,
                "duration_s":4.0,
                "style":     _style(size=28, italic=True, y_pct=68, color="#ffffffaa"),
            },
        ],
    },
]

# Build lookup dict
_BUILTIN_BY_ID: dict[str, dict] = {t["id"]: t for t in BUILTIN_TEMPLATES}


# ── User template I/O ──────────────────────────────────────────────────────────

def list_all_templates() -> list[dict]:
    """Return built-in templates followed by user-saved templates."""
    user = _load_user_templates()
    return BUILTIN_TEMPLATES + user


def get_template(template_id: str) -> dict | None:
    """Return a template by ID, checking built-in first, then user."""
    if template_id in _BUILTIN_BY_ID:
        return _BUILTIN_BY_ID[template_id]
    for t in _load_user_templates():
        if t["id"] == template_id:
            return t
    return None


def save_user_template(
    name: str,
    category: str,
    description: str,
    aspect_ratio: str,
    width: int,
    height: int,
    fps: float,
    text_clips: list[dict],
    preview_gradient: list[str] | None = None,
) -> dict:
    """Persist a user-created template to disk. Returns the saved template."""
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    tmpl = {
        "id":               tid,
        "name":             name,
        "category":         category,
        "aspect_ratio":     aspect_ratio,
        "width":            width,
        "height":           height,
        "fps":              fps,
        "description":      description or "",
        "tags":             ["custom"],
        "preview_gradient": preview_gradient or ["#6366f1", "#8b5cf6"],
        "duration_hint_s":  0,
        "export_preset":    "",
        "is_builtin":       False,
        "text_clips":       text_clips,
        "created_at":       now,
    }
    path = config.USER_TEMPLATES_DIR / f"{tid}.json"
    path.write_text(json.dumps(tmpl, ensure_ascii=False, indent=2), encoding="utf-8")
    return tmpl


def delete_user_template(template_id: str) -> bool:
    """Delete a user template file. Returns True if deleted."""
    path = config.USER_TEMPLATES_DIR / f"{template_id}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def _load_user_templates() -> list[dict]:
    templates: list[dict] = []
    for f in sorted(config.USER_TEMPLATES_DIR.glob("*.json")):
        try:
            templates.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    return templates


# ── Text style presets I/O ─────────────────────────────────────────────────────

_TEXT_PRESETS_FILE = config.USER_PRESETS_DIR / "text_presets.json"

_BUILTIN_TEXT_PRESETS: list[dict] = [
    {
        "id":    "basic-caption",
        "name":  "Basic Caption",
        "style": _style(size=36, color="#ffffff", shadow=True),
        "is_builtin": True,
    },
    {
        "id":    "bold-white",
        "name":  "Bold White",
        "style": _style(size=40, color="#ffffff", bold=True, shadow=True),
        "is_builtin": True,
    },
    {
        "id":    "filled-dark",
        "name":  "Filled Dark",
        "style": _style(size=34, color="#ffffff", bg_color="#000000cc", shadow=False),
        "is_builtin": True,
    },
    {
        "id":    "outline",
        "name":  "Outline",
        "style": _style(size=36, color="#ffffff", stroke_width=2, stroke_color="#000000", shadow=False),
        "is_builtin": True,
    },
    {
        "id":    "neon-cyan",
        "name":  "Neon Cyan",
        "style": _style(size=36, color="#22d3ee", shadow=True, stroke_width=1, stroke_color="#0891b2"),
        "is_builtin": True,
    },
    {
        "id":    "big-title",
        "name":  "Big Title",
        "style": _style(size=72, bold=True, y_pct=50, shadow=True),
        "is_builtin": True,
    },
    {
        "id":    "lower-third",
        "name":  "Lower Third",
        "style": _style(size=32, bold=True, x_pct=15, y_pct=80, align="left"),
        "is_builtin": True,
    },
]

def list_text_presets() -> list[dict]:
    user = _load_user_text_presets()
    return _BUILTIN_TEXT_PRESETS + user


def save_text_preset(name: str, style: dict) -> dict:
    existing = _load_user_text_presets()
    pid = str(uuid.uuid4())
    preset = {"id": pid, "name": name, "style": style, "is_builtin": False}
    existing.append(preset)
    _TEXT_PRESETS_FILE.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return preset


def delete_text_preset(preset_id: str) -> bool:
    existing = _load_user_text_presets()
    updated  = [p for p in existing if p["id"] != preset_id]
    if len(updated) == len(existing):
        return False
    _TEXT_PRESETS_FILE.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return True


def _load_user_text_presets() -> list[dict]:
    if not _TEXT_PRESETS_FILE.exists():
        return []
    try:
        return json.loads(_TEXT_PRESETS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


# ── Timeline builder (for apply route) ────────────────────────────────────────

_DEFAULT_TRACKS = [
    {"id": "track-video-1", "type": "video",    "name": "Video 1",   "muted": False, "locked": False, "visible": True, "clips": []},
    {"id": "track-audio-1", "type": "audio",    "name": "Audio 1",   "muted": False, "locked": False, "visible": True, "clips": []},
    {"id": "track-sub-1",   "type": "subtitle", "name": "Subtitles", "muted": False, "locked": False, "visible": True, "clips": []},
]

_DEFAULT_TEXT_STYLE = _DEFAULT_STYLE.copy()


def build_initial_timeline(template: dict, project_id: str) -> dict:
    """
    Construct the initial timeline state for a project created from a template.
    Returns a state dict ready to save in the timelines table.
    """
    import copy, uuid as _uuid
    tracks = copy.deepcopy(_DEFAULT_TRACKS)
    sub_track = tracks[2]  # subtitle track

    for tc in template.get("text_clips", []):
        dur = tc.get("duration_s", 3.0)
        clip = {
            "id":             str(_uuid.uuid4()),
            "track_id":       sub_track["id"],
            "media_id":       "",
            "start_s":        tc.get("start_s", 0.0),
            "end_s":          tc.get("start_s", 0.0) + dur,
            "source_start_s": 0.0,
            "source_end_s":   dur,
            "speed":          1.0,
            "volume":         1.0,
            "effects":        [],
            "text_content":   tc.get("text", ""),
            "text_style":     {**_DEFAULT_TEXT_STYLE, **tc.get("style", {})},
        }
        sub_track["clips"].append(clip)

    all_clips = [c for t in tracks for c in t["clips"]]
    duration  = max((c["end_s"] for c in all_clips), default=0.0)

    return {
        "project_id": project_id,
        "tracks":     tracks,
        "duration_s": duration,
    }
