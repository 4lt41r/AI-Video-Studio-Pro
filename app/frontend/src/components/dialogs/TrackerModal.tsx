import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  X, LayoutDashboard, FileText, Heart, History,
  CheckCircle2, XCircle, Loader2, Clock, AlertCircle,
  HardDrive, ChevronRight, RefreshCw, FolderOpen,
  Cpu, Package, Terminal, Zap, Database, Puzzle,
  Power, PowerOff, Trash2, ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import {
  fetchJobs, fetchExportHistory, fetchAIJobs,
  fetchSystemLogs, readSystemLog, fetchSystemDeps, fetchSystemInfo,
  fetchPlugins, enablePlugin, disablePlugin, deletePlugin, fetchPluginLog,
} from '../../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Job {
  id: string
  type: string
  project_id?: string
  status: string
  progress: number
  error?: string
  created_at: string
  updated_at: string
}

interface AIJob {
  job_id: string
  kind: string
  status: string
  progress: number
  error?: string
  created_at: string
}

interface ExportRecord {
  id: string
  project_id: string
  project_name?: string
  preset: string
  output_path?: string
  filename?: string
  file_size_mb?: number
  status: string
  started_at: string
  finished_at?: string
  error?: string
  progress: number
}

interface LogFile {
  name: string
  size_bytes: number
  modified_at: string
}

interface Dep {
  name: string
  key: string
  status: string
  version?: string
  required: boolean
  note?: string
}

