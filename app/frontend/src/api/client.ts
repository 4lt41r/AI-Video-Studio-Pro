import { useUIStore } from '../store/ui'

function getBase(): string {
  return useUIStore.getState().backendUrl
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public path: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = getBase()
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  let res: Response
  try {
    res = await fetch(`${base}${path}`, opts)
  } catch {
    throw new APIError(`Network error: cannot reach backend at ${base}`, 0, path)
  }

  if (res.status === 204) return null as T

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new APIError(`Invalid JSON from server (${res.status})`, res.status, path)
  }

  if (!res.ok) {
    const d = data as Record<string, unknown>
    const msg = (d?.detail ?? d?.message ?? `HTTP ${res.status}`) as string
    throw new APIError(msg, res.status, path)
  }

  return data as T
}

export const api = {
  get:    <T>(path: string)                => req<T>('GET',    path),
  post:   <T>(path: string, body?: unknown) => req<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown) => req<T>('PUT',    path, body),
  delete: <T>(path: string)                => req<T>('DELETE', path),
}

// ── System ────────────────────────────────────────────────────────────────────
export const fetchHealth   = () => api.get<import('../types').HealthStatus>('/api/health')
export const systemRestart = () => api.post<{ status: string }>('/api/system/restart')

// ── Projects ──────────────────────────────────────────────────────────────────
export const fetchProjects  = ()           => api.get<{ projects: unknown[] }>('/api/projects')
export const createProject  = (data: unknown) => api.post('/api/projects', data)
export const fetchProject   = (id: string)  => api.get(`/api/projects/${id}`)
export const deleteProject  = (id: string)  => api.delete(`/api/projects/${id}`)

// ── Media ─────────────────────────────────────────────────────────────────────
export const fetchMedia     = (projectId: string) => api.get(`/api/projects/${projectId}/media`)
export const importMedia    = (projectId: string, data: unknown) =>
  api.post(`/api/projects/${projectId}/media`, data)
export const deleteMedia    = (projectId: string, mediaId: string) =>
  api.delete(`/api/projects/${projectId}/media/${mediaId}`)

// ── Timeline ──────────────────────────────────────────────────────────────────
export const fetchTimeline  = (projectId: string) => api.get(`/api/projects/${projectId}/timeline`)
export const saveTimeline   = (projectId: string, state: unknown) =>
  api.put(`/api/projects/${projectId}/timeline`, state)

// ── Export ────────────────────────────────────────────────────────────────────
export const startExport    = (data: unknown) => api.post('/api/export', data)
export const cancelExport   = (id: string)    => api.post(`/api/export/${id}/cancel`)
export const fetchExportPresets = () => api.get('/api/export/presets')

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const fetchJob       = (id: string) => api.get(`/api/jobs/${id}`)
export const fetchJobs      = ()           => api.get('/api/jobs')

// ── Audio / Waveform ──────────────────────────────────────────────────────────
export const fetchWaveform     = (projectId: string, mediaId: string, peaks = 200) =>
  api.get<{ peaks: number[] }>(`/api/projects/${projectId}/media/${mediaId}/waveform?peaks=${peaks}`)
export const extractMediaAudio = (projectId: string, mediaId: string) =>
  api.post(`/api/projects/${projectId}/media/${mediaId}/extract-audio`)

// ── Captions ──────────────────────────────────────────────────────────────────
export const fetchCaptionModels  = () => api.get<{ models: unknown[]; whisper_available: boolean }>('/api/caption/models')
export const startTranscription  = (data: { media_path: string; model: string; language: string | null }) =>
  api.post<{ job_id: string; status: string }>('/api/caption/transcribe', data)
export const fetchCaptionJob     = (jobId: string) => api.get<{ job_id: string; status: string; progress: number; segments: unknown[] | null; error: string | null }>(`/api/caption/${jobId}`)
export const cancelCaptionJob    = (jobId: string) => api.delete(`/api/caption/${jobId}`)

// ── Templates ─────────────────────────────────────────────────────────────────
export const fetchTemplates     = () => api.get<{ templates: unknown[] }>('/api/templates')
export const fetchTemplate      = (id: string) => api.get('/api/templates/' + id)
export const saveTemplate       = (data: unknown) => api.post('/api/templates', data)
export const deleteTemplate     = (id: string) => api.delete('/api/templates/' + id)
export const applyTemplate      = (id: string, projectId: string) =>
  api.post('/api/templates/' + id + '/apply', { project_id: projectId })

// ── Text Presets ──────────────────────────────────────────────────────────────
export const fetchTextPresets   = () => api.get<{ presets: unknown[] }>('/api/presets/text')
export const saveTextPreset     = (data: { name: string; style: unknown }) => api.post('/api/presets/text', data)
export const deleteTextPreset   = (id: string) => api.delete('/api/presets/text/' + id)

