import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, X, Loader2, AlertCircle, TrendingUp, Maximize2,
  Star, CheckCircle, Info, AlertTriangle, ChevronRight, Plus,
} from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useMediaStore } from '../../store/media'
import { useProjectStore } from '../../store/project'
import { useTimelineStore } from '../../store/timeline'
import { analyzeProject, getSmartResize, getExportRecs, startHighlights, fetchAIJob, cancelAIJob } from '../../api/client'

type Tab = 'analysis' | 'highlights' | 'resize' | 'export'

interface Recommendation { level: string; text: string }
interface Analysis {
  duration_s: number
  total_clips: number
  clip_counts: Record<string, number>
  total_clip_duration: number
  unused_media_count: number
  unused_media: string[]
  effect_types: Record<string, number>
  transition_count: number
  recommendations: Recommendation[]
}
interface Highlight { start_s: number; end_s: number; score: number; reason: string }
interface ResizeOption { id: string; name: string; width: number; height: number; method: string; crop_pct: number }
interface ExportRec { preset_id: string; reason: string; priority: string }

function fmtTime(s: number): string {
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

function RecIcon({ level }: { level: string }) {
  if (level === 'success') return <CheckCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
  if (level === 'warning') return <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
  return <Info size={12} className="text-brand-400 flex-shrink-0 mt-0.5" />
}

export default function AIAnalysisModal() {
  const closeModal       = useUIStore(s => s.closeModal)
  const notify           = useUIStore(s => s.notify)
  const mediaItems       = useMediaStore(s => s.items)
  const activeProject    = useProjectStore(s => s.activeProject)
  const tracks           = useTimelineStore(s => s.tracks)
  const duration         = useTimelineStore(s => s.duration)
  const addHighlightClips = useTimelineStore(s => s.addHighlightClips)

  const [tab, setTab] = useState<Tab>('analysis')

  // Analysis state
  const [analysis,         setAnalysis]        = useState<Analysis | null>(null)
  const [analysisLoading,  setAnalysisLoading] = useState(false)
  const [analysisError,    setAnalysisError]   = useState<string | null>(null)

  // Highlights state
  const [hlMedia,         setHlMedia]         = useState('')
  const [hlMediaId,       setHlMediaId]       = useState('')
  const [hlCount,         setHlCount]         = useState(5)
  const [hlDuration,      setHlDuration]      = useState(5.0)
  const [hlJobId,         setHlJobId]         = useState<string | null>(null)
  const [hlRunning,       setHlRunning]       = useState(false)
  const [highlights,      setHighlights]      = useState<Highlight[]>([])
  const [hlSelected,      setHlSelected]      = useState<Set<number>>(new Set())
  const [hlError,         setHlError]         = useState<string | null>(null)
  const hlPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Resize state
  const [resizeOptions, setResizeOptions] = useState<ResizeOption[]>([])
  const [resizeLoading, setResizeLoading] = useState(false)

  // Export recs state
  const [exportRecs,        setExportRecs]       = useState<ExportRec[]>([])
  const [exportRecsLoading, setExportRecsLoading] = useState(false)

  const videoItems = mediaItems.filter(m => m.type === 'video')

  // ── Load analysis on mount ───────────────────────────────────────────────

  useEffect(() => {
    if (!activeProject) return
    setAnalysisLoading(true)
    setAnalysisError(null)
    const timelineState = {
      tracks,
      duration_s: duration,
      project_id: activeProject.id,
    }
    analyzeProject({ timeline_state: timelineState, media_items: mediaItems as unknown[], project: activeProject as unknown })
      .then(r => setAnalysis(r as Analysis))
      .catch(e => setAnalysisError(e?.message ?? 'Analysis failed'))
      .finally(() => setAnalysisLoading(false))
  }, [])

  // ── Load resize options on tab switch ───────────────────────────────────

  useEffect(() => {
    if (tab !== 'resize' || resizeOptions.length > 0) return
    if (!activeProject) return
    setResizeLoading(true)
    getSmartResize({ source_width: activeProject.width, source_height: activeProject.height })
      .then(r => setResizeOptions((r as any).options))
      .catch(() => {})
      .finally(() => setResizeLoading(false))
  }, [tab])

  // ── Load export recs on tab switch ──────────────────────────────────────

  useEffect(() => {
    if (tab !== 'export' || exportRecs.length > 0 || !activeProject) return
    setExportRecsLoading(true)
    const timelineState = { tracks, duration_s: duration, project_id: activeProject.id }
    getExportRecs({ timeline_state: timelineState, media_items: mediaItems as unknown[], project: activeProject as unknown })
      .then(r => setExportRecs((r as any).recommendations ?? []))
      .catch(() => {})
      .finally(() => setExportRecsLoading(false))
  }, [tab])

  // ── Pre-select first video for highlights ────────────────────────────────

  useEffect(() => {
    if (!hlMedia && videoItems.length > 0) {
      setHlMedia(videoItems[0].path)
      setHlMediaId(videoItems[0].id)
    }
  }, [videoItems, hlMedia])

  // ── WS listener for highlights ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const d = e.detail
      if (d?.type !== 'ai_update' || d.job_id !== hlJobId) return
      if (d.status === 'done' && d.result?.highlights) {
        clearHlPoll()
        const hl: Highlight[] = d.result.highlights
        setHighlights(hl)
        setHlSelected(new Set(hl.map((_: Highlight, i: number) => i)))
        setHlRunning(false)
      }
      if (d.status === 'failed') {
        clearHlPoll()
        setHlError(d.error ?? 'Highlight detection failed')
        setHlRunning(false)
      }
    }
    window.addEventListener('ws-message', handler as EventListener)
    return () => window.removeEventListener('ws-message', handler as EventListener)
  }, [hlJobId])

  const clearHlPoll = useCallback(() => {
    if (hlPollRef.current) { clearInterval(hlPollRef.current); hlPollRef.current = null }
  }, [])
  useEffect(() => () => clearHlPoll(), [clearHlPoll])

  // ── Highlight detection ──────────────────────────────────────────────────

  const handleDetectHighlights = async () => {
    if (!hlMedia) { notify('Select a video file first', 'error'); return }
    setHlError(null)
    setHighlights([])
    setHlRunning(true)
    try {
      const res = await startHighlights({ media_path: hlMedia, highlight_count: hlCount, segment_duration_s: hlDuration })
      setHlJobId(res.job_id)
      hlPollRef.current = setInterval(async () => {
        try {
          const job = await fetchAIJob(res.job_id)
          if (job.status === 'done' && (job.result as any)?.highlights) {
            clearHlPoll()
            const hl: Highlight[] = (job.result as any).highlights
            setHighlights(hl)
            setHlSelected(new Set(hl.map((_: Highlight, i: number) => i)))
            setHlRunning(false)
          }
          if (job.status === 'failed') {
            clearHlPoll()
            setHlError((job as any).error ?? 'Failed')
            setHlRunning(false)
          }
        } catch { clearHlPoll(); setHlRunning(false) }
      }, 2000)
    } catch (err: any) {
      notify(err?.message ?? 'Failed to start highlight detection', 'error')
      setHlRunning(false)
    }
  }

  const handleCancelHighlights = async () => {
    clearHlPoll()
    if (hlJobId) await cancelAIJob(hlJobId).catch(() => {})
    setHlRunning(false)
  }

  const handleCreateReel = () => {
    const segs = highlights.filter((_, i) => hlSelected.has(i))
    if (!segs.length) { notify('No highlights selected', 'error'); return }
    addHighlightClips(hlMediaId, segs.map(h => ({ start_s: h.start_s, end_s: h.end_s })))
    notify(`Added ${segs.length} highlight${segs.length !== 1 ? 's' : ''} to timeline`, 'success')
    closeModal()
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'analysis',   label: 'Analysis',   icon: Brain },
    { id: 'highlights', label: 'Highlights', icon: TrendingUp },
    { id: 'resize',     label: 'Smart Resize', icon: Maximize2 },
    { id: 'export',     label: 'Export Recs', icon: Star },
  ]

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
        className="w-full max-w-lg bg-surface-100 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">AI Analysis</h2>
            <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">offline</span>
          </div>
          <button onClick={closeModal} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3 pb-0 gap-1 border-b border-white/5 flex-shrink-0">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium rounded-t-lg transition-all border-b-2 -mb-px',
                  tab === t.id
                    ? 'text-white border-brand-500 bg-brand-500/10'
                    : 'text-white/40 border-transparent hover:text-white/60 hover:bg-white/3',
                )}
              >
                <Icon size={11} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── ANALYSIS TAB ─────────────────────────────────────────────────── */}
          {tab === 'analysis' && (
            <div className="p-5 space-y-4">
              {analysisLoading && (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 size={16} className="text-brand-400 animate-spin" />
                  <p className="text-xs text-white/50">Analyzing project…</p>
                </div>
              )}
              {analysisError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                  <AlertCircle size={13} className="text-red-400" />
                  <p className="text-xs text-red-300">{analysisError}</p>
                </div>
              )}
              {analysis && !analysisLoading && (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Duration',  value: fmtTime(analysis.duration_s) },
                      { label: 'Total Clips', value: String(analysis.total_clips) },
                      { label: 'Transitions', value: String(analysis.transition_count) },
                    ].map(stat => (
                      <div key={stat.label} className="p-3 rounded-xl bg-surface-200 border border-white/5 text-center">
                        <p className="text-sm font-bold text-white/80">{stat.value}</p>
                        <p className="text-[9px] text-white/30 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Clip breakdown */}
                  {Object.keys(analysis.clip_counts).length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">Clips by Track</p>
                      <div className="space-y-1">
                        {Object.entries(analysis.clip_counts).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-2">
                            <span className="text-[10px] text-white/50 capitalize w-16 flex-shrink-0">{type}</span>
                            <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-brand-500 rounded-full"
                                style={{ width: `${Math.min(100, (count / Math.max(1, analysis.total_clips)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-white/40 w-6 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Effects */}
                  {Object.keys(analysis.effect_types).length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">Active Effects</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(analysis.effect_types).map(([type, count]) => (
                          <span key={type} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 capitalize">
                            {type} ×{count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-2">Recommendations</p>
                    <div className="space-y-1.5">
                      {analysis.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className={clsx(
                            'flex items-start gap-2 p-2.5 rounded-xl border text-xs',
                            rec.level === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                              : rec.level === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                              : 'bg-brand-500/5 border-brand-500/20 text-brand-300',
                          )}
                        >
                          <RecIcon level={rec.level} />
                          <span>{rec.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── HIGHLIGHTS TAB ───────────────────────────────────────────────── */}
          {tab === 'highlights' && (
            <div className="p-5 space-y-4">
              {hlError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                  <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{hlError}</p>
                </div>
              )}

              {!hlRunning && highlights.length === 0 && (
                <>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">Video File</label>
                    {videoItems.length === 0 ? (
                      <p className="text-xs text-white/30 italic">Import a video file first</p>
                    ) : (
                      <select
                        value={hlMedia}
                        onChange={e => {
                          setHlMedia(e.target.value)
                          const item = videoItems.find(m => m.path === e.target.value)
                          if (item) setHlMediaId(item.id)
                        }}
                        className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-brand-500/50"
                      >
                        {videoItems.map(m => <option key={m.id} value={m.path}>{m.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Highlights</label>
                        <span className="text-[10px] text-brand-400 font-mono">{hlCount}</span>
                      </div>
                      <input type="range" min={1} max={20} value={hlCount} onChange={e => setHlCount(Number(e.target.value))} className="w-full accent-brand-500" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Duration</label>
                        <span className="text-[10px] text-brand-400 font-mono">{hlDuration.toFixed(0)}s</span>
                      </div>
                      <input type="range" min={2} max={30} step={1} value={hlDuration} onChange={e => setHlDuration(Number(e.target.value))} className="w-full accent-brand-500" />
                    </div>
                  </div>

                  <button
                    onClick={handleDetectHighlights}
                    disabled={!hlMedia}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
                  >
                    <TrendingUp size={13} /> Find Highlights
                  </button>
                </>
              )}

              {hlRunning && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/15 flex items-center justify-center">
                    <Loader2 size={24} className="text-brand-400 animate-spin" />
                  </div>
                  <p className="text-xs text-white/60">Analyzing video for highlight moments…</p>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
                  </div>
                  <button onClick={handleCancelHighlights} className="text-xs text-white/40 hover:text-white/60 transition-colors">Cancel</button>
                </div>
              )}

              {!hlRunning && highlights.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/40">{highlights.length} highlights found · {hlSelected.size} selected</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setHlSelected(new Set())}
                        className="text-[9px] text-white/30 hover:text-white/60 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                      >Clear</button>
                      <button
                        onClick={handleDetectHighlights}
                        className="text-[9px] text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                      >Re-analyze</button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {highlights.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => setHlSelected(prev => {
                          const next = new Set(prev)
                          next.has(i) ? next.delete(i) : next.add(i)
                          return next
                        })}
                        className={clsx(
                          'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all',
                          hlSelected.has(i) ? 'bg-brand-500/10 border-brand-500/40' : 'bg-surface-200 border-white/5 hover:border-white/15',
                        )}
                      >
                        <div className={clsx(
                          'w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0',
                          hlSelected.has(i) ? 'bg-brand-500 border-brand-500' : 'border-white/20',
                        )}>
                          {hlSelected.has(i) && <span className="text-white text-[8px]">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-white/70">
                            {fmtTime(h.start_s)} – {fmtTime(h.end_s)}
                          </p>
                          <p className="text-[9px] text-white/30 capitalize">{h.reason}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }, (_, si) => (
                              <div
                                key={si}
                                className={clsx('w-1 h-2 rounded-sm', si < Math.ceil(h.score * 5) ? 'bg-brand-400' : 'bg-white/10')}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleCreateReel}
                    disabled={hlSelected.size === 0}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
                  >
                    <Plus size={12} /> Add {hlSelected.size} Highlight{hlSelected.size !== 1 ? 's' : ''} to Timeline
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── SMART RESIZE TAB ─────────────────────────────────────────────── */}
          {tab === 'resize' && (
            <div className="p-5 space-y-3">
              {activeProject && (
                <div className="p-3 rounded-xl bg-surface-200 border border-white/5">
                  <p className="text-[10px] text-white/40 mb-1">Current project size</p>
                  <p className="text-sm font-mono text-white/70">
                    {activeProject.width} × {activeProject.height} · {activeProject.aspect_ratio} · {activeProject.fps}fps
                  </p>
                </div>
              )}

              {resizeLoading && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 size={14} className="text-brand-400 animate-spin" />
                  <p className="text-xs text-white/40">Calculating…</p>
                </div>
              )}

              {resizeOptions.map(opt => (
                <div key={opt.id} className="p-3 rounded-xl bg-surface-200 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-white/80">{opt.name}</p>
                      <p className="text-[9px] text-white/30 font-mono mt-0.5">{opt.width}×{opt.height}</p>
                    </div>
                    <span className={clsx(
                      'text-[9px] px-2 py-0.5 rounded-full flex-shrink-0',
                      opt.crop_pct === 0 ? 'bg-emerald-500/20 text-emerald-400'
                        : opt.crop_pct < 20 ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400',
                    )}>
                      {opt.method}
                    </span>
                  </div>
                  {opt.crop_pct > 0 && (
                    <p className="text-[9px] text-white/25 mt-1.5">
                      ~{opt.crop_pct}% will be cropped — use Smart Frame in a future update to choose what to keep.
                    </p>
                  )}
                </div>
              ))}

              <p className="text-[9px] text-white/25 pt-1">
                Export with a preset matching your target format to change the output size.
                Crop settings are informational only — the selected export preset handles resizing.
              </p>
            </div>
          )}

          {/* ── EXPORT RECS TAB ──────────────────────────────────────────────── */}
          {tab === 'export' && (
            <div className="p-5 space-y-3">
              {exportRecsLoading && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 size={14} className="text-brand-400 animate-spin" />
                  <p className="text-xs text-white/40">Generating recommendations…</p>
                </div>
              )}

              {!exportRecsLoading && exportRecs.length === 0 && (
                <p className="text-xs text-white/30 text-center py-8">No recommendations available. Open a project first.</p>
              )}

              {exportRecs.map((rec, i) => (
                <div
                  key={i}
                  className={clsx(
                    'p-3.5 rounded-xl border',
                    rec.priority === 'primary' ? 'bg-brand-500/8 border-brand-500/30' : 'bg-surface-200 border-white/5',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {rec.priority === 'primary'
                      ? <Star size={11} className="text-brand-400 fill-brand-400" />
                      : <ChevronRight size={11} className="text-white/30" />
                    }
                    <p className={clsx(
                      'text-xs font-medium font-mono',
                      rec.priority === 'primary' ? 'text-brand-300' : 'text-white/60',
                    )}>{rec.preset_id}</p>
                    {rec.priority === 'primary' && (
                      <span className="text-[9px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-full ml-auto">Recommended</span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/50 ml-4">{rec.reason}</p>
                </div>
              ))}

              <div className="p-3 rounded-xl bg-white/3 border border-white/5 mt-2">
                <p className="text-[10px] text-white/30">
                  Use these preset IDs in the Export panel. Recommendations are based on project dimensions, content type, and duration.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/8 flex items-center justify-end flex-shrink-0">
          <button onClick={closeModal} className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
