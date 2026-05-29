# AI Video Studio Pro — Setup Guide

**Last Updated:** 2026-05-29

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Windows | 10 or 11 | Primary platform |
| Node.js | 18+ | Must be installed on the host machine |
| Python | 3.10+ | Must be installed on the host machine |
| FFmpeg | 6+ | Must be placed in `bin/ffmpeg/` |

Node.js and Python must be installed on the host system. The app is portable in the sense that no system-wide packages are installed — Python packages go into `env/` and Node packages into `app/frontend/node_modules/` — but the runtimes themselves must be present.

---

## First-Time Setup

### Step 1: Place FFmpeg Binaries

Download FFmpeg for Windows from https://ffmpeg.org/download.html (get the "full" build).

Extract and copy:
- `ffmpeg.exe` → `bin/ffmpeg/ffmpeg.exe`
- `ffprobe.exe` → `bin/ffmpeg/ffprobe.exe`

### Step 2: Run Portable Setup

```batch
scripts\setup-portable.bat
```

This script will:
1. Create a Python virtual environment at `env/`
2. Install all Python packages into `env/` (not system-wide)
3. Install Node.js packages into `app/frontend/node_modules/`
4. Install Electron into `app/desktop/node_modules/`
5. Verify FFmpeg is present and working
6. Write setup completion status to `logs/build-log.md`

### Step 3: Launch the App

Double-click `START.bat` from the project root.

`START.bat` automatically detects whether a built frontend exists and launches in the appropriate mode:
- If `app/frontend/dist/index.html` exists → **production mode** (no Vite dev server)
- Otherwise → menu: Dev mode / Build+Launch / Setup / Health check / Quit

### Step 4: Verify with Health Check

```batch
scripts\health-check.bat
```

Expected output:
```
[OK] FFmpeg found at bin/ffmpeg/ffmpeg.exe
[OK] FFprobe found at bin/ffmpeg/ffprobe.exe
[OK] Python environment active (env/)
[OK] Node.js available
[OK] Backend starts and responds to /api/health
[OK] Database directory exists
[OK] All required folders present
Health check: PASSED
```

---

## Production Mode

Production mode serves the built React app directly from the backend. No Vite dev server is needed.

### Building the Frontend

```batch
scripts\build-frontend.bat
```

This runs `npm run build` in `app/frontend/` and outputs to `app/frontend/dist/`. After building, `START.bat` will detect the build and launch in production mode automatically.

### Launching in Production Mode

```batch
scripts\start-prod.bat
```

Or just double-click `START.bat` — it auto-detects the build.

`start-prod.bat` sets `AVSP_PROD=1`, which tells Electron to load the backend URL (`http://127.0.0.1:8000`) instead of the Vite dev server.

---

## Development Setup

For development with hot-reload (no need to build):

### Terminal 1 — Backend
```batch
cd app\backend
..\..\env\Scripts\python.exe main.py
```

### Terminal 2 — Frontend
```batch
cd app\frontend
npm run dev
```

### Terminal 3 — Electron (optional, can also use browser)
```batch
cd app\desktop
npm run dev
```

The frontend dev server runs on `http://localhost:5173`.
The backend API runs on `http://127.0.0.1:8000`.

Alternatively, run `START.bat` and select option **[1] Dev mode** from the menu.

---

## Installing AI Models

### Whisper (Auto-Captions)

1. The setup script can download Whisper models automatically.
2. Models are saved to `models/whisper/`.
3. Model sizes:
   | Model | Size | Quality | Speed |
   |-------|------|---------|-------|
   | tiny | 75 MB | Basic | Very Fast |
   | base | 145 MB | Good | Fast |
   | small | 465 MB | Better | Medium |
   | medium | 1.5 GB | Best offline | Slow |
   | large-v3 | 3 GB | Professional | Very Slow |
4. Recommended for most users: `base` or `small`

---

## Maintenance Scripts

| Script | Purpose |
|--------|---------|
| `scripts/repair.bat` | Re-installs Python venv, pip packages, frontend and Electron node_modules. User data is never touched. Run after upgrading Node.js or Python. |
| `scripts/reset-data.bat` | Clears all user data (projects, exports, cache, temp, database). Requires typing "RESET" to confirm. Irreversible. |
| `scripts/health-check.bat` | Checks all dependencies and reports pass/fail. |
| `scripts/build-frontend.bat` | Builds the React frontend for production use. |

---

## Moving the App to Another Location

1. Copy the entire `AI-Video-Studio-Pro/` folder to the new location.
2. All paths are relative — no reconfiguration needed.
3. Run `scripts/health-check.bat` on the new machine to verify.

**Note:** The Python `env/` folder may not transfer cleanly across Windows versions or Python major versions (e.g., 3.10 → 3.12). Run `scripts/repair.bat` to rebuild if health check fails after moving. Similarly, `node_modules/` may need a rebuild after a Node.js major version upgrade.

---

## Troubleshooting

See `docs/troubleshooting.md` for common issues and fixes.

---

## Uninstall

To completely remove the app:
1. Delete the entire `AI-Video-Studio-Pro/` folder.
2. No registry entries, no AppData entries, no system changes.
