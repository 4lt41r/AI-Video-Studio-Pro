# AI Video Studio Pro — Architecture

**Version:** 0.1.0-alpha  
**Last Updated:** 2026-05-28

---

## System Overview

AI Video Studio Pro is a multi-process desktop application with three main processes:

```
┌─────────────────────────────────────────────────────┐
│                    Electron Process                  │
│   ┌─────────────────────────────────────────────┐   │
│   │          React Frontend (Renderer)          │   │
│   │   Dashboard │ Editor │ Timeline │ Preview   │   │
│   └──────────────────┬──────────────────────────┘   │
│                      │ HTTP / IPC                    │
└──────────────────────┼──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Python FastAPI        │
          │   Backend Service       │
          │   :8000                 │
          │                         │
          │  ┌─────────────────┐   │
          │  │  Task Queue     │   │
          │  │  (async)        │   │
          │  └────────┬────────┘   │
          │           │             │
          │  ┌────────▼────────┐   │
          │  │  FFmpeg Engine  │   │
          │  │  (subprocess)   │   │
          │  └────────┬────────┘   │
          │           │             │
          │  ┌────────▼────────┐   │
          │  │  AI Models      │   │
          │  │  (Whisper, etc) │   │
          │  └─────────────────┘   │
          │                         │
          │  ┌─────────────────┐   │
          │  │  SQLite DB      │   │
          │  │  /database/     │   │
          │  └─────────────────┘   │
          └─────────────────────────┘
```

---

## Process Architecture

### 1. Electron Main Process (`app/desktop/main.js`)
- Manages the application window lifecycle
- Launches the Python backend subprocess
- Handles IPC (Inter-Process Communication) for:
  - Native file/folder picker dialogs
  - System tray integration
  - App settings persistence
  - Window state (size, position, fullscreen)
- Injects backend URL into renderer via `window.__APP_API__`
- Monitors backend health; restarts if crashed

### 2. React Frontend (`app/frontend/`)
- Runs in Electron renderer process (Chromium)
- Communicates with backend via HTTP REST API
- Real-time updates via WebSocket (`/ws`)
- State management: Zustand (lightweight, no Redux overhead)
- Timeline rendering: Canvas API (custom, no heavy library)
- Video preview: HTML5 `<video>` element with proxy support
- Routing: React Router (SPA, no server routing needed)

### 3. Python FastAPI Backend (`app/backend/`)
- HTTP API server on `127.0.0.1:8000`
- WebSocket endpoint for real-time job updates
- Manages:
  - Project CRUD (SQLite)
  - Media import and metadata extraction (FFprobe)
  - Thumbnail generation (FFmpeg)
  - Export job queue
  - AI inference jobs (Whisper, scene detection)
  - File system operations (safe, sandboxed to project folder)

---

## Data Flow

### Media Import Flow
```
User selects file
    → Electron IPC → native file dialog
    → Frontend sends POST /api/media/import
    → Backend validates file path
    → FFprobe extracts metadata
    → FFmpeg generates thumbnail
    → Record saved to SQLite
    → WebSocket event → frontend updates media library
```

### Export Flow
```
User clicks Export
    → Frontend sends POST /api/export/start {timeline_state}
    → Backend queues export job
    → Worker thread builds FFmpeg command
    → FFmpeg processes video
    → Progress events sent via WebSocket
    → Frontend shows progress bar
    → On complete: file saved to /exports/
    → WebSocket event → frontend shows "Export complete"
```

### AI Caption Flow
```
User clicks "Auto Caption"
    → Frontend sends POST /api/ai/caption {video_path}
    → Backend extracts audio (FFmpeg)
    → Whisper model transcribes audio
    → Transcript → subtitle clips
    → WebSocket event → timeline updates with subtitle track
```

---

## Database Schema

**File:** `database/app.sqlite`

```sql
-- Projects
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,  -- UUID
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    thumbnail   TEXT,
    duration_s  REAL DEFAULT 0,
    settings    TEXT             -- JSON blob
);

-- Media clips in a project
CREATE TABLE media (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id),
    name        TEXT NOT NULL,
    path        TEXT NOT NULL,
    type        TEXT NOT NULL,  -- video | audio | image
    duration_s  REAL,
    width       INTEGER,
    height      INTEGER,
    fps         REAL,
    size_bytes  INTEGER,
    thumbnail   TEXT,
    created_at  TEXT NOT NULL
);

-- Timeline state (saved as JSON blob per project)
CREATE TABLE timelines (
    project_id  TEXT PRIMARY KEY REFERENCES projects(id),
    state       TEXT NOT NULL,  -- full JSON timeline state
    version     INTEGER DEFAULT 1,
    saved_at    TEXT NOT NULL
);

-- Export history
CREATE TABLE exports (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id),
    preset      TEXT,
    output_path TEXT,
    status      TEXT,  -- pending | processing | done | failed
    started_at  TEXT,
    finished_at TEXT,
    error       TEXT,
    settings    TEXT   -- JSON
);

-- App jobs (AI, thumbnails, etc.)
CREATE TABLE jobs (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,  -- caption | thumbnail | scene_detect | etc.
    project_id  TEXT,
    status      TEXT NOT NULL,  -- pending | running | done | failed
    progress    REAL DEFAULT 0,
    result      TEXT,           -- JSON
    error       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

---

## File System Layout (Portable)

All paths are relative to the project root (`ROOT`).

```python
ROOT = Path(__file__).resolve().parents[2]  # app/backend → ROOT

