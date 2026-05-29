import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, X, Loader2, AlertCircle, ChevronRight, Scissors } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useMediaStore } from '../../store/media'
import { useTimelineStore } from '../../store/timeline'
import { startSceneDetect, fetchAIJob, cancelAIJob } from '../../api/client'

interface Scene { time_s: number; score: number }
type Step = 'setup' | 'processing' | 'review'

function fmtTime(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = (s % 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${ss}`
}

export default function SceneDetectModal() {
  const closeModal         = useUIStore(s => s.closeModal)
  const notify             = useUIStore(s => s.notify)
  const mediaItems         = useMediaStore(s => s.items)
  const splitClipsAtTimes  = useTimelineStore(s => s.splitClipsAtTimes)

  const [step,          setStep]         = useState<Step>('setup')
  const [selectedMedia, setSelectedMedia] = useState('')
  const [threshold,     setThreshold]    = useState(0.3)
  const [jobId,         setJobId]        = useState<string | null>(null)
  const [scenes,        setScenes]       = useState<Scene[]>([])
  const [selected,      setSelected]     = useState<Set<number>>(new Set())
  const [error,         setError]        = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const videoItems = mediaItems.filter(m => m.type === 'video')

  useEffect(() => {
    if (!selectedMedia && videoItems.length > 0) setSelectedMedia(videoItems[0].path)
  }, [videoItems, selectedMedia])

  // WS listener
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const d = e.detail
      if (d?.type !== 'ai_update' || d.job_id !== jobId) return
      if (d.status === 'done' && d.result?.scenes) {
        clearPoll()
        const s: Scene[] = d.result.scenes
        setScenes(s)
        setSelected(new Set(s.map((_: Scene, i: number) => i)))
        setStep('review')
      }
      if (d.status === 'failed') {
        clearPoll()
        setError(d.error ?? 'Scene detection failed')
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
    if (!selectedMedia) { notify('Select a video file first', 'error'); return }
    setError(null)
    try {
      const res = await startSceneDetect({ media_path: selectedMedia, threshold })
      setJobId(res.job_id)
      setStep('processing')
      pollRef.current = setInterval(async () => {
        try {
          const job = await fetchAIJob(res.job_id)
          if (job.status === 'done' && (job.result as any)?.scenes) {
            clearPoll()
            const s: Scene[] = (job.result as any).scenes
            setScenes(s)
            setSelected(new Set(s.map((_: Scene, i: number) => i)))
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
      notify(err?.message ?? 'Failed to start scene detection', 'error')
    }
  }

  const handleCancel = async () => {
    clearPoll()
    if (jobId) await cancelAIJob(jobId).catch(() => {})
    setJobId(null)
    setStep('setup')
  }

  const handleApply = () => {
    const times = scenes
      .filter((_, i) => selected.has(i))
      .map(s => s.time_s)
    if (!times.length) { notify('No scenes selected', 'error'); return }
    splitClipsAtTimes(times)
    notify(`Applied ${times.length} scene cut${times.length !== 1 ? 's' : ''} to timeline`, 'success')
    closeModal()
  }

  const toggleAll = () => {
    if (selected.size === scenes.length)
      setSelected(new Set())
    else
      setSelected(new Set(scenes.map((_, i) => i)))
  }

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
        className="w-full max-w-md bg-surface-100 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Scene Detection</h2>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">offline</span>
          </div>
          <button onClick={closeModal} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Step bar */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5 flex-shrink-0">
          {(['setup', 'processing', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors',
                step === s ? 'bg-cyan-500 text-white'
                  : i < ['setup','processing','review'].indexOf(step) ? 'bg-cyan-500/30 text-cyan-400'
                  : 'bg-white/10 text-white/30',
              )}>{i + 1}</div>
              <span className={clsx('text-[10px]', step === s ? 'text-white/70' : 'text-white/25')}>
                {s === 'setup' ? 'Setup' : s === 'processing' ? 'Analyzing' : 'Review'}
              </span>
              {i < 2 && <ChevronRight size={10} className="text-white/20 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
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
                <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">Video File</label>
                {videoItems.length === 0 ? (
                  <p className="text-xs text-white/30 italic">Import a video file first</p>
                ) : (
                  <select
                    value={selectedMedia}
                    onChange={e => setSelectedMedia(e.target.value)}
                    className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-cyan-500/50"
                  >
                    {videoItems.map(m => <option key={m.id} value={m.path}>{m.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">
                    Sensitivity
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">{threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0.05} max={0.8} step={0.05}
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[9px] text-white/20 mt-1">
                  <span>More scenes</span><span>Fewer scenes</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <p className="text-[10px] text-white/40">
                  FFmpeg scans for visual changes between frames. Scene cuts will be added to your timeline video clips.
                </p>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 flex items-center justify-center">
                <Loader2 size={28} className="text-cyan-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">Detecting scene changes…</p>
                <p className="text-xs text-white/30 mt-1">FFmpeg is analyzing every frame locally.</p>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/40">
                  {scenes.length} scene{scenes.length !== 1 ? 's' : ''} detected
                  · {selected.size} selected
                </p>
                <button onClick={toggleAll} className="text-[9px] text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-all">
                  {selected.size === scenes.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {scenes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-white/30">
                  <Search size={24} />
                  <p className="text-xs">No scene changes detected. Try lowering the sensitivity.</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {scenes.map((sc, i) => (
                    <button
                      key={i}
                      onClick={() => setSelected(prev => {
                        const next = new Set(prev)
                        next.has(i) ? next.delete(i) : next.add(i)
                        return next
                      })}
                      className={clsx(
                        'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all',
                        selected.has(i)
                          ? 'bg-cyan-500/10 border-cyan-500/40'
                          : 'bg-surface-200 border-white/5 hover:border-white/15',
                      )}
                    >
                      <div className={clsx(
                        'w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0',
                        selected.has(i) ? 'bg-cyan-500 border-cyan-500' : 'border-white/20',
                      )}>
                        {selected.has(i) && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      <Scissors size={12} className="text-white/30 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-mono text-white/70">{fmtTime(sc.time_s)}</p>
                      </div>
                      <p className="text-[9px] text-white/25">scene {i + 1}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
          {step === 'setup' && (
            <>
              <button onClick={closeModal} className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedMedia}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Search size={12} /> Detect Scenes
              </button>
            </>
          )}
          {step === 'processing' && (
            <button onClick={handleCancel} className="ml-auto px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-all">
              Cancel
            </button>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => setStep('setup')} className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
                Back
              </button>
              <button
                onClick={handleApply}
                disabled={selected.size === 0}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Scissors size={12} /> Apply {selected.size} Cut{selected.size !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
