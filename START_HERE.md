# AI Video Studio Pro — Start Here

Welcome. This is a portable, self-contained AI-powered video editing workstation.
Everything you need is inside this folder. No installation required beyond the first-time setup.

---

## Quick Start (Windows)

### First Time Only

Run the setup script:
```
scripts\setup-portable.bat
```

This installs Python packages into `env\` and Node packages into `app\frontend\node_modules\` — all inside this folder. Nothing is installed system-wide.

### Every Time After

Double-click `START.bat` in this folder.

`START.bat` auto-detects whether a production build exists:
- **If `app\frontend\dist\index.html` exists** → launches in production mode (no Vite dev server needed)
- **Otherwise** → shows a menu: Dev mode / Build+Launch / First-time setup / Health check / Quit

### Health Check

```
scripts\health-check.bat
```

Run this to verify FFmpeg, Python, Node.js, and the backend are all working correctly.

---

## Production vs Development Mode

| Mode | How to launch | When to use |
|------|--------------|-------------|
| **Production** | `START.bat` (auto-detects) or `scripts\start-prod.bat` | Running the app normally |
| **Development** | `START.bat` → option 1, or `scripts\start-app.bat` | Making code changes with hot-reload |

To build the frontend for production:
```
scripts\build-frontend.bat
```

---

## What This App Does

AI Video Studio Pro is a professional desktop video editor with:
- Multi-track timeline editing (video, audio, text, effects)
- AI-powered auto-captions using local Whisper model (no internet needed)
- Beat sync, scene detection, silence removal, AI project analysis
- Social media export presets (Reels, Shorts, TikTok, YouTube, and more)
- Text overlays, transitions, filters, LUT color grading
- Plugin system for custom tools
- Crash recovery and timeline backups
- Fully portable — runs from USB drive or external SSD

---

## Folder Structure

```
AI-Video-Studio-Pro/
├── app/            → Application code (frontend, backend, desktop)
├── bin/            → FFmpeg binaries (place ffmpeg.exe + ffprobe.exe here)
├── models/         → Local AI models (Whisper)
├── projects/       → Your saved editing projects
├── exports/        → Finished exported videos
├── assets/         → Templates, effects, fonts
├── cache/          → Thumbnails and preview cache
├── temp/           → Working files (auto-cleaned on start)
├── database/       → SQLite project database
├── logs/           → All app logs
├── config/         → App configuration files
├── docs/           → Full documentation
├── scripts/        → Launch and setup scripts
├── plugins/        → Optional plugin modules
└── env/            → Python virtual environment (created by setup)
```

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `START.bat` | Main launcher — auto-detects prod/dev mode |
| `scripts\setup-portable.bat` | First-time setup |
| `scripts\start-prod.bat` | Production mode launcher |
| `scripts\start-app.bat` | Development mode launcher |
| `scripts\build-frontend.bat` | Build React frontend for production |
| `scripts\health-check.bat` | Verify all dependencies |
| `scripts\repair.bat` | Re-install env + node_modules (keeps user data) |
| `scripts\reset-data.bat` | Clear all user data (requires typing RESET) |

---

## Requirements

- **Windows 10/11** (primary platform)
- **Node.js 18+** — must be installed on the host machine
- **Python 3.10+** — must be installed on the host machine
- **FFmpeg** — place `ffmpeg.exe` and `ffprobe.exe` in `bin\ffmpeg\`

`setup-portable.bat` handles everything except FFmpeg placement and the runtime installs.

---

## Documentation

| File | Purpose |
|------|---------|
| `docs/setup-guide.md` | Detailed setup + production mode |
| `docs/user-guide.md` | Full feature documentation |
| `docs/keyboard-shortcuts.md` | All keyboard shortcuts |
| `docs/known-limitations.md` | Known constraints and design decisions |
| `docs/troubleshooting.md` | Common issues and fixes |
| `docs/architecture.md` | Technical architecture |
| `docs/roadmap.md` | Full 18-phase development roadmap |

---

## Build Status

**Current Phase:** Phase 18 — Production Release ✅  
**Version:** 1.0.0  
**Build Date:** 2026-05-29  
**All 18 phases complete.**