// ── AI Tools ──────────────────────────────────────────────────────────────────
export const startSceneDetect  = (data: { media_path: string; threshold?: number }) =>
  api.post<{ job_id: string; status: string }>('/api/ai/scene-detect', data)

export const startSilenceDetect = (data: { media_path: string; noise_threshold_db?: number; min_duration_s?: number }) =>
  api.post<{ job_id: string; status: string }>('/api/ai/silence-detect', data)

export const startBeatDetect   = (data: { media_path: string; sensitivity?: number }) =>
  api.post<{ job_id: string; status: string }>('/api/ai/beat-detect', data)

export const startHighlights   = (data: { media_path: string; highlight_count?: number; segment_duration_s?: number }) =>
  api.post<{ job_id: string; status: string }>('/api/ai/highlights', data)

export const fetchAIJob        = (jobId: string) =>
  api.get<{ job_id: string; status: string; progress: number; result: unknown; error: string | null }>(`/api/ai/job/${jobId}`)

export const cancelAIJob       = (jobId: string) =>
  api.delete(`/api/ai/job/${jobId}`)

export const analyzeProject    = (data: { timeline_state: unknown; media_items: unknown[]; project: unknown }) =>
  api.post('/api/ai/analyze-project', data)

export const getSmartResize    = (data: { source_width: number; source_height: number }) =>
  api.post<{ options: unknown[] }>('/api/ai/smart-resize', data)

export const getExportRecs     = (data: { timeline_state: unknown; media_items: unknown[]; project: unknown }) =>
  api.post('/api/ai/export-recommendations', data)

// ── Performance / Stability (Phase 15) ───────────────────────────────────────
export const generateProxy       = (projectId: string, mediaId: string) =>
  api.post(`/api/projects/${projectId}/media/${mediaId}/proxy`)
export const fetchTimelineBackups = (projectId: string) =>
  api.get<{ backups: unknown[] }>(`/api/projects/${projectId}/timeline/backups`)
export const restoreTimelineBackup = (projectId: string, filename: string) =>
  api.post(`/api/projects/${projectId}/timeline/restore/${encodeURIComponent(filename)}`)
export const fetchCacheStats     = ()           => api.get('/api/cache/stats')
export const clearCacheTemp      = ()           => api.post('/api/cache/clear-temp')
export const clearCacheThumbnails = ()          => api.post('/api/cache/clear-thumbnails')
export const fetchCrashState     = ()           => api.get<{ crashed: boolean; last_project_id: string | null }>('/api/system/crash-state')
export const clearCrashState     = ()           => api.post('/api/system/crash-state/clear')
export const fetchSystemInfo     = ()           => api.get('/api/system/info')

// ── Plugins (Phase 14) ───────────────────────────────────────────────────────
export const fetchPlugins    = ()           => api.get<{ plugins: unknown[] }>('/api/plugins')
export const enablePlugin    = (id: string) => api.post(`/api/plugins/${id}/enable`)
export const disablePlugin   = (id: string) => api.post(`/api/plugins/${id}/disable`)
export const deletePlugin    = (id: string) => api.delete(`/api/plugins/${id}`)
export const fetchPluginLog  = (id: string) => api.get(`/api/plugins/${id}/log`)

// ── Tracker / System (Phase 13) ───────────────────────────────────────────────
export const fetchSystemLogs    = ()                => api.get<{ logs: unknown[] }>('/api/system/logs')
export const readSystemLog      = (filename: string, lines = 300) =>
  api.get(`/api/system/logs/${encodeURIComponent(filename)}?lines=${lines}`)
export const fetchSystemDeps    = ()                => api.get('/api/system/deps')
export const fetchExportHistory = (limit = 30)     => api.get(`/api/export/history?limit=${limit}`)
export const fetchAIJobs        = ()                => api.get<{ jobs: unknown[] }>('/api/ai/jobs')

// ── File picker (Electron IPC or HTTP fallback) ───────────────────────────────
export async function pickFiles(opts: { multiple?: boolean; type?: 'video' | 'audio' | 'image' | 'any' } = {}): Promise<string[]> {
  const el = (window as any).electronAPI
  if (el?.pickFile) {
    const result = await el.pickFile(opts)
    if (result.cancelled) return []
    return result.paths ?? (result.path ? [result.path] : [])
  }
  const multi = opts.multiple ? '?multiple=true' : ''
  const result = await api.get<{ paths?: string[]; path?: string; cancelled: boolean }>(
    `/api/system/pick-file${multi}`
  )
  if (result.cancelled) return []
  return result.paths ?? (result.path ? [result.path] : [])
}

export async function pickFolder(): Promise<string | null> {
  const el = (window as any).electronAPI
  if (el?.pickFolder) {
    const result = await el.pickFolder()
    return result.cancelled ? null : result.path
  }
  const result = await api.get<{ path: string; cancelled: boolean }>('/api/system/pick-folder')
  return result.cancelled ? null : result.path
}
