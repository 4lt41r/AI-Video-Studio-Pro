"""
Sample Plugin — AI Video Studio Pro
Demonstrates the plugin API. Use this as a starting point for your own plugins.

Required export: `router` (FastAPI APIRouter)
Your routes are mounted at the prefix defined in manifest.json.
"""
import random
from fastapi import APIRouter

router = APIRouter()

_NAME    = "Sample Plugin"
_VERSION = "1.0.0"

_TEXT_IDEAS = [
    {"category": "hook",     "text": "Wait for it…",               "style": "bold"},
    {"category": "hook",     "text": "You won't believe this",      "style": "bold"},
    {"category": "cta",      "text": "Follow for more",             "style": "outline"},
    {"category": "cta",      "text": "Save this for later",         "style": "outline"},
    {"category": "cta",      "text": "Share with a friend",         "style": "outline"},
    {"category": "title",    "text": "Day in my life",              "style": "gradient"},
    {"category": "title",    "text": "Behind the scenes",           "style": "gradient"},
    {"category": "caption",  "text": "POV: you found the best spot","style": "minimal"},
    {"category": "caption",  "text": "This changed everything",     "style": "minimal"},
    {"category": "lower3rd", "text": "Location: Unknown",           "style": "bar"},
]


@router.get("/ping")
async def ping():
    return {
        "message": f"Hello from {_NAME}!",
        "plugin":  "sample",
        "version": _VERSION,
        "status":  "ok",
    }


@router.get("/info")
async def info():
    return {
        "name":         _NAME,
        "version":      _VERSION,
        "capabilities": ["ping", "info", "text-ideas"],
        "description":  "A sample plugin demonstrating the plugin API",
    }


@router.get("/text-ideas")
async def text_ideas(count: int = 5, category: str = ""):
    pool = [t for t in _TEXT_IDEAS if not category or t["category"] == category]
    if not pool:
        pool = _TEXT_IDEAS
    count = max(1, min(count, len(pool)))
    return {"ideas": random.sample(pool, count)}
