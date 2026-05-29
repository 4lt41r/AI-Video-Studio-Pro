// ── Project ───────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
  thumbnail?: string
  duration_s: number
  aspect_ratio: string   // e.g. "16:9", "9:16", "1:1"
  width: number
  height: number
  fps: number
}

// ── Media ─────────────────────────────────────────────────────────────────────

export type MediaType = 'video' | 'audio' | 'image'

export interface MediaItem {
  id: string
  project_id: string
  name: string
  path: string
  type: MediaType
  duration_s?: number
  width?: number
  height?: number
  fps?: number
  size_bytes: number
  thumbnail?: string
  proxy_path?: string
  has_audio?: boolean
  created_at: string
  missing?: boolean
}

// ── Text ─────────────────────────────────────────────────────────────────────

export interface TextStyle {
  font:         string
  size:         number
  color:        string   // hex, e.g. "#ffffff"
  bg_color:     string   // hex with optional alpha, e.g. "#000000cc" or ""
  bold:         boolean
  italic:       boolean
  align:        'left' | 'center' | 'right'
  x_pct:        number   // 0–100 horizontal center as % of frame width
  y_pct:        number   // 0–100 vertical center as % of frame height
  shadow:       boolean
  stroke_width: number   // 0 = none
  stroke_color: string
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font:         'Arial',
  size:         36,
  color:        '#ffffff',
  bg_color:     '',
  bold:         false,
  italic:       false,
  align:        'center',
  x_pct:        50,
  y_pct:        85,
  shadow:       true,
  stroke_width: 0,
  stroke_color: '#000000',
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export type TrackType = 'video' | 'audio' | 'subtitle' | 'overlay' | 'effect'

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  locked: boolean
  visible: boolean
  clips: Clip[]
}

export interface Clip {
  id: string
  track_id: string
  media_id: string
  start_s: number        // position on timeline
  end_s: number          // position on timeline
  source_start_s: number // trim start in source file
  source_end_s: number   // trim end in source file
  speed: number          // 1.0 = normal
  volume: number         // 0.0 – 2.0
  effects: ClipEffect[]
  // Audio editing
  fade_in_s?:       number   // seconds, 0 = no fade
  fade_out_s?:      number
  mute_audio?:      boolean
  noise_reduction?: number   // 0–10 strength
  // Transition entering this clip (applied at cut from previous clip)
  transition?: { type: string; duration_s: number }
  // Text/caption clips (media_id is "" for these)
  text_content?: string
  text_style?:   TextStyle
}

export interface ClipEffect {
  id: string
  type: string
  params: Record<string, unknown>
}

export interface TimelineState {
  project_id: string
  tracks: Track[]
  duration_s: number
  saved_at: string
  version: number
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'done' | 'failed'
export type JobType = 'export' | 'caption' | 'thumbnail' | 'scene_detect' | 'waveform'

export interface Job {
  id: string
  type: JobType
  project_id?: string
  status: JobStatus
  progress: number       // 0 – 100
  result?: unknown
  error?: string
  created_at: string
  updated_at: string
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface ExportPreset {
  id: string
  name: string
  category: string
  width: number
  height: number
  fps: number
  video_codec: string
  audio_codec: string
  video_bitrate: string
  audio_bitrate: string
  crf: number
  container: string
  description: string
  is_custom?: boolean
}

// ── System / Health ───────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error'
  version: string
  phase: number
  uptime_s: number
  ffmpeg_available: boolean
  database_ok: boolean
}

// ── UI ────────────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light' | 'system'
export type PanelId = 'media' | 'tools' | 'inspector' | 'export' | 'ai'
