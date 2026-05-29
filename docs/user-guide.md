# AI Video Studio Pro — User Guide

**Version:** 1.0.0 — Phase 18  
**Last Updated:** 2026-05-29

---

## Table of Contents

1. [Home Dashboard](#home-dashboard)
2. [Creating and Opening Projects](#creating-and-opening-projects)
3. [The Editor Layout](#the-editor-layout)
4. [Importing Media](#importing-media)
5. [Timeline Editing](#timeline-editing)
6. [Preview Playback](#preview-playback)
7. [Text and Captions](#text-and-captions)
8. [Audio Editing](#audio-editing)
9. [Effects and Transitions](#effects-and-transitions)
10. [AI Smart Tools](#ai-smart-tools)
11. [Templates](#templates)
12. [Exporting Your Video](#exporting-your-video)
13. [Project Tracker](#project-tracker)
14. [Settings](#settings)
15. [Plugins](#plugins)
16. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Home Dashboard

The Home dashboard is the first screen you see when launching the app.

### Actions

| Button | Description |
|--------|-------------|
| **+ New Project** | Creates a blank project and opens the editor |
| **Open Project** | Opens a file picker to select an existing project folder |
| **Recent Projects** | Click any card to open that project directly |
| **Templates** | Opens the Template Picker to start from a pre-built layout |

### Recent Projects

Each recent project card shows:
- Project name and thumbnail
- Last modified date
- Duration and clip count
- A trash icon to delete the project (with confirmation)

Hover over a card to reveal the delete button. Deleted projects are permanently removed — there is no recycle bin.

---

## Creating and Opening Projects

### New Project

1. Click **+ New Project** on the Home dashboard.
2. Enter a project name in the dialog.
3. Click **Create** — the editor opens with an empty timeline.

### From Template

1. Click **Templates** on the Home dashboard.
2. Browse templates by category (Social Media, Business, Festival, etc.).
3. Click **Use Template** on any card.
4. Enter a project name.
5. The editor opens with the template's resolution, frame rate, and preset clips applied.

### Opening an Existing Project

Click any recent project card, or use **Open Project** to browse for a project folder manually.

---

## The Editor Layout

The editor has five main areas:

```
┌─────────────────────────────────────────────────────────────┐
│  Top Bar — project name, save indicator, export, tracker    │
├───────────────┬────────────────────────┬────────────────────┤
│               │                        │                    │
│  Left Panel   │    Preview Area        │  Inspector Panel   │
│  (6 tabs)     │                        │  (clip properties) │
│               │                        │                    │
├───────────────┴────────────────────────┴────────────────────┤
│                       Timeline                              │
└─────────────────────────────────────────────────────────────┘
```

### Top Bar

- **Project name** — click to rename
- **Save indicator** — shows "Saved" or "Unsaved changes"
- **Ctrl+S** — manual save (auto-save runs every 30 seconds by default)
- **Export button (Ctrl+E)** — opens the Export dialog
- **Tracker button** — opens the Project Tracker
- **Settings icon** — opens Settings

### Left Panel (6 tabs)

| Tab | Contents |
|-----|----------|
| **Media** | All imported files: video, audio, image |
| **Audio** | Audio tools: waveform extraction, volume, fades |
| **Text** | Text preset library and controls |
| **Effects** | Visual effects, filters, LUT upload |
| **Templates** | Reusable project templates |
| **Plugins** | Installed plugin tools |

### Inspector Panel

The Inspector shows properties for the currently selected timeline clip:
- **Video clips:** start time, duration, playback speed, opacity, effects applied
- **Audio clips:** volume, fade in/out duration, mute toggle, noise reduction
- **Text clips:** content, font size, color, position, animation style

### Timeline

The timeline runs along the bottom of the editor. It contains:
- **Video Track** — the primary video/image track (top)
- **Audio Tracks** — one or more audio tracks below video
- **Subtitle Track** — text overlay clips at the bottom

The timeline ruler shows time in `HH:MM:SS:FF` format. The orange playhead marks the current position.

---

## Importing Media

### Drag and Drop

Drag any video, audio, or image file directly from Windows Explorer onto the Media panel. Multiple files can be dropped at once.

### File Picker

Click the **+ Import** button at the top of the Media panel to open a file browser. Hold Ctrl to select multiple files.

### Supported Formats

| Type | Formats |
|------|---------|
| Video | MP4, MOV, AVI, MKV, WebM, M4V, WMV, FLV, TS, MTS, MXF |
| Audio | MP3, AAC, WAV, FLAC, OGG, M4A, WMA |
| Image | JPG, PNG, GIF, WebP, BMP, TIFF |

### Media Cards

Each imported file appears as a card in the Media panel showing:
- Thumbnail (video/image) or waveform icon (audio)
- File name and duration
- Resolution (video)

**Missing files** show an orange "File missing" overlay if the source was moved or deleted. Re-import the file from its new location to restore it.

### Proxy Generation

For large video files (above 1920px wide), you can generate a 360p proxy for smoother playback:

1. Hover over the video card in the Media panel.
2. Click the **lightning bolt (⚡)** button.
3. The proxy is generated in the background and stored at `projects/{id}/proxies/`.

Note: The proxy is stored for future use. See [Known Limitations](known-limitations.md) for details on proxy playback.

---

## Timeline Editing

### Adding Clips to the Timeline

Drag any clip from the Media panel onto the timeline. Drop it on:
- The **Video Track** — for video and image clips
- An **Audio Track** — for audio clips
- The **Subtitle Track** — for text clips (or use the Text panel to add)

Clips snap to nearby clip edges and to the playhead when dragging. Hold nothing to disable snapping temporarily — or adjust the snap threshold in Settings → Editor.

### Trimming

Drag the **left or right edge** of a clip to trim its in/out point. The clip's source duration is not modified — trimming only changes what portion plays on the timeline.

### Moving

Drag the **center** of a clip to reposition it on the timeline.

### Splitting

1. Move the playhead to where you want to cut.
2. Select the clip.
3. Press **S** — the clip splits into two at the playhead.

### Deleting

Select a clip and press **Delete** to remove it from the timeline. The source file in the Media panel is not affected.

### Undo / Redo

- **Ctrl+Z** — undo the last action
- **Ctrl+Y** — redo

Undo history is capped at 100 steps by default (configurable in Settings → Editor).

### Timeline Zoom and Scroll

| Action | Result |
|--------|--------|
| **Ctrl+Scroll** | Zoom timeline in / out |
| **Scroll** | Scroll timeline horizontally |
| **Home** | Jump playhead to start |
| **End** | Jump playhead to end |

### Track Controls

Each track has a label on the left edge with:
- **Mute toggle (M icon)** — silences all clips on that track during export
- **Lock toggle (padlock icon)** — marks track as locked (stored in project; see Known Limitations for lock behavior during export)

---

## Preview Playback

### Controls

| Action | Result |
|--------|--------|
| **Space** | Play / Pause |
| **[** | Step one frame backward |
| **]** | Step one frame forward |
| Click on timeline ruler | Jump playhead to that position |
| Drag playhead | Scrub through the timeline |

The preview plays the source files in real time. Transitions and text overlays are shown as HTML approximations — the exact composited render will look identical for most effects. See [Known Limitations](known-limitations.md) for details.

### Timecode

The timecode display in the preview area shows the current playhead position in `HH:MM:SS:FF` format.

### Preview Quality

Set preview resolution in Settings → Editor → Preview Quality:
- **Full** — 1:1 source resolution (may stutter on large files)
- **Half** (default) — half resolution, smoother playback
- **Quarter** — lowest resolution, best performance

---

## Text and Captions

### Adding a Text Clip

1. Go to the **Text** tab in the Left Panel.
2. Click any preset card (Title, Subtitle, Lower Third, etc.).
3. A text clip is added to the Subtitle Track at the current playhead position.
4. Select the clip and edit the text, font size, color, and position in the Inspector.

### Text Properties (Inspector)

| Property | Description |
|----------|-------------|
| **Content** | The text to display |
| **Font Size** | Size in pixels |
| **Color** | Text fill color |
| **Background** | Optional background box color and opacity |
| **Position X/Y** | Horizontal and vertical position (0–100%) |
| **Animation** | Fade, slide, pop — applied on clip start/end |

### AI Auto-Captions

Auto-captions use a local Whisper model to transcribe speech and add caption clips to the timeline. No internet is required.

**Requirements:** `faster-whisper` Python package + at least one Whisper model in `models/whisper/`. See Settings → AI Models to download.

**Steps:**
1. Select the video clip you want to caption on the timeline.
2. Click the **CC** (captions) button in the Top Bar or find Auto-Captions in the AI menu.
3. In the Caption Modal:
   - **Step 1:** Select the Whisper model and language
   - **Step 2:** Processing — progress bar shows transcription progress
   - **Step 3:** Review the generated captions, edit any mistakes, then click **Add to Timeline**
4. Caption clips are added to the Subtitle Track.

### Exporting Captions

From the Caption Modal review step, click **Export SRT** or **Export VTT** to save captions as a subtitle file alongside your video.

---

## Audio Editing

### Adjusting Volume

Select an audio clip on the timeline. In the Inspector:
- **Volume** — drag the slider or type a value (0–200%)
- **Mute** — toggle to silence the clip without deleting it

### Fades

In the Inspector for an audio clip:
- **Fade In** — sets the duration of the fade-in at the clip start (in seconds)
- **Fade Out** — sets the duration of the fade-out at the clip end (in seconds)

### Noise Reduction

Enable **Noise Reduction** in the Inspector for any audio clip. This applies FFmpeg's noise reduction filter during export.

### Waveform Visualization

Go to the **Audio** tab in the Left Panel and click **Extract Waveform** on any audio file. The waveform appears as a background visualization on audio track clips in the timeline when **Show Timeline Waveforms** is enabled (Settings → UI).

### Beat Detection

In the Audio tab, click **Detect Beats** on an audio file. The app analyzes the audio and marks beat timestamps. These markers are used by the Beat Sync AI tool to cut video clips at beat positions.

### Audio Track Mixing

Multiple audio tracks are mixed together during export. Use the per-clip volume controls to balance levels. There is no global master volume control — adjust individual clips as needed.

---

## Effects and Transitions

### Applying an Effect

1. Select a video or image clip on the timeline.
2. Go to the **Effects** tab in the Left Panel.
3. Click any preset card — it is applied immediately.
4. Fine-tune individual sliders in the **Custom** section at the bottom of the tab.

### Available Effects

| Effect | Description |
|--------|-------------|
| Brightness | Increase or decrease exposure |
| Contrast | Boost or reduce contrast |
| Saturation | Make colors more vivid or desaturate |
| Exposure | Adjust overall exposure level |
| Blur | Gaussian blur (strength configurable) |
| Sharpen | Edge sharpening |
| Glow | Soft bloom effect |
| Grayscale | Convert to black and white |
| Sepia | Warm sepia tone |
| Film Grain | Add film grain texture |
| Vignette | Darken edges |
| Chromatic Aberration | RGB fringing / glitch effect |
| Vintage | Washed-out vintage look (combines multiple filters) |
| LUT | Load a custom `.cube` LUT file for color grading |

Effects applied to a clip appear as colored badges on the clip in the timeline. Multiple effects can be stacked on a single clip.

### LUT Upload

In the Effects tab, click **Upload LUT** to load a `.cube` LUT file. LUTs are stored in `assets/effects/` and available to all projects.

### Transitions

Transitions apply between two adjacent clips on the Video Track.

1. Click the **gap between two clips** on the timeline.
2. In the Effects tab, select a transition type.
3. Set the transition duration in the Inspector.

| Transition | Description |
|------------|-------------|
| Fade | Crossfade between clips |
| Wipe | Horizontal wipe |
| Slide | Slide in from side |
| Zoom | Scale out / in |
| Xfade | FFmpeg xfade (default for render engine) |

Transitions are rendered using FFmpeg xfade filters in the export — no approximation.

---

## AI Smart Tools

Access all AI tools from the **AI** button group in the Top Bar or within the Effects/Audio tabs.

### Scene Detection

Automatically finds scene changes in a video and splits the clip at each detected cut.

1. Select a video clip on the timeline.
2. Click **Detect Scenes**.
3. Review the list of detected timestamps.
4. Click **Apply** to split the clip at all scene boundaries.

### Silence Removal

Finds and removes silent segments from an audio or video clip.

1. Select a clip on the timeline.
2. Click **Remove Silence**.
3. Adjust the silence threshold (dB) and minimum silence duration.
4. Preview the segments to remove, then click **Apply**.

### Beat Sync

Automatically cuts video clips so edits land on beat markers.

1. Select a music clip in the Media panel (or timeline) and run Beat Detection first.
2. Click **Beat Sync**.
3. Select the target video clips to sync.
4. Click **Apply** — video clips are cut and repositioned to align with detected beats.

### AI Analysis

The AI Analysis tool gives a full health report on the current project.

1. Click the **AI Analysis** button.
2. The analyzer reviews:
   - Track balance (video vs audio coverage)
   - Export settings suitability for the project duration/resolution
   - Suggested export preset for your content
   - Smart resize recommendations for different platforms
3. Apply any recommendation with one click.

---

## Templates

### Browsing Templates

1. Go to the **Templates** tab in the Left Panel.
2. Filter by category: All, Social Media, Business, Festival, Blank.
3. Click any template card to expand its details.
4. Click **Apply** to apply the template layout to the current project, or **Preview** to see it.

### Built-in Templates

| Template | Format | Duration |
|----------|--------|----------|
| Instagram Reel | 9:16 vertical | 30s |
| YouTube Short | 9:16 vertical | 60s |
| TikTok Video | 9:16 vertical | 15s |
| YouTube Standard | 16:9 landscape | 10m |
| Cinematic Trailer | 21:9 ultrawide | 2m |
| Business Promo | 16:9 landscape | 60s |
| Festival Greeting | 1:1 square | 30s |
| Product Showcase | 1:1 square | 45s |
| Podcast Clip | 16:9 landscape | 5m |

### Saving Your Own Template

1. Set up the project how you want it (resolution, tracks, effects, text presets).
2. Click **Save as Template** in the Templates tab.
3. Enter a name and category.
4. The template is saved to `assets/templates/user/` and appears in the list.

---

## Exporting Your Video

### Opening the Export Dialog

Press **Ctrl+E** or click the **Export** button in the Top Bar.

### Choosing a Preset

Select from the preset list or configure manually:

| Preset | Resolution | Bitrate |
|--------|------------|---------|
| Instagram Reel | 1080×1920 | High |
| YouTube 4K | 3840×2160 | Very High |
| YouTube 1080p | 1920×1080 | High |
| Twitter/X | 1280×720 | Medium |
| TikTok | 1080×1920 | High |
| Facebook | 1280×720 | Medium |
| LinkedIn | 1280×720 | Medium |
| Custom | User defined | User defined |

### Export Settings

| Setting | Options |
|---------|---------|
| Resolution | Preset or custom W×H |
| Frame Rate | 24, 25, 30, 60 fps |
| Quality | Low / Medium / High / Very High |
| Codec | H.264 (libx264) or H.265 (libx265) |
| Audio | AAC 192kbps (default) |

### Rendering

Click **Start Export**. A progress bar shows the render percentage. Click **Cancel** to abort at any time.

Exported files are saved to the `exports/` folder with a timestamped filename. The output folder is not configurable from the UI (see [Known Limitations](known-limitations.md)).

Only one export can run at a time. Starting a second export while one is in progress returns an error.

---

## Project Tracker

Open the Tracker by clicking the **dashboard icon** in the Top Bar. It has five tabs:

### Activity Tab

A reverse-chronological log of all project events: imports, exports, AI jobs, saves, errors.

### Exports Tab

History of all completed exports with filename, preset, duration, and file size.

### AI Jobs Tab

History of all AI operations: captions, scene detections, silence removals, beat syncs, and their durations.

### Logs Tab

Live view of the app's backend log. Use the **Refresh** button to pull the latest entries. Filter by log level (INFO, WARNING, ERROR).

### Health Tab

System health check with three sections:

**Dependencies** — checks FFmpeg, FFprobe, Python packages, and optional AI components (Whisper, numpy).

**Storage** — shows disk usage for each folder (projects, exports, cache, temp) with a visual bar.

**Process Memory** — shows the backend's current RAM usage as a percentage of system memory with a color-coded bar (green → amber at 60% → red at 85%).

### Plugins Tab

Lists all plugins found in the `plugins/` folder with enable/disable toggles and error log viewer. See [Plugins](#plugins) for more.

---

## Settings

Open Settings from the gear icon in the Top Bar.

### Editor Tab

| Setting | Description |
|---------|-------------|
| Auto-save interval | How often the project auto-saves (seconds) |
| Max undo history | Maximum undo steps (default: 100) |
| Default preview quality | Full / Half / Quarter |
| Snap to clips | Enable/disable clip edge snapping |
| Snap to playhead | Enable/disable playhead snapping |
| Snap threshold | Distance in pixels that triggers a snap |

### Cache Tab

Shows disk usage per cache category:

| Category | Contents |
|----------|----------|
| Thumbnails | Media panel preview images |
| Temp | Intermediate processing files |
| Exports | Rendered video files |
| Proxies | Generated 360p proxy files |

Click **Clear** next to any category to delete those files. Click **Enforce Limit** to trim the cache to the configured maximum size.

The max cache size is set in GB. Auto-enforcement on save is disabled by default — run it manually or enable **Auto-clean on start** to enforce it at launch.

### AI Models Tab

Shows the status of each AI component:

- **FFmpeg** — required for all AI tools
- **numpy** — required for beat detection
- **faster-whisper** — required for auto-captions

For Whisper, download individual models (tiny/base/small/medium/large-v3) from this tab. Models are saved to `models/whisper/`.

---

## Plugins

Plugins extend the app with custom tools. They are loaded from the `plugins/` folder.

### Installing a Plugin

1. Place the plugin folder inside `plugins/` (e.g., `plugins/my-plugin/`).
2. The plugin folder must contain a `plugin.json` manifest and a Python entry point.
3. Restart the app — the plugin appears in the Plugins tab of the Tracker.

### Enabling / Disabling

Toggle the switch next to any plugin in the Tracker → Plugins tab. Changes take effect on next app launch.

### Sample Plugin

A sample plugin is included at `plugins/sample/`. It demonstrates the plugin API with three endpoints: ping, info, and text-ideas. Review it as a starting template for custom plugins.

### Plugin Errors

If a plugin fails to load, the error is shown in the Plugins tab under the plugin's entry. Fix the error and restart.

---

## Keyboard Shortcuts

See `docs/keyboard-shortcuts.md` for the complete reference.

### Quick Reference

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `[` / `]` | Step frame backward / forward |
| `Home` / `End` | Jump to start / end |
| `S` | Split clip at playhead |
| `Delete` | Delete selected clip |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+S` | Save project |
| `Ctrl+E` | Open Export dialog |
| `Ctrl+Scroll` | Zoom timeline |
| `Scroll` | Scroll timeline horizontally |
