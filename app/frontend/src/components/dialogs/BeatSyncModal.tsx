import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, X, Loader2, AlertCircle, ChevronRight, Music } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useMediaStore } from '../../store/media'
import { useTimelineStore } from '../../store/timeline'
import { startBeatDetect, fetchAIJob, cancelAIJob } from '../../api/client'

type Step = 'setup' | 'processing' | 'review'

function fmtTime(s: number): string {
  const m  = Math.floor(s / 60)
  const ss = (s % 60).toFixed(3).padStart(6, '0')
  return `${String(m).padStart(2, '0')}:${ss}`
}

export default function BeatSyncModal() {
  const closeModal        = useUIStore(s => s.closeModal)
  const notify            = useUIStore(s => s.notify)
  const mediaItems        = useMediaStore(s => s.items)
  const splitClipsAtTimes = useTimelineStore(s => s.splitClipsAtTimes)

  const [step,          setStep]         = useState<Step>('setup')
  const [selectedMedia, setSelectedMedia] = useState('')
  const [sensitivity,   setSensitivity]  = useState(0.5)
  const [jobId,         setJobId]        = useState<string | null>(null)
  const [beats,         setBeats]        = useState<number[]>([])
  const [bpm,           setBpm]          = useState(0)
  const [previewCount,  setPreviewCount] = useState(32)
  const [error,         setError]        = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const audioItems = mediaItems.filter(m => m.type === 'audio' || m.type === 'video')

  useEffect(() => {
    if (!selectedMedia && audioItems.length > 0) setSelectedMedia(audioItems[0].path)
  }, [audioItems, selectedMedia])

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const d = e.detail
      if (d?.type !== 'ai_update' || d.job_id !== jobId) return
      if (d.status === 'done' && d.result) {
        clearPoll()
        setBeats(d.result.beats ?? [])
        setBpm(d.result.bpm ?? 0)
        setStep('review')
      }
      if (d.status === 'failed') {
        clearPoll()
        setError(d.error ?? 'Beat detection failed')
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
    if (!selectedMedia) { notify('Select an audio or video file first', 'error'); return }
    setError(null)
    try {
      const res = await startBeatDetect({ media_path: selectedMedia, sensitivity })
      setJobId(res.job_id)
      setStep('processing')
      pollRef.current = setInterval(async () => {
        try {
          const job = await fetchAIJob(res.job_id)
          if (job.status === 'done' && job.result) {
            clearPoll()
            const r = job.result as any
            setBeats(r.beats ?? [])
            setBpm(r.bpm ?? 0)
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
      notify(err?.message ?? 'Failed to start beat detection', 'error')
    }
  }

  const handleCancel = async () => {
    clearPoll()
    if (jobId) await cancelAIJob(jobId).catch(() => {})
    setJobId(null)
    setStep('setup')
  }

  const handleApply = () => {
    const sliced = beats.slice(0, previewCount)
    if (!sliced.length) { notify('No beats to apply', 'error'); return }
    splitClipsAtTimes(sliced)
    notify(`Split video clips at ${sliced.length} beats (${bpm.toFixed(0)} BPM)`, 'success')
    closeModal()
  }

  const visBeats = beats.slice(0, Math.min(beats.length, 120))
  const maxBeat  = visBeats.length > 0 ? visBeats[visBeats.length - 1] : 1

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
            <Zap size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Beat Sync</h2>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">offline</span>
          </div>
          <button onClick={closeModal} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Step bar */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5 flex-shrink-0">
          {(['setup', 'processing', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                step === s ? 'bg-purple-500 text-white'
                  : i < ['setup','processing','review'].indexOf(step) ? 'bg-purple-500/30 text-purple-400'
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
                <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">Audio / Music File</label>
                {audioItems.length === 0 ? (
                  <p className="text-xs text-white/30 italic">Import an audio or video file first</p>
                ) : (
                  <select
                    value={selectedMedia}
                    onChange={e => setSelectedMedia(e.target.value)}
                    className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-purple-500/50"
                  >
                    {audioItems.map(m => <option key={m.id} value={m.path}>{m.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Beat Sensitivity</label>
                  <span className="text-[10px] text-purple-400 font-mono">{sensitivity.toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0.1} max={1.0} step={0.05}
                  value={sensitivity}
                  onChange={e => setSensitivity(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-white/20 mt-1">
                  <span>Fewer beats</span><span>More beats</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <p className="text-[10px] text-white/40">
                  Detects rhythmic energy peaks in the audio. Works best with music that has a clear beat.
                  Video clips on the main track will be split at each beat.
                </p>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center">
                <Loader2 size={28} className="text-purple-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">Analyzing beats…</p>
                <p className="text-xs text-white/30 mt-1">Energy-based onset detection — no internet needed.</p>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="p-4 space-y-4">
              {/* BPM info */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="text-center">
                  <p className="text-xl font-bold text-purple-300">{bpm.toFixed(0)}</p>
                  <p className="text-[9px] text-white/40">BPM</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-purple-300">{beats.length}</p>
                  <p className="text-[9px] text-white/40">beats</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-[10px] text-white/50">
                    {beats.length > 0 ? fmtTime(beats[beats.length - 1]) : '—'} total
                  </p>
                </div>
              </div>

              {/* Beat visualizer */}
              {visBeats.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 mb-2">Beat timeline preview</p>
                  <div className="relative h-8 bg-white/3 rounded-lg overflow-hidden">
                    {visBeats.map((b, i) => (
                      <div
                        key={i}
                        className="absolute top-0 w-0.5 h-full bg-purple-400/60"
                        style={{ left: `${(b / maxBeat) * 100}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] text-white/20 mt-1">First {visBeats.length} beats shown</p>
                </div>
              )}

              {/* Beat count limit */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Apply first N beats</label>
                  <span className="text-[10px] text-purple-400 font-mono">{Math.min(previewCount, beats.length)}</span>
                </div>
                <input
                  type="range" min={4} max={Math.max(4, beats.length)} step={1}
                  value={previewCount}
                  onChange={e => setPreviewCount(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              {beats.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-4 text-white/30">
                  <Music size={24} />
                  <p className="text-xs">No beats detected. Try increasing sensitivity.</p>
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
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Zap size={12} /> Detect Beats
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
                disabled={beats.length === 0}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Zap size={12} /> Sync {Math.min(previewCount, beats.length)} Cuts
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
