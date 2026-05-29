# AI Video Studio Pro — Troubleshooting Guide

**Last Updated:** 2026-05-29

---

## Quick Diagnosis

Run the health check first:
```batch
scripts\health-check.bat
```

This will identify most common issues automatically.

---

## Common Issues

### App won't start

**Symptom:** Double-clicking `START.bat` shows a flash and closes.

**Fixes:**
1. Run `scripts/health-check.bat` to see which component is missing.
2. Ensure Python is installed (check with `python --version`).
3. Ensure Node.js is installed (check with `node --version`).
4. Re-run `scripts/setup-portable.bat` to rebuild the environment.
5. Check `logs/error-log.md` for error details.

---

### FFmpeg not found

**Symptom:** Health check shows `[FAIL] FFmpeg not found`

**Fix:**
1. Download FFmpeg from https://ffmpeg.org/download.html
2. Copy `ffmpeg.exe` and `ffprobe.exe` to `bin/ffmpeg/`
3. Re-run health check

---

### Backend fails to start

**Symptom:** Frontend loads but shows "Cannot connect to backend"

**Fixes:**
1. Check if port 8000 is in use by another app
2. Check `logs/error-log.md` for Python errors
3. Try starting backend manually:
   ```batch
   cd app\backend
   ..\..\env\Scripts\python.exe main.py
   ```
4. If `env/` is missing, run `scripts/setup-portable.bat`

---

### Python packages missing

**Symptom:** Backend starts but crashes with `ModuleNotFoundError`

**Fix:**
```batch
scripts\setup-portable.bat
```
This re-installs all packages into `env/`.

---

### App moved to new folder — paths broken

**Symptom:** App opens but can't find project files or media

**Fix:**
All paths should be relative and work automatically.
If issues persist:
1. Run `scripts/health-check.bat`
2. Re-run `scripts/setup-portable.bat` (Python `env/` may need rebuild)
3. Check `config/paths.config.json` — no absolute paths should be stored there

---

### Video won't import

**Symptom:** Drag-drop or file picker does nothing, or shows error

**Fixes:**
1. Verify the file is a supported format: MP4, MOV, AVI, MKV, WebM, M4V, WMV, MTS
2. Verify FFprobe works: check `logs/error-log.md`
3. Try a different video file to isolate the issue
4. Check if the file path contains special characters — rename if needed

---

### Export fails

**Symptom:** Export starts but immediately fails

**Fixes:**
1. Check `logs/error-log.md` for the FFmpeg error message
2. Ensure the `/exports/` folder exists and is writable
3. Ensure enough disk space is available
4. Try exporting with a lower quality preset first
5. Verify all clips on the timeline have valid source files

---

### AI captions not working

**Symptom:** "Generate Captions" button does nothing or shows error

**Fixes:**
1. Ensure Whisper model is downloaded to `models/whisper/`
2. Run `scripts/setup-portable.bat` to download models
3. Check `logs/error-log.md` for Whisper errors
4. Try the "tiny" model first — it's the smallest and fastest

---

### Preview is blank or black

**Symptom:** Timeline has clips but preview shows black

**Fixes:**
1. Ensure at least one video clip is on the video track
2. Move the playhead to where a clip exists
3. Check browser console for JavaScript errors
4. Restart the app

---

### Projects not saving

**Symptom:** Changes are lost when closing and reopening a project

**Fixes:**
1. Check `logs/error-log.md` for SQLite errors
2. Verify `database/app.sqlite` exists and is writable
3. Check disk space

---

### App crashed — "previous session ended unexpectedly" banner

**Symptom:** An amber banner appears at the top of the editor when reopening.

**What it means:** The app did not shut down cleanly last time (process was killed or crashed). Your timeline is safe — the auto-save ran continuously.

**Action:**
1. Click the **Tracker** icon and go to the **Activity** tab to see what happened.
2. Check the **Exports** tab to see if any in-progress export was interrupted.
3. Click **X** on the banner to dismiss it once you've confirmed your project is intact.

---

### Proxy generation fails

**Symptom:** The lightning bolt button spins but no proxy is created; Media panel card never updates.

**Fixes:**
1. Ensure FFmpeg is present at `bin/ffmpeg/ffmpeg.exe` — run `scripts/health-check.bat`.
2. Check `logs/error-log.md` for the FFmpeg error output.
3. Ensure the source file is readable and not corrupted.

---

### Cache stats show 0 MB or are blank

**Symptom:** Settings → Cache shows all zeroes even after importing many files.

**Fixes:**
1. Click the **Refresh** button in the Cache tab.
2. Ensure thumbnails were generated (import at least one media file).
3. If the issue persists, run `scripts/repair.bat` and relaunch.

---

### Production mode: app loads but shows blank page

**Symptom:** `start-prod.bat` launches but the Electron window is white.

**Fixes:**
1. Ensure the frontend was built: `scripts/build-frontend.bat` — it must produce `app/frontend/dist/index.html`.
2. Wait a few seconds — the backend needs to start before the page loads.
3. Check `logs/error-log.md` for backend startup errors.
4. Try running `START.bat` instead — it verifies the build before launching.

---

### Port 8000 already in use

**Symptom:** Backend fails to start with `[Errno 98] Address already in use`

**What happened:** A previous backend process was not cleanly stopped.

**Fix:**
```batch
taskkill /F /IM python.exe
```
Then relaunch the app. Note: Electron is the sole owner of the backend process in production mode — do not start the backend separately via batch script.

---

## Log Files

| File | Contents |
|------|---------|
| `logs/build-log.md` | Phase progress and milestones |
| `logs/error-log.md` | All errors with timestamps and fixes |
| `logs/test-log.md` | Test results per phase |
| `logs/dependency-log.md` | All dependencies with versions |

The Tracker (dashboard icon in Top Bar) → Logs tab also shows live backend log output.

---

## Getting More Help

1. Check `logs/error-log.md` — most issues are logged there.
2. Open Tracker → Health tab — it identifies missing dependencies automatically.
3. Run `scripts/health-check.bat` — it gives specific fix instructions.
4. Run `scripts/repair.bat` — rebuilds env and node_modules without touching user data.
5. See `docs/setup-guide.md` for setup and installation details.
