# AI Video Studio Pro — QA Report
**Phase 17 — Final QA**
**Date:** 2026-05-29
**Version:** 0.1.0-alpha (Phase 17)

---

## Summary

Full code audit across all 15 backend files, 11 engine files, and all critical frontend components. Four bugs found and fixed. No additional issues found in the core workflows.

**Result: PASS — Ready for Phase 18 (Production Release)**

---

## Bugs Found and Fixed

### Bug 1 — CacheTab stats key mismatch (Critical)
**File:** `app/frontend/src/components/dialogs/SettingsModal.tsx`
**Symptom:** Cache stats panel would show `0 MB` for all categories, and total would always be `0.0 MB`.
**Root cause:** Frontend used flat keys (`stats.thumbnails_mb`) but backend `GET /api/cache/stats` returns nested objects (`stats.thumbnails.size_mb`).
**Fix:** Updated `categories` array to use category keys (`thumbnails`, `temp`, etc.) and access `stats[key]?.size_mb`. Total now reads `stats.total_mb` directly.

### Bug 2 — Double backend start / orphaned process (Critical)
**Files:** `scripts/start-app.bat`, `scripts/start-prod.bat`
**Symptom:** Two Python backend processes start on port 8000. Second one fails to bind and exits. When app closes, Electron's `stopBackend()` kills only its own child (the failed process), leaving the batch-started backend running as an orphan.
**Root cause:** Both batch scripts started the backend via `start /min cmd /c python main.py` AND Electron's `main.js` also calls `startBackend()` on `app.whenReady()`.
**Fix:** Removed backend start from both batch scripts. Electron is the sole backend owner — it spawns it, manages it, and kills it on close.

### Bug 3 — Proxy engine missing FFmpeg fallback (Medium)
**File:** `app/backend/engines/proxy_engine.py`
**Symptom:** `generate()` crashes with `FileNotFoundError` when `bin/ffmpeg/ffmpeg.exe` doesn't exist, instead of gracefully falling back to system `ffmpeg`.
**Root cause:** Used `str(config.FFMPEG_PATH)` unconditionally. Every other engine (render, waveform, thumbnail, ffprobe) has an `if config.FFMPEG_PATH.exists() else "ffmpeg"` guard.
**Fix:** Added the same guard: `ffmpeg_bin = str(config.FFMPEG_PATH) if config.FFMPEG_PATH.exists() else "ffmpeg"`.

### Bug 4 — proxy_path column missing from CREATE TABLE schema (Low)
**File:** `app/backend/database.py`
**Symptom:** No immediate crash — the Phase 15 migration adds the column after schema creation. But on a fresh install the schema and migration were inconsistent.
**Root cause:** `proxy_path TEXT` was only in the migration, not in the `CREATE TABLE media` definition.
**Fix:** Added `proxy_path TEXT` to the `CREATE TABLE` statement. The migration still runs (fails silently on existing DBs where the column already exists) — existing databases are unaffected.

---

## Workflow Coverage

| Workflow | Files Reviewed | Result |
|---|---|---|
| Project creation / management | `projects.py`, `Home.tsx`, `Editor.tsx` | ✅ Pass |
| Media import | `media.py`, `ffprobe_engine.py`, `thumbnail_engine.py`, `MediaPanel.tsx` | ✅ Pass |
| Timeline editing | `timeline.ts`, `Timeline.tsx`, `render_engine.py` | ✅ Pass |
| Preview playback | `PreviewArea.tsx`, timeline store | ✅ Pass |
| FFmpeg export (all presets) | `export.py`, `render_engine.py`, `export-presets.json` | ✅ Pass |
| AI captions (Whisper) | `caption.py`, `whisper_engine.py`, `CaptionModal.tsx` | ✅ Pass |
| Beat sync / scene / silence | `ai_engine.py`, 3 modals | ✅ Pass |
| Text overlays and templates | `template_engine.py`, `TemplatesPanel.tsx`, `SaveTemplateModal.tsx` | ✅ Pass |
| Audio editing | `waveform_engine.py`, `AudioPanel.tsx`, fade/noise filters | ✅ Pass |
| Effects and transitions | `_effects_to_vf()`, `EffectsPanel.tsx`, xfade chain | ✅ Pass |
| Crash recovery | Sentinel in `main.py`, banner in `Editor.tsx`, `system.py` | ✅ Pass |
| Proxy generation | `proxy_engine.py` (Bug 3 fixed) | ✅ Pass after fix |
| Cache management | `cache_engine.py`, `SettingsModal.tsx` (Bug 1 fixed) | ✅ Pass after fix |
| Timeline backups | `timeline.py`, prune logic, restore endpoint | ✅ Pass |
| Plugin system | `plugin_engine.py`, `TrackerModal.tsx` Plugins tab | ✅ Pass |
| Production launcher | `start-prod.bat` (Bug 2 fixed), `START.bat`, SPA serving | ✅ Pass after fix |
| Portability | All paths via `config.py` ROOT = `Path(__file__).resolve().parent.parent.parent` | ✅ Pass |
| Missing deps behavior | `TrackerModal.tsx` Health tab, dep grid, FFmpeg fallbacks | ✅ Pass |

---

## Known Limitations

These are pre-existing design constraints, not bugs:

1. **Whisper not pre-installed** — AI captions require `faster-whisper` and a downloaded model. The app degrades gracefully but the feature is unavailable until the user installs them.
2. **Single-stream export** — Only one export can run at a time (enforced with 409 if busy). Multiple concurrent exports are not supported.
3. **No video preview seek in editor** — Preview uses `<video>` elements with `src` swapping at clip boundaries; true frame-accurate scrubbing is not supported.
4. **No cloud sync** — All data is local. No backup to external service.
5. **Windows only** — Batch scripts and file picker use PowerShell/Windows-native APIs. macOS/Linux would need shell script equivalents.

---

## Portability Verification

- All Python paths resolved via `ROOT = Path(__file__).resolve().parent.parent.parent`
- No `C:\` or absolute paths hardcoded in backend (system fonts are checked but have fallbacks)
- All scripts use `%~dp0` or `%ROOT%` for relative navigation
- Electron `main.js` uses `path.resolve(__dirname, '..', '..')` for ROOT
- `START.bat` uses `cd /d "%~dp0"` to navigate to its own directory

---

*QA completed: 2026-05-29*