interface StorageInfo {
  disk_total_gb: number
  disk_free_gb: number
  disk_used_gb: number
  projects_mb: number
  exports_mb: number
  cache_mb: number
  models_mb: number
  temp_mb: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return d.toLocaleDateString()
  } catch { return '—' }
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { icon: React.ReactNode; cls: string }> = {
    running:   { icon: <Loader2 size={9} className="animate-spin" />, cls: 'bg-brand-500/15 text-brand-300 border-brand-500/20' },
    done:      { icon: <CheckCircle2 size={9} />, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
    failed:    { icon: <XCircle size={9} />, cls: 'bg-red-500/15 text-red-300 border-red-500/20' },
    cancelled: { icon: <XCircle size={9} />, cls: 'bg-white/10 text-white/30 border-white/10' },
    pending:   { icon: <Clock size={9} />, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/20' },
  }
  const { icon, cls } = cfg[status] ?? cfg.pending
  return (
    <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-medium capitalize', cls)}>
      {icon} {status}
    </span>
  )
}

// ── Tab: Activity ─────────────────────────────────────────────────────────────

function ActivityTab() {
  const [dbJobs,   setDbJobs]   = useState<Job[]>([])
  const [aiJobs,   setAiJobs]   = useState<AIJob[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    const [dbRes, aiRes] = await Promise.allSettled([fetchJobs(), fetchAIJobs()])
    if (dbRes.status === 'fulfilled') setDbJobs((dbRes.value as any).jobs ?? [])
    if (aiRes.status === 'fulfilled') setAiJobs((aiRes.value as any).jobs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  const allRunning = [
    ...dbJobs.filter(j => j.status === 'running'),
    ...aiJobs.filter(j => j.status === 'running'),
  ]
  const allRecent = [
    ...dbJobs.map(j => ({ id: j.id, kind: j.type, status: j.status, progress: j.progress, created_at: j.created_at, error: j.error })),
    ...aiJobs.map(j => ({ id: j.job_id, kind: j.kind, status: j.status, progress: j.progress, created_at: j.created_at, error: j.error })),
  ].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 30)

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-2">
      <Loader2 size={14} className="text-brand-400 animate-spin" />
      <p className="text-xs text-white/30">Loading activity…</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Running jobs */}
      {allRunning.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">
            Running ({allRunning.length})
          </p>
          <div className="space-y-1.5">
            {allRunning.map((j: any) => (
              <div key={j.id ?? j.job_id} className="p-3 rounded-xl bg-brand-500/5 border border-brand-500/15">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/80 capitalize">{(j.type ?? j.kind ?? '').replace(/-/g, ' ')}</span>
                  <StatusBadge status={j.status} />
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((j.progress ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-white/25 mt-1">{Math.round((j.progress ?? 0) * 100)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All jobs */}
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">
          Recent Jobs
        </p>
        {allRecent.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-white/20">
            <Clock size={22} />
            <p className="text-xs">No jobs yet this session</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allRecent.map(j => (
              <div key={j.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/3 transition-all">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: j.status === 'done' ? '#34d399' : j.status === 'failed' ? '#f87171' : j.status === 'running' ? '#818cf8' : '#ffffff30' }}
                />
                <p className="text-xs text-white/60 flex-1 capitalize truncate">{(j.kind ?? '').replace(/-/g, ' ')}</p>
                <StatusBadge status={j.status} />
                <p className="text-[9px] text-white/20 flex-shrink-0 w-16 text-right">{fmtTime(j.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Exports ──────────────────────────────────────────────────────────────

function ExportsTab() {
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExportHistory()
      .then((r: any) => setExports(r.exports ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-2">
      <Loader2 size={14} className="text-brand-400 animate-spin" />
    </div>
  )

  if (exports.length === 0) return (
    <div className="flex flex-col items-center py-10 gap-2 text-white/20">
      <History size={22} />
      <p className="text-xs">No exports yet</p>
    </div>
  )

  return (
    <div className="space-y-1.5">
      {exports.map(ex => (
        <div key={ex.id} className="p-3 rounded-xl bg-surface-200 border border-white/5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">
                {ex.filename ?? ex.output_path?.split(/[\\/]/).pop() ?? 'export'}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {ex.project_name ?? ex.project_id?.slice(0, 8)} · {ex.preset}
              </p>
            </div>
            <StatusBadge status={ex.status} />
          </div>

          <div className="flex items-center gap-3 text-[9px] text-white/25">
            <span>{fmtTime(ex.started_at)}</span>
            {ex.file_size_mb != null && (
              <span>{ex.file_size_mb} MB</span>
            )}
            {ex.error && (
              <span className="text-red-400 truncate max-w-[160px]">{ex.error}</span>
            )}
          </div>

          {ex.status === 'running' && (
            <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${Math.round((ex.progress ?? 0) * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tab: Logs ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logFiles,    setLogFiles]    = useState<LogFile[]>([])
  const [selected,    setSelected]    = useState<string | null>(null)
  const [content,     setContent]     = useState<string>('')
  const [totalLines,  setTotalLines]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [reading,     setReading]     = useState(false)

  useEffect(() => {
    fetchSystemLogs()
      .then((r: any) => setLogFiles(r.logs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openLog = async (name: string) => {
    setSelected(name)
    setReading(true)
    try {
      const r = await readSystemLog(name) as any
      setContent(r.content ?? '')
      setTotalLines(r.total_lines ?? 0)
    } catch {
      setContent('Error reading log file.')
    } finally {
      setReading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-2">
      <Loader2 size={14} className="text-brand-400 animate-spin" />
    </div>
  )

  if (selected) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => { setSelected(null); setContent('') }}
          className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronRight size={10} className="rotate-180" /> Back
        </button>
        <span className="text-[10px] text-white/25">·</span>
        <span className="text-[10px] text-white/50 font-mono">{selected}</span>
        {totalLines > 300 && (
          <span className="text-[9px] text-white/20 ml-auto">showing last 300 of {totalLines} lines</span>
        )}
      </div>

      {reading ? (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 size={12} className="text-brand-400 animate-spin" />
          <p className="text-xs text-white/30">Reading…</p>
        </div>
      ) : (
        <pre className="flex-1 overflow-y-auto text-[10px] text-white/50 font-mono leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl p-3 border border-white/5">
          {content || '(empty)'}
        </pre>
      )}
    </div>
  )

  if (logFiles.length === 0) return (
    <div className="flex flex-col items-center py-10 gap-2 text-white/20">
      <FileText size={22} />
      <p className="text-xs">No log files yet</p>
      <p className="text-[10px]">Logs appear after exports and AI jobs run</p>
    </div>
  )

  return (
    <div className="space-y-1">
      {logFiles.map(lf => (
        <button
          key={lf.name}
          onClick={() => openLog(lf.name)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all text-left group"
        >
          <FileText size={13} className="text-white/25 group-hover:text-white/50 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 font-mono truncate">{lf.name}</p>
            <p className="text-[9px] text-white/25 mt-0.5">
              {fmtBytes(lf.size_bytes)} · {fmtTime(lf.modified_at)}
            </p>
          </div>
          <ChevronRight size={12} className="text-white/15 group-hover:text-white/40 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ── Tab: Health ───────────────────────────────────────────────────────────────

function HealthTab() {
  const [deps,    setDeps]    = useState<Dep[]>([])
  const [whisper, setWhisper] = useState<{name: string; size_mb: number}[]>([])
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [memMb,   setMemMb]   = useState<number | null>(null)
  const [memPct,  setMemPct]  = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchSystemDeps() as Promise<any>,
      fetchSystemInfo() as Promise<any>,
    ])
      .then(([deps, info]) => {
        setDeps(deps.deps ?? [])
        setWhisper(deps.whisper_models ?? [])
        setStorage(deps.storage ?? null)
        setMemMb(info.memory_mb ?? null)
        setMemPct(info.memory_pct ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const depIcon = (key: string) => {
    if (key === 'ffmpeg')       return <Zap size={12} />
    if (key === 'python')       return <Terminal size={12} />
    if (key === 'fastapi')      return <Cpu size={12} />
    if (key === 'aiosqlite')    return <Database size={12} />
    if (key === 'numpy')        return <Package size={12} />
    return <Package size={12} />
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-2">
      <Loader2 size={14} className="text-brand-400 animate-spin" />
    </div>
  )

  const requiredOk  = deps.filter(d => d.required  && d.status === 'ok').length
  const requiredAll = deps.filter(d => d.required).length

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      <div className={clsx(
        'flex items-center gap-3 p-3 rounded-xl border',
        requiredOk === requiredAll
          ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300'
          : 'bg-amber-500/8 border-amber-500/15 text-amber-300',
      )}>
        {requiredOk === requiredAll
          ? <CheckCircle2 size={14} />
          : <AlertCircle size={14} />}
        <p className="text-xs font-medium">
          {requiredOk === requiredAll
            ? 'All required dependencies are installed'
            : `${requiredAll - requiredOk} required ${requiredAll - requiredOk === 1 ? 'dependency' : 'dependencies'} missing`}
        </p>
        <button onClick={load} className="ml-auto text-white/30 hover:text-white/60 transition-colors">
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Dep grid */}
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">Dependencies</p>
        <div className="space-y-1">
          {deps.map(dep => (
            <div key={dep.key} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-200 border border-white/5">
              <div className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                dep.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
              )}>
                {depIcon(dep.key)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-white/80">{dep.name}</p>
                  {!dep.required && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/30 border border-white/8">optional</span>
                  )}
                </div>
                {dep.note && (
                  <p className="text-[9px] text-white/25 truncate">{dep.note}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                {dep.status === 'ok' ? (
                  <p className="text-[10px] text-emerald-400/80 font-mono">{dep.version ?? 'installed'}</p>
                ) : (
                  <p className="text-[10px] text-red-400">not installed</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Whisper models */}
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">
          Whisper Models ({whisper.length} downloaded)
        </p>
        {whisper.length === 0 ? (
          <p className="text-[10px] text-white/25 px-1">No models downloaded — use Auto Captions to download one</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {whisper.map(m => (
              <div key={m.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/15 text-brand-300">
                <CheckCircle2 size={9} />
                <span className="text-[10px] font-medium">{m.name}</span>
                <span className="text-[9px] text-brand-400/60">({m.size_mb} MB)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage */}
      {storage && (
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">Storage</p>

          {/* Disk bar */}
          <div className="p-3 rounded-xl bg-surface-200 border border-white/5 mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-white/60">
                <HardDrive size={11} />
                <p className="text-[10px] font-medium">Disk</p>
              </div>
              <p className="text-[10px] text-white/30">{storage.disk_free_gb} GB free of {storage.disk_total_gb} GB</p>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  (storage.disk_used_gb / storage.disk_total_gb) > 0.9 ? 'bg-red-500' :
                  (storage.disk_used_gb / storage.disk_total_gb) > 0.7 ? 'bg-amber-500' : 'bg-brand-500',
                )}
                style={{ width: `${Math.round((storage.disk_used_gb / storage.disk_total_gb) * 100)}%` }}
              />
            </div>
          </div>

          {/* Memory bar */}
          {memPct !== null && (
            <div className="p-3 rounded-xl bg-surface-200 border border-white/5 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-white/60">
                  <Cpu size={11} />
                  <p className="text-[10px] font-medium">Process Memory</p>
                </div>
                <p className="text-[10px] text-white/30">
                  {memMb !== null ? `${memMb} MB` : '—'} · {memPct}% system
                </p>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    memPct > 85 ? 'bg-red-500' : memPct > 60 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(memPct, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* App folders */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Projects',  mb: storage.projects_mb },
              { label: 'Exports',   mb: storage.exports_mb  },
              { label: 'AI Models', mb: storage.models_mb   },
              { label: 'Cache',     mb: storage.cache_mb    },
            ].map(({ label, mb }) => (
              <div key={label} className="p-2.5 rounded-xl bg-surface-200 border border-white/5">
                <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
                <p className="text-xs font-medium text-white/70">{mb} MB</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Plugins ──────────────────────────────────────────────────────────────

interface Plugin {
  id: string
  name: string
  version: string
  author?: string
  description?: string
  enabled: boolean
  builtin?: boolean
  api_prefix?: string
  tags?: string[]
  runtime_loaded: boolean
  runtime_error?: string
  has_error_log: boolean
}

function PluginsTab() {
  const notify = useUIStore(s => s.notify)
  const [plugins,       setPlugins]       = useState<Plugin[]>([])
  const [loading,       setLoading]       = useState(true)
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [logContent,    setLogContent]    = useState<Record<string, string>>({})
  const [loadingLog,    setLoadingLog]    = useState<string | null>(null)
  const [busy,          setBusy]          = useState<string | null>(null)

  const load = () => {
    fetchPlugins()
      .then((r: any) => setPlugins(r.plugins ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggle = async (p: Plugin) => {
    setBusy(p.id)
    try {
      if (p.enabled) {
        await disablePlugin(p.id)
        notify(`Plugin "${p.name}" disabled — restart to apply`, 'info')
      } else {
        await enablePlugin(p.id)
        notify(`Plugin "${p.name}" enabled — restart to apply`, 'success')
      }
      setRestartNeeded(true)
      load()
    } catch (err: any) {
      notify(err?.message ?? 'Failed to update plugin', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async (p: Plugin) => {
    if (!confirm(`Delete plugin "${p.name}"? This cannot be undone.`)) return
    setBusy(p.id)
    try {
      await deletePlugin(p.id)
      notify(`Plugin "${p.name}" deleted`, 'info')
      setRestartNeeded(true)
      load()
    } catch (err: any) {
      notify(err?.message ?? 'Failed to delete plugin', 'error')
    } finally {
      setBusy(null)
    }
  }

  const viewLog = async (pluginId: string) => {
    setLoadingLog(pluginId)
    try {
      const r = await fetchPluginLog(pluginId) as any
      setLogContent(prev => ({ ...prev, [pluginId]: r.content ?? '(no content)' }))
    } catch {
      setLogContent(prev => ({ ...prev, [pluginId]: 'Error reading log.' }))
    } finally {
      setLoadingLog(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-2">
      <Loader2 size={14} className="text-brand-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Restart banner */}
      {restartNeeded && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-amber-300 text-xs">
          <AlertCircle size={13} />
          Restart the backend to apply plugin changes
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium">
          Installed Plugins ({plugins.length})
        </p>
        <p className="text-[10px] text-white/25">
          {plugins.filter(p => p.enabled).length} enabled · {plugins.filter(p => p.runtime_loaded).length} loaded
        </p>
      </div>

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-white/20">
          <Puzzle size={22} />
          <p className="text-xs">No plugins installed</p>
          <p className="text-[10px] text-center max-w-[200px]">
            Drop a plugin folder into <span className="font-mono text-white/30">plugins/</span> and restart
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map(p => {
            const isExpanded = expanded === p.id
            return (
              <div key={p.id} className={clsx(
                'rounded-xl border overflow-hidden transition-all',
                p.runtime_error ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-surface-200',
              )}>
                {/* Card header */}
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/3 transition-all text-left"
                  onClick={() => setExpanded(prev => prev === p.id ? null : p.id)}
                >
                  {/* Icon */}
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    p.runtime_loaded ? 'bg-brand-500/15 text-brand-400' :
                    p.runtime_error  ? 'bg-red-500/15 text-red-400' :
                                       'bg-white/8 text-white/25',
                  )}>
                    <Puzzle size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-white/80 truncate">{p.name}</p>
                      {p.builtin && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/30 border border-white/8 flex-shrink-0">built-in</span>
                      )}
                      {p.runtime_error && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 flex-shrink-0">error</span>
                      )}
                    </div>
                    <p className="text-[9px] text-white/30 font-mono">v{p.version}{p.author ? ` · ${p.author}` : ''}</p>
                  </div>

                  {/* Enable toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); toggle(p) }}
                    disabled={busy === p.id}
                    title={p.enabled ? 'Disable plugin' : 'Enable plugin'}
                    className={clsx(
                      'p-1.5 rounded-lg transition-all flex-shrink-0',
                      p.enabled
                        ? 'text-emerald-400 hover:bg-emerald-500/10'
                        : 'text-white/20 hover:text-white/50 hover:bg-white/5',
                    )}
                  >
                    {busy === p.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : p.enabled ? <Power size={13} /> : <PowerOff size={13} />
                    }
                  </button>

                  <ChevronDown size={12} className={clsx('text-white/20 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-white/5 space-y-2.5">
                    {p.description && (
                      <p className="text-[10px] text-white/40 mt-2">{p.description}</p>
                    )}

                    {p.api_prefix && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/25 uppercase tracking-wide">API</span>
                        <code className="text-[10px] font-mono text-brand-300/70 bg-brand-500/8 px-2 py-0.5 rounded">{p.api_prefix}</code>
                      </div>
                    )}

                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/25 border border-white/5">{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Error log */}
                    {p.has_error_log && (
                      <div>
                        <button
                          onClick={() => viewLog(p.id)}
                          className="flex items-center gap-1.5 text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          {loadingLog === p.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <FileText size={10} />
                          }
                          View error log
                        </button>
                        {logContent[p.id] && (
                          <pre className="mt-2 text-[9px] font-mono text-red-300/60 bg-red-500/5 border border-red-500/10 rounded-lg p-2 overflow-y-auto max-h-32 whitespace-pre-wrap">
                            {logContent[p.id]}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Delete */}
                    {!p.builtin && (
                      <button
                        onClick={() => handleDelete(p)}
                        className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-red-400 transition-colors mt-1"
                      >
                        <Trash2 size={10} /> Uninstall plugin
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Install hint */}
      <div className="p-3 rounded-xl bg-white/3 border border-white/5">
        <p className="text-[10px] text-white/30 font-medium mb-1">Installing plugins</p>
        <p className="text-[10px] text-white/20 leading-relaxed">
          Create a folder in <code className="font-mono text-white/35">plugins/</code> with a{' '}
          <code className="font-mono text-white/35">manifest.json</code> and a Python{' '}
          <code className="font-mono text-white/35">plugin.py</code> exporting a FastAPI{' '}
          <code className="font-mono text-white/35">router</code>. Restart the backend to load it.
        </p>
      </div>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'activity', label: 'Activity',  icon: <LayoutDashboard size={12} /> },
  { id: 'exports',  label: 'Exports',   icon: <History size={12} /> },
  { id: 'logs',     label: 'Logs',      icon: <FileText size={12} /> },
  { id: 'health',   label: 'Health',    icon: <Heart size={12} /> },
  { id: 'plugins',  label: 'Plugins',   icon: <Puzzle size={12} /> },
]

export default function TrackerModal() {
  const closeModal = useUIStore(s => s.closeModal)
  const [tab, setTab] = useState('activity')

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) closeModal() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full max-w-xl bg-surface-100 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={14} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">Activity, Health & Plugins</h2>
          </div>
          <button onClick={closeModal} className="text-white/30 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                tab === t.id
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/5',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'activity' && <ActivityTab />}
          {tab === 'exports'  && <ExportsTab />}
          {tab === 'logs'     && <LogsTab />}
          {tab === 'health'   && <HealthTab />}
          {tab === 'plugins'  && <PluginsTab />}
        </div>
      </motion.div>
    </motion.div>
  )
}
