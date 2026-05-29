import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  X, Upload, Film, Instagram, Youtube, MessageCircle, Twitter,
  Sliders, FolderOpen, CheckCircle2,
  Zap, XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useProjectStore } from '../../store/project'
import { useJobsStore } from '../../store/jobs'
import { useTimelineStore } from '../../store/timeline'
import { startExport, cancelExport, pickFolder, fetchJob } from '../../api/client'

const PRESETS = [
  { id: 'instagram-reel',      name: 'Reel',        sub: '1080×1920 · 30fps', icon: Instagram,     cat: 'instagram', accent: 'from-pink-600 to-purple-600' },
  { id: 'instagram-post',      name: 'Post',         sub: '1080×1080 · 30fps', icon: Instagram,     cat: 'instagram', accent: 'from-pink-600 to-purple-600' },
  { id: 'instagram-portrait',  name: 'Portrait',     sub: '1080×1350 · 30fps', icon: Instagram,     cat: 'instagram', accent: 'from-pink-600 to-purple-600' },
  { id: 'youtube-hd',          name: 'YouTube HD',   sub: '1920×1080 · 30fps', icon: Youtube,       cat: 'youtube',   accent: 'from-red-600 to-red-500' },
  { id: 'youtube-shorts',      name: 'Shorts',       sub: '1080×1920 · 60fps', icon: Youtube,       cat: 'youtube',   accent: 'from-red-600 to-red-500' },
  { id: 'youtube-4k',          name: 'YouTube 4K',   sub: '3840×2160 · 30fps', icon: Youtube,       cat: 'youtube',   accent: 'from-red-600 to-red-500' },
  { id: 'tiktok',              name: 'TikTok',       sub: '1080×1920 · 30fps', icon: Film,          cat: 'social',    accent: 'from-cyan-500 to-blue-600' },
  { id: 'whatsapp',            name: 'WhatsApp',     sub: '720×1280 · 30fps',  icon: MessageCircle, cat: 'social',    accent: 'from-green-600 to-emerald-600' },
  { id: 'twitter-x',           name: 'Twitter / X',  sub: '1280×720 · 30fps',  icon: Twitter,       cat: 'social',    accent: 'from-sky-600 to-blue-700' },
  { id: 'high-quality-master', name: 'Master',       sub: '1920×1080 · Best',  icon: Zap,           cat: 'pro',       accent: 'from-amber-500 to-orange-600' },
  { id: 'custom',              name: 'Custom',       sub: 'Your settings',      icon: Sliders,       cat: 'custom',    accent: 'from-surface-500 to-surface-600' },
]

const CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube',   label: 'YouTube' },
  { id: 'social',    label: 'Social' },
  { id: 'pro',       label: 'Pro' },
  { id: 'custom',    label: 'Custom' },
]

const QUALITY_OPTIONS = [
  { id: 'high',   label: 'High',   sub: 'Best quality, larger file', crf: 16 },
  { id: 'medium', label: 'Medium', sub: 'Balanced quality and size', crf: 20 },
  { id: 'web',    label: 'Web',    sub: 'Optimised for streaming',   crf: 24 },
]

