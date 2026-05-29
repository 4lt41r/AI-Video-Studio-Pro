# AI Video Studio Pro — Known Limitations

**Version:** 1.0.0 — Phase 18  
**Last Updated:** 2026-05-29

This document describes confirmed limitations of the current release. These are not bugs — they are design constraints or deferred features.

---

## Platform

| Limitation | Detail |
|---|---|
| **Windows only** | Batch scripts, the file picker fallback, and the native dialog system are Windows-specific. macOS/Linux support requires shell script equivalents and is not currently provided. |
| **Node.js and Python required on host** | The `env/` folder contains Python packages but not a Python interpreter. Node.js and Python must be installed on the host machine. The app is portable in the sense that no system-wide packages are installed, but the runtimes themselves must be present. |

---

## Video Export

| Limitation | Detail |
|---|---|
| **One export at a time** | Only one FFmpeg render can run concurrently. Starting a second export while one is running returns HTTP 409. |
| **No hardware acceleration** | The render engine uses software `libx264` / `libx265`. GPU-accelerated codecs (`h264_nvenc`, `hevc_nvenc`) are not wired up. |
| **No output folder picker** | Exports always go to the `exports/` folder. Custom output paths are not configurable from the UI. |

---

## Preview Playback

| Limitation | Detail |
|---|---|
| **No frame-accurate scrubbing** | The preview uses HTML `<video>` elements with source-swapping at clip boundaries. True frame-accurate seek across cuts is not supported. |
| **Effects preview uses CSS filters only** | Color/visual effects (brightness, contrast, LUTs) are approximated in the preview via CSS filters. The exact FFmpeg result will differ slightly. |
| **No real-time render preview** | The preview plays the original source files, not a rendered composite. Transitions, speed changes, and text overlays are shown as HTML overlays, not as true composited output. |

---

## AI Features

| Limitation | Detail |
|---|---|
| **Whisper not pre-installed** | Auto-captions require `faster-whisper` (Python package) and at least one Whisper model downloaded to `models/whisper/`. Neither is included in the base install. Instructions are in Settings → AI Models. |
| **AI tools require FFmpeg** | Scene detection, silence removal, beat detection, and highlight extraction all use FFmpeg for media analysis. They will not work if FFmpeg is missing. |
| **Beat detection requires numpy** | The beat detection engine uses numpy for audio analysis. If numpy is missing, beat detection returns an empty result. |

---

## Timeline

| Limitation | Detail |
|---|---|
| **No multi-clip drag** | Only one clip can be dragged at a time. Selecting and moving a group of clips is not supported. |
| **No track locking in render** | The `locked` track property is stored but not enforced during export — locked track clips are still rendered. |
| **No timeline markers** | Named markers or chapter points on the timeline ruler are not supported. |
| **Text clips use subtitle track only** | Text overlays are always placed on the subtitle track. Multiple independent text tracks are not supported. |

---

## Media

| Limitation | Detail |
|---|---|
| **No in-app media download** | Media files must already exist on disk. Downloading from URLs or cloud storage is not supported. |
| **Proxy playback not automatic** | Generating a proxy (low-res preview file) must be triggered manually via the Zap button on each video card. The proxy is not automatically used for playback — it is stored for potential future use. |
| **Missing files not re-linked** | If a source file is moved or deleted, the clip shows a "File missing" overlay. There is no re-link dialog to point it to a new path. |

---

## Plugins

| Limitation | Detail |
|---|---|
| **Plugins require app restart** | Enabling or disabling a plugin takes effect on next app launch, not immediately. |
| **No plugin marketplace** | Plugins must be manually placed in the `plugins/` directory. There is no in-app install or download flow. |

---

## Cache and Storage

| Limitation | Detail |
|---|---|
| **Cache size limit not auto-enforced** | The max cache size setting in Settings → Cache is stored but not automatically enforced on every save. Run "Enforce Limit" manually or it runs at startup if configured. |
| **Thumbnails not regenerated after clear** | Clearing thumbnails removes the `.jpg` files but does not re-trigger generation. Thumbnails are regenerated only on next media import. |

---

## Portability

| Limitation | Detail |
|---|---|
| **Python env may need rebuild after OS move** | Moving the folder across Windows versions or Python major versions (e.g., 3.10 → 3.12) may break the `env/` venv. Run `scripts/repair.bat` to rebuild. |
| **Node version sensitivity** | `node_modules/` may not transfer cleanly across Node major versions. Run `scripts/repair.bat` if the app fails to start after an upgrade. |
