import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Scissors, X, Loader2, AlertCircle, ChevronRight, Volume2 } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useMediaStore } from '../../store/media'
import { useTimelineStore } from '../../store/timeline'
import { startSilenceDetect, fetchAIJob, cancelAIJob } from '../../api/client'

interface SilenceSegment { start_s: number; end_s: number; duration_s: number }
type Step = 'setup' | 'processing' | 'review'

function fmtDur(s: number): string {
  if (s < 1) return `${(s * 1000).toFixed(0)}ms`
  return `${s.toFixed(2)}s`
}

function fmtTime(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = (s % 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${ss}`
}

export default function SilenceRemoveModal() {
  const closeModal             = useUIStore(s => s.closeModal)
  const notify                 = useUIStore(s => s.notify)
  const mediaItems             = useMediaStore(s => s.items)
  const applySourceTimeRemovals = useTimelineStore(s => s.applySourceTimeRemovals)

  const [step,          setStep]         = useState<Step>('setup')
  const [selectedMedia, setSelectedMedia] = useState('')
  const [selectedMediaId, setSelectedMediaId] = useState('')
  const [threshold,     setThreshold]    = useState(-40)
  const [minDuration,   setMinDuration]  = useState(0.5)
  const [jobId,         setJobId]        = useState<string | null>(null)
  const [segments,      setSegments]     = useState<SilenceSegment[]>([])
  const [selected,      setSelected]     = useState<Set<number>>(new Set())
  const [error,         setError]        = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const avItems = mediaItems.filter(m => m.type === 'video' || m.type === 'audio')

  useEffect(() => {
    if (!selectedMedia && avItems.length > 0) {
      setSelectedMedia(avItems[0].path)
      setSelectedMediaId(avItems[0].id)
    }
  }, [avItems, selectedMedia])

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const d = e.detail
      if (d?.type !== 'ai_update' || d.job_id !== jobId) return
      if (d.status === 'done' && d.result?.segments) {
        clearPoll()
        const segs: SilenceSegment[] = d.result.segments
        setSegments(segs)
        setSelected(new Set(segs.map((_: SilenceSegment, i: number) => i)))
        setStep('review')
      }
      if (d.status === 'failed') {
        clearPoll()
        setError(d.error ?? 'Silence detection failed')
        setStep('setup')
      }
    }
    window.addEventListener('ws-message', handler as EventListener)
    return () => window.removeEventListener('ws-message', handler as EventListener)
  }, [jobId])

  const clearPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])
  useEffect(() => () => clearPoll(), [clearPoll])

  const handleStart = async () => {
    if (!selectedMedia) { notify('Select a media file first', 'error'); return }
    setError(null)
    try {
      const res = await startSilenceDetect({
        media_path:         selectedMedia,
        noise_threshold_db: threshold,
        min_duration_s:     minDuration,
      })
      setJobId(res.job_id)
      setStep('processing')
      pollRef.current = setInterval(async () => {
        try {
          const job = await fetchAIJob(res.job_id)
          if (job.status === 'done' && (job.result as any)?.segments) {
            clearPoll()
            const segs: SilenceSegment[] = (job.result as any).segments
            setSegments(segs)
            setSelected(new Set(segs.map((_: SilenceSegment, i: number) => i)))
            setStep('review')
          }
          if (job.status === 'failed') {
            clearPoll()
            setError((job as any).error ?? 'Failed')
            setStep('setup')
          }
        } catch { clearPoll() }
      }, 2000)
    } catch (err: any) {
      notify(err?.message ?? 'Failed to start silence detection', 'error')
    }
  }

  const handleCancel = async () => {
    clearPoll()
    if (jobId) await cancelAIJob(jobId).catch(() => {})
    setJobId(null)
    setStep('setup')
  }

  const handleApply = () => {
    const ranges = segments
      .filter((_, i) => selected.has(i))
      .map(s => ({ start_s: s.start_s, end_s: s.end_s }))
    if (!ranges.length) { notify('No segments selected', 'error'); return }
    applySourceTimeRemovals(selectedMediaId, ranges)
    notify(`Removed ${ranges.length} silent segment${ranges.length !== 1 ? 's' : ''} from timeline`, 'success')
    closeModal()
  }

  const totalRemoved = segments
    .filter((_, i) => selected.has(i))
    .reduce((sum, s) => sum + s.duration_s, 0)

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
        className="w-full max-w-md bg-surface-100 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[82vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Scissors size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Remove Silence</h2>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">offline</span>
          </div>
          <button onClick={closeModal} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Step bar */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5 flex-shrink-0">
          {(['setup', 'processing', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                step === s ? 'bg-amber-500 text-white'
                  : i < ['setup','processing','review'].indexOf(step) ? 'bg-amber-500/30 text-amber-400'
                  : 'bg-white/10 text-white/30',
              )}>{i + 1}</div>
              <span className={clsx('text-[10px]', step === s ? 'text-white/70' : 'text-white/25')}>
                {s === 'setup' ? 'Setup' : s === 'processing' ? 'Analyzing' : 'Review'}
              </span>
              {i < 2 && <ChevronRight size={10} className="text-white/20 mx-1" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'setup' && (
            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">Media File</label>
                {avItems.length === 0 ? (
                  <p className="text-xs text-white/30 italic">Import a video or audio file first</p>
                ) : (
                  <select
                    value={selectedMedia}
                    onChange={e => {
                      setSelectedMedia(e.target.value)
                      const item = avItems.find(m => m.path === e.target.value)
                      if (item) setSelectedMediaId(item.id)
                    }}
                    className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-amber-500/50"
                  >
                    {avItems.map(m => <option key={m.id} value={m.path}>{m.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Silence Threshold</label>
                  <span className="text-[10px] text-amber-400 font-mono">{threshold} dB</span>
                </div>
                <input
                  type="range" min={-70} max={-20} step={5}
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[9px] text-white/20 mt-1">
                  <span>Very quiet only</span><span>Louder too</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Min Silence Duration</label>
                  <span className="text-[10px] text-amber-400 font-mono">{minDuration.toFixed(1)}s</span>
                </div>
                <input
                  type="range" min={0.1} max={3.0} step={0.1}
                  value={minDuration}
                  onChange={e => setMinDuration(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                <Loader2 size={28} className="text-amber-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">Scanning for silence…</p>
                <p className="text-xs text-white/30 mt-1">FFmpeg analyzes audio locally.</p>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/40">
                  {segments.length} silent segment{segments.length !== 1 ? 's' : ''} found
                </p>
                <button
                  onClick={() => setSelected(selected.size === segments.length ? new Set() : new Set(segments.map((_, i) => i)))}
                  className="text-[9px] text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                >
                  {selected.size === segments.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {segments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-white/30">
                  <Volume2 size={24} />
                  <p className="text-xs">No silence found. Try adjusting the threshold.</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {segments.map((seg, i) => (
                    <button
                      key={i}
                      onClick={() => setSelected(prev => {
                        const next = new Set(prev)
                        next.has(i) ? next.delete(i) : next.add(i)
                        return next
                      })}
                      className={clsx(
                        'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all',
                        selected.has(i) ? 'bg-amber-500/10 border-amber-500/40' : 'bg-surface-200 border-white/5 hover:border-white/15',
                      )}
                    >
                      <div className={clsx(
                        'w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0',
                        selected.has(i) ? 'bg-amber-500 border-amber-500' : 'border-white/20',
                      )}>
                        {selected.has(i) && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-white/70">
                          {fmtTime(seg.start_s)} → {fmtTime(seg.end_s)}
                        </p>
                      </div>
                      <span className="text-[9px] text-amber-400/70 flex-shrink-0">{fmtDur(seg.duration_s)}</span>
                    </button>
                  ))}
                </div>
              )}

              {selected.size > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] text-amber-300">
                    Will remove ~{fmtDur(totalRemoved)} of silence from {selected.size} segment{selected.size !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
          {step === 'setup' && (
            <>
              <button onClick={closeModal} className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">Cancel</button>
              <button
                onClick={handleStart}
                disabled={!selectedMedia}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Scissors size={12} /> Scan for Silence
              </button>
            </>
          )}
          {step === 'processing' && (
            <button onClick={handleCancel} className="ml-auto px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-all">Cancel</button>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => setStep('setup')} className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">Back</button>
              <button
                onClick={handleApply}
                disabled={selected.size === 0}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Scissors size={12} /> Remove {selected.size} Segment{selected.size !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