export default function ExportModal() {
  const closeModal  = useUIStore(s => s.closeModal)
  const notify      = useUIStore(s => s.notify)
  const project     = useProjectStore(s => s.activeProject)
  const tracks      = useTimelineStore(s => s.tracks)
  const duration    = useTimelineStore(s => s.duration)
  const jobs        = useJobsStore(s => s.jobs)
  const upsertJob   = useJobsStore(s => s.upsertJob)

  const [category,       setCategory]       = useState('all')
  const [selectedPreset, setSelectedPreset] = useState('youtube-hd')
  const [quality,        setQuality]        = useState('high')
  const [outputDir,      setOutputDir]      = useState('')
  const [activeJobId,    setActiveJobId]    = useState<string | null>(null)
  const [outputPath,     setOutputPath]     = useState<string | null>(null)

  const activeJob = activeJobId ? jobs.find(j => j.id === activeJobId) ?? null : null
  const isRunning = activeJob?.status === 'running' || activeJob?.status === 'pending'
  const isDone    = activeJob?.status === 'done'
  const isFailed  = activeJob?.status === 'failed'

  // Poll job status via API while running (WebSocket handles real-time; this is a 3 s fallback)
  useEffect(() => {
    if (!activeJobId || !isRunning) return
    const timer = setInterval(async () => {
      try {
        const data = await fetchJob(activeJobId) as any
        if (data?.id) {
          upsertJob({
            id: data.id, type: data.type ?? 'export', project_id: data.project_id,
            status: data.status, progress: data.progress ?? 0,
            result: data.result, error: data.error,
            created_at: data.created_at, updated_at: data.updated_at,
          })
        }
      } catch { /* ignore polling errors */ }
    }, 3000)
    return () => clearInterval(timer)
  }, [activeJobId, isRunning, upsertJob])

  const filtered = category === 'all' ? PRESETS : PRESETS.filter(p => p.cat === category)

  const handlePickFolder = async () => {
    const folder = await pickFolder()
    if (folder) setOutputDir(folder)
  }

  const handleExport = async () => {
    if (!project || duration <= 0) {
      notify('Add clips to the timeline before exporting', 'error')
      return
    }

    try {
      const res = await (startExport as any)({
        project_id:     project.id,
        preset:         selectedPreset,
        quality,
        timeline_state: { tracks, duration_s: duration },
        output_filename: outputDir ? '' : '',
      }) as { export_id: string; job_id: string; output_path: string }

      const jobId = res.export_id ?? res.job_id
      setActiveJobId(jobId)
      setOutputPath(res.output_path ?? null)

      // Seed the job in the store immediately so the UI reacts before WS arrives
      upsertJob({
        id: jobId, type: 'export', project_id: project.id,
        status: 'running', progress: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    } catch (e: any) {
      const msg = e?.message ?? 'Export failed'
      notify(msg.includes('409') ? 'Another export is already running' : `Export error: ${msg}`, 'error')
    }
  }

  const handleCancel = async () => {
    if (!activeJobId) return
    try {
      await cancelExport(activeJobId)
      notify('Export cancelled', 'info')
      setActiveJobId(null)
    } catch {
      notify('Could not cancel export', 'error')
    }
  }

  const handleOpenFolder = () => {
    const path = (activeJob?.result as string) ?? outputPath
    if (!path) return
    const el = (window as any).electronAPI
    if (el?.showInFolder) {
      el.showInFolder(path)
    } else {
      notify(`Saved to: ${path}`, 'info')
    }
  }

  const progress = activeJob?.progress ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        className="bg-surface-100 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <Upload size={15} className="text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Export Video</p>
            <p className="text-xs text-white/30">{project?.name ?? 'Untitled'}</p>
          </div>
          <button
            onClick={closeModal}
            className="ml-auto p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress view (while exporting or after) */}
        {activeJobId && (
          <div className="px-6 py-5 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">
                {isDone    ? 'Export complete' :
                 isFailed  ? 'Export failed'   :
                 isRunning ? 'Exporting…'       : 'Export cancelled'}
              </p>
              <span className="text-xs tabular-nums text-white/40">
                {Math.round(progress)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className={clsx(
                  'h-full rounded-full',
                  isDone   ? 'bg-emerald-500' :
                  isFailed ? 'bg-red-500'     : 'bg-brand-500',
                )}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            {isFailed && activeJob?.error && (
              <p className="mt-2 text-xs text-red-400 line-clamp-2">{activeJob.error}</p>
            )}

            {isDone && (
              <p className="mt-2 text-xs text-emerald-400/80 truncate">
                {(activeJob?.result as string) ?? outputPath}
              </p>
            )}
          </div>
        )}

        {/* Settings (hidden while running to keep modal clean) */}
        {!isRunning && !isDone && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* Category filter */}
              <div>
                <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">Format</p>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)}
                      className={clsx('px-3 py-1.5 rounded-lg text-xs transition-all',
                        category === c.id
                          ? 'bg-brand-600 text-white'
                          : 'bg-surface-300 text-white/40 hover:text-white/70',
                      )}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filtered.map(p => {
                  const Icon   = p.icon
                  const active = selectedPreset === p.id
                  return (
                    <button key={p.id} onClick={() => setSelectedPreset(p.id)}
                      className={clsx(
                        'relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all',
                        active
                          ? 'bg-brand-600/15 border-brand-500/50 text-white'
                          : 'bg-surface-200 border-white/5 text-white/50 hover:border-white/15 hover:text-white/80',
                      )}>
                      <div className={clsx('w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center', p.accent)}>
                        <Icon size={15} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold leading-none">{p.name}</p>
                        <p className="text-[9px] opacity-50 mt-0.5">{p.sub}</p>
                      </div>
                      {active && (
                        <div className="absolute top-1.5 right-1.5">
                          <CheckCircle2 size={11} className="text-brand-400" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Quality */}
              <div>
                <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">Quality</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUALITY_OPTIONS.map(q => (
                    <button key={q.id} onClick={() => setQuality(q.id)}
                      className={clsx(
                        'p-3 rounded-xl border text-left transition-all',
                        quality === q.id
                          ? 'bg-brand-600/15 border-brand-500/50'
                          : 'bg-surface-200 border-white/5 hover:border-white/15',
                      )}>
                      <p className={clsx('text-sm font-semibold', quality === q.id ? 'text-white' : 'text-white/60')}>{q.label}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{q.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output folder */}
              <div>
                <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">Output Folder</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-surface-200 border border-white/8 rounded-xl px-3 py-2 text-xs text-white/50 truncate">
                    {outputDir || 'exports/ (default)'}
                  </div>
                  <button onClick={handlePickFolder}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-300 border border-white/8 text-white/50 hover:text-white text-xs transition-all">
                    <FolderOpen size={12} />
                    Browse
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/5">
          {/* Left side info / open folder */}
          {isDone ? (
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <FolderOpen size={12} />
              Open folder
            </button>
          ) : (
            <p className="text-[11px] text-white/20 flex-1 truncate">
              {isRunning ? `FFmpeg rendering… ${Math.round(progress)}%` :
               isFailed  ? 'Export failed — check logs' :
               duration <= 0 ? 'Add clips to the timeline first' : ''}
            </p>
          )}

          {/* Right side actions */}
          <div className="flex items-center gap-2 ml-auto">
            {isRunning ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 text-sm transition-all"
                >
                  <XCircle size={14} />
                  Cancel
                </button>
              </>
            ) : isDone ? (
              <>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all"
                >
                  Done
                </button>
              </>
            ) : isFailed ? (
              <>
                <button
                  onClick={() => setActiveJobId(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all"
                >
                  Try again
                </button>
                <button onClick={closeModal} className="px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all">
                  Close
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={duration <= 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all min-w-[100px] justify-center"
                >
                  <Upload size={14} />
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
