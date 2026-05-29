# AI Video Studio Pro

A professional, portable, AI-powered video editing workstation.
Runs entirely from a single folder — no system installation required.

---

## Overview

AI Video Studio Pro is a CapCut-inspired desktop video editor built for:
- Content creators and social media teams
- Marketing agencies and local businesses
- Editors who need fast AI-assisted workflows
- Anyone who wants professional editing without expensive subscriptions

### Core Philosophy
- **Portable first** — runs from external SSD, no dependencies on host system (beyond Node.js + Python runtimes)
- **Offline capable** — all AI models run locally, no internet required for editing
- **Creator-friendly** — familiar layout inspired by modern video editors
- **Production-ready** — built for real workflows, not just demos

---

## Feature Highlights

| Category | Features |
|----------|---------|
| Timeline | Multi-track editing, trim, split, speed control, snap, zoom, undo/redo |
| AI Tools | Auto-captions (Whisper), scene detection, silence removal, beat sync, project analysis |
| Audio | Waveform visualization, volume, fade in/out, mute, noise reduction, beat detection |
| Text | Animated captions, title presets, subtitle export (SRT/VTT) |
| Effects | 14 visual filters, LUT support, color grading, transitions (xfade) |
| Export | 10+ social media presets, H.264/H.265, real-time progress, cancel |
| Templates | 9 built-in templates (Reels, Shorts, TikTok, Business, etc.), user-saved templates |
| Tracker | Activity log, export history, AI jobs, system logs, health monitor, plugin manager |
| Plugins | Importlib-based plugin system, enable/disable per plugin, sample plugin included |
| Performance | 360p proxy generation, LRU thumbnail cache, timeline backups, crash recovery |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Desktop | Electron |
| Backend | Python FastAPI |
| Video Engine | FFmpeg (bundled in `bin/ffmpeg/`) |
| Database | SQLite (`database/app.sqlite`) |
| AI — Captions | faster-whisper (local, offline) |
| AI — Analysis | Custom Python engines (scene/silence/beat/highlight) |
| State Management | Zustand |
| Animations | Framer Motion |

---

## Project Structure

```
AI-Video-Studio-Pro/
├── app/
│   ├── frontend/           React + TypeScript UI (Vite, Tailwind)
│   │   └── src/
│   │       ├── components/ Timeline, panels, modals, dialogs
│   │       ├── pages/      Home.tsx, Editor.tsx
│   │       └── store/      Zustand stores (timeline, project, media)
│   ├── backend/            Python FastAPI service
│   │   ├── api/            Route handlers (media, export, ai, etc.)
│   │   ├── engines/        FFmpeg, Whisper, proxy, cache engines
│   │   ├── config.py       Portable path resolver
│   │   ├── database.py     SQLite schema + migrations
│   │   └── main.py         App entry, router registration, SPA mount
│   └── desktop/            Electron wrapper
│       └── main.js         Window creation, backend lifecycle
├── bin/
│   └── ffmpeg/             ffmpeg.exe + ffprobe.exe (place here manually)
├── models/
│   └── whisper/            Whisper model files (.bin)
├── projects/               User project data (timeline JSON, backups, proxies)
├── exports/                Rendered output videos
├── assets/
│   ├── templates/          Built-in + user templates (JSON)
│   ├── effects/            LUT files
│   └── fonts/              Bundled fonts
├── cache/                  Thumbnails, waveform data, proxy files
├── temp/                   Processing workspace (auto-cleaned on start)
├── database/               app.sqlite
├── logs/                   Build, error, test, dependency logs
├── config/                 app.config.json, export-presets.json, ai.config.json
├── docs/                   Full documentation
├── scripts/                Launch, build, setup, repair, reset scripts
├── plugins/                Plugin modules (sample/ included)
├── env/                    Python virtual environment (auto-created by setup)
├── START.bat               Double-click launcher (auto-detects prod/dev mode)
├── START_HERE.md           Quick start guide
└── VERSION                 Current version string
```

---

## Development Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 0 | Discovery & Planning | ✅ Complete |
| 1 | Project Foundation | ✅ Complete |
| 2 | UI Shell | ✅ Complete |
| 3 | Media Import | ✅ Complete |
| 4 | Timeline MVP | ✅ Complete |
| 5 | Preview Playback | ✅ Complete |
| 6 | FFmpeg Render Engine | ✅ Complete |
| 7 | Text & Captions | ✅ Complete |
| 8 | Local AI Captions | ✅ Complete |
| 9 | Audio Editing | ✅ Complete |
| 10 | Effects & Transitions | ✅ Complete |
| 11 | AI Smart Tools | ✅ Complete |
| 12 | Templates & Presets | ✅ Complete |
| 13 | Project Tracker UI | ✅ Complete |
| 14 | Plugin System | ✅ Complete |
| 15 | Performance & Stability | ✅ Complete |
| 16 | Portable Build | ✅ Complete |
| 17 | Final QA | ✅ Complete |
| 18 | Production Release | ✅ Complete |

---

## Getting Started

See `START_HERE.md` for quick start instructions.
See `docs/setup-guide.md` for detailed setup including production mode.
See `docs/user-guide.md` for full feature documentation.

---

## Version

**Current:** 1.0.0  
**Build Date:** 2026-05-29  
**Phase:** 18 — Production Release  
**Channel:** Release