PATHS = {
    "projects":  ROOT / "projects",
    "uploads":   ROOT / "uploads",
    "exports":   ROOT / "exports",
    "cache":     ROOT / "cache",
    "temp":      ROOT / "temp",
    "database":  ROOT / "database" / "app.sqlite",
    "models":    ROOT / "models",
    "ffmpeg":    ROOT / "bin" / "ffmpeg" / "ffmpeg.exe",
    "ffprobe":   ROOT / "bin" / "ffmpeg" / "ffprobe.exe",
    "assets":    ROOT / "assets",
    "logs":      ROOT / "logs",
    "config":    ROOT / "config",
    "plugins":   ROOT / "plugins",
}
```

**Rule:** No absolute paths are ever stored in the database or config files.
All stored paths are relative to ROOT. The backend resolves them at runtime.

---

## Security Model

- **Path validation:** All file operations validated against allowed base directories
- **Path traversal prevention:** `..` sequences rejected; paths normalized and compared
- **File type validation:** MIME type and extension checked before processing
- **No network access:** Backend only listens on `127.0.0.1`, never `0.0.0.0`
- **Model isolation:** AI models run in subprocess with no network access
- **Plugin sandboxing:** Plugins run in isolated context with limited API surface

---

## Frontend Architecture

```
app/frontend/src/
├── main.tsx              Entry point
├── App.tsx               Root component with router
├── store/                Zustand state stores
│   ├── project.ts        Active project state
│   ├── timeline.ts       Timeline state (tracks, clips, playhead)
│   ├── media.ts          Media library state
│   ├── ui.ts             UI state (panels, modals, theme)
│   └── jobs.ts           Background job state
├── pages/
│   ├── Home.tsx          Dashboard / project list
│   └── Editor.tsx        Full editor layout
├── components/
│   ├── layout/           AppShell, Sidebar, TopBar
│   ├── timeline/         Timeline, Track, Clip, Playhead
│   ├── preview/          VideoPlayer, PreviewCanvas
│   ├── panels/
│   │   ├── MediaPanel.tsx
│   │   ├── ToolsPanel.tsx
│   │   ├── InspectorPanel.tsx
│   │   └── ExportPanel.tsx
│   ├── dialogs/          Modals and overlays
│   └── ui/               Shared UI primitives
├── api/                  HTTP client functions
├── hooks/                Custom React hooks
├── utils/                Helper functions
└── types/                TypeScript type definitions
```

---

## Backend Architecture

```
app/backend/
├── main.py               FastAPI app entry point
├── config.py             Paths and settings loader
├── database.py           SQLite connection and migrations
├── api/
│   ├── projects.py       Project CRUD endpoints
│   ├── media.py          Media import/list endpoints
│   ├── timeline.py       Timeline save/load endpoints
│   ├── export.py         Export job endpoints
│   ├── ai.py             AI tool endpoints
│   ├── system.py         Health, stats, system endpoints
│   └── websocket.py      WebSocket manager
├── engines/
│   ├── ffmpeg.py         FFmpeg command builder
│   ├── ffprobe.py        Media metadata extractor
│   ├── thumbnail.py      Thumbnail generator
│   ├── renderer.py       Timeline → FFmpeg render
│   ├── caption.py        Whisper caption engine
│   └── scene.py          Scene detection engine
├── models/               Pydantic data models
├── queue/                Async job queue
└── utils/                Path resolver, validators
```

---

## Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Desktop wrapper | Electron | Mature ecosystem, works with React, native dialogs |
| Backend language | Python | FFmpeg bindings, Whisper, OpenCV all Python-native |
| Frontend framework | React + TypeScript | Component model ideal for editor UI |
| Styling | Tailwind CSS | Utility-first, fast iteration, dark mode trivial |
| State management | Zustand | Simpler than Redux, works well with TypeScript |
| Timeline rendering | Canvas API | Full control, no heavy dependency, performant |
| Database | SQLite | Zero-config, portable, single file |
| Video engine | FFmpeg | Industry standard, vast format support |
| AI captions | Whisper/faster-whisper | Best offline speech-to-text, MIT licensed |
| API communication | REST + WebSocket | REST for CRUD, WebSocket for live job progress |
