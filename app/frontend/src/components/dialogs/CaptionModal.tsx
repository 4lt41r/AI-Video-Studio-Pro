import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Brain, X, ChevronRight, Download, CheckCircle, AlertCircle, Loader2, Plus } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useMediaStore } from '../../store/media'
import { useTimelineStore } from '../../store/timeline'
import { fetchCaptionModels, startTranscription, fetchCaptionJob, cancelCaptionJob } from '../../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModelInfo {
  name: string
  size_mb: number
  downloaded: boolean
  available: boolean
}

interface Segment {
  start: number
  end:   number
  text:  string
}

type Step = 'setup' | 'processing' | 'review'

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: null,  label: 'Auto detect' },
  { code: 'en',  label: 'English' },
  { code: 'es',  label: 'Spanish' },
  { code: 'fr',  label: 'French' },
  { code: 'de',  label: 'German' },
  { code: 'it',  label: 'Italian' },
  { code: 'pt',  label: 'Portuguese' },
  { code: 'zh',  label: 'Chinese' },
  { code: 'ja',  label: 'Japanese' },
  { code: 'ko',  label: 'Korean' },
  { code: 'ar',  label: 'Arabic' },
  { code: 'hi',  label: 'Hindi' },
  { code: 'ru',  label: 'Russian' },
]

function fmtTime(s: number): string {
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  const ms = Math.round((s % 1) * 1000)
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
}

function fmtSRTTime(s: number): string {
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  const ms = Math.round((s % 1) * 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')},${String(ms).padStart(3,'0')}`
}

function generateSRT(segments: Segment[]): string {
  return segments
    .map((seg, i) => `${i + 1}\n${fmtSRTTime(seg.start)} --> ${fmtSRTTime(seg.end)}\n${seg.text}`)
    .join('\n\n')
}

function generateVTT(segments: Segment[]): string {
  const body = segments
    .map(seg => `${fmtSRTTime(seg.start).replace(',','.')} --> ${fmtSRTTime(seg.end).replace(',','.')}\n${seg.text}`)
    .join('\n\n')
  return `WEBVTT\n\n${body}`
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CaptionModal() {
  const closeModal    = useUIStore(s => s.closeModal)
  const notify        = useUIStore(s => s.notify)
  const mediaItems    = useMediaStore(s => s.items)
  const addTextClip   = useTimelineStore(s => s.addTextClip)

  // Setup state
  const [step,          setStep]         = useState<Step>('setup')
  const [models,        setModels]        = useState<ModelInfo[]>([])
  const [whisperReady,  setWhisperReady]  = useState(false)
  const [selectedModel, setSelectedModel] = useState('base')
  const [selectedMedia, setSelectedMedia] = useState('')
  const [language,      setLanguage]      = useState<string | null>(null)

  // Processing state
  const [jobId,         setJobId]         = useState<string | null>(null)
  const [procStatus,    setProcStatus]     = useState('')
  const [progress,      setProgress]       = useState(0)

  // Review state
  const [segments, setSegments] = useState<Segment[]>([])
  const [edited,   setEdited]   = useState<Segment[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // WS listener for real-time updates
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const data = e.detail
      if (data?.type !== 'caption_update') return
      if (data.job_id !== jobId)           return
      setProcStatus(data.status === 'transcribing' ? 'Transcribing with Whisper…' : '')
      setProgress(data.progress ?? 0)
      if (data.status === 'done' && data.segments) {
        clearPoll()
        setSegments(data.segments)
        setEdited(data.segments.map((s: Segment) => ({ ...s })))
        setStep('review')
      }
      if (data.status === 'failed') {
        clearPoll()
        notify(`Transcription failed: ${data.error ?? 'unknown error'}`, 'error')
        setStep('setup')
      }
    }
    window.addEventListener('ws-message', handler as EventListener)
    return () => window.removeEventListener('ws-message', handler as EventListener)
  }, [jobId, notify])

  // Fetch models on mount
  useEffect(() => {
    fetchCaptionModels()
      .then(r => {
        setModels(r.models as ModelInfo[])
        setWhisperReady(r.whisper_available)
      })
      .catch(() => {})
  }, [])

  // Pre-select first video/audio media item
  useEffect(() => {
    if (!selectedMedia) {
      const first = mediaItems.find(m => m.type === 'video' || m.type === 'audio')
      if (first) setSelectedMedia(first.path)
    }
  }, [mediaItems, selectedMedia])

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => clearPoll(), [clearPoll])

  // ── Start transcription ───────────────────────────────────────────────────

  const handleStart = async () => {
    if (!selectedMedia) { notify('Select a media file first', 'error'); return }
    if (!whisperReady)  { notify('faster-whisper is not installed', 'error'); return }

    try {
      const res = await startTranscription({
        media_path: selectedMedia,
        model:      selectedModel,
        language,
      })
      setJobId(res.job_id)
      setStep('processing')
      setProcStatus('Extracting audio…')
      setProgress(5)

      // Poll as fallback if WS misses the update
      pollRef.current = setInterval(async () => {
        try {
          const job = await fetchCaptionJob(res.job_id)
          setProgress(job.progress ?? 0)
          if (job.status === 'transcribing') setProcStatus('Transcribing with Whisper…')
          if (job.status === 'done' && job.segments) {
            clearPoll()
            const segs = job.segments as Segment[]
            setSegments(segs)
            setEdited(segs.map(s => ({ ...s })))
            setStep('review')
          }
          if (job.status === 'failed') {
            clearPoll()
            notify(`Transcription failed: ${job.error ?? ''}`, 'error')
            setStep('setup')
          }
        } catch { clearPoll() }
      }, 2000)

    } catch (err: any) {
      notify(err?.message ?? 'Failed to start transcription', 'error')
    }
  }

  const handleCancel = async () => {
    clearPoll()
    if (jobId) {
      await cancelCaptionJob(jobId).catch(() => {})
    }
    setJobId(null)
    setStep('setup')
  }

  // ── Add all to timeline ───────────────────────────────────────────────────

  const handleAddToTimeline = () => {
    let count = 0
    for (const seg of edited) {
      const dur = Math.max(0.1, seg.end - seg.start)
      addTextClip(seg.text, {}, seg.start, dur)
      count++
    }
    notify(`${count} caption${count !== 1 ? 's' : ''} added to timeline`, 'success')
    closeModal()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const videoAudioItems = mediaItems.filter(m => m.type === 'video' || m.type === 'audio')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) closeModal() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full max-w-lg bg-surface-100 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">Auto Captions</h2>
            <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">Whisper AI</span>
          </div>
          <button onClick={closeModal} className="text-white/40 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5 flex-shrink-0">
          {(['setup', 'processing', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors',
                step === s ? 'bg-brand-500 text-white'
                  : i < ['setup','processing','review'].indexOf(step) ? 'bg-brand-500/30 text-brand-400'
                  : 'bg-white/10 text-white/30',
              )}>
                {i + 1}
              </div>
              <span className={clsx(
                'text-[10px] font-medium transition-colors',
                step === s ? 'text-white/70' : 'text-white/25',
              )}>
                {s === 'setup' ? 'Setup' : s === 'processing' ? 'Processing' : 'Review'}
              </span>
              {i < 2 && <ChevronRight size={10} className="text-white/20 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: Setup ─────────────────────────────────────────────── */}
          {step === 'setup' && (
            <div className="p-6 space-y-5">

              {!whisperReady && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-300">faster-whisper not installed</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      Run in your project env: <code className="text-amber-300">pip install faster-whisper</code>
                    </p>
                  </div>
                </div>
              )}

              {/* Media selector */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">
                  Media File
                </label>
                {videoAudioItems.length === 0 ? (
                  <p className="text-xs text-white/30 italic">Import a video or audio file first</p>
                ) : (
                  <select
                    value={selectedMedia}
                    onChange={e => setSelectedMedia(e.target.value)}
                    className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="">— select media —</option>
                    {videoAudioItems.map(m => (
                      <option key={m.id} value={m.path}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Model selector */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">
                  Whisper Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {models.map(m => (
                    <button
                      key={m.name}
                      onClick={() => setSelectedModel(m.name)}
                      className={clsx(
                        'flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                        selectedModel === m.name
                          ? 'bg-brand-500/15 border-brand-500/50'
                          : 'bg-surface-200 border-white/5 hover:border-white/15',
                      )}
                    >
                      <div>
                        <p className={clsx('text-xs font-medium capitalize', selectedModel === m.name ? 'text-brand-300' : 'text-white/70')}>
                          {m.name}
                        </p>
                        <p className="text-[9px] text-white/30">{m.size_mb} MB</p>
                      </div>
                      {m.downloaded && (
                        <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-white/25 mt-2">
                  Model downloads automatically on first use. tiny = fastest, medium = most accurate.
                </p>
              </div>

              {/* Language selector */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-2">
                  Language
                </label>
                <select
                  value={language ?? ''}
                  onChange={e => setLanguage(e.target.value || null)}
                  className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-brand-500/50"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code ?? 'auto'} value={l.code ?? ''}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── STEP 2: Processing ─────────────────────────────────────────── */}
          {step === 'processing' && (
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/15 flex items-center justify-center">
                <Loader2 size={28} className="text-brand-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">{procStatus || 'Processing…'}</p>
                <p className="text-xs text-white/30 mt-1">
                  Transcription runs locally on your CPU — this may take a minute.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                {progress > 0 && progress < 100 ? (
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                ) : (
                  // Indeterminate animation during actual transcription
                  <div className="h-full bg-brand-500 rounded-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: Review ─────────────────────────────────────────────── */}
          {step === 'review' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-white/40">
                  {edited.length} segment{edited.length !== 1 ? 's' : ''} · click text to edit
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => downloadFile(generateSRT(edited), 'captions.srt')}
                    className="flex items-center gap-1 text-[9px] text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <Download size={10} /> SRT
                  </button>
                  <button
                    onClick={() => downloadFile(generateVTT(edited), 'captions.vtt')}
                    className="flex items-center gap-1 text-[9px] text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <Download size={10} /> VTT
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {edited.map((seg, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-200 border border-white/5 group">
                    <div className="flex-shrink-0 pt-0.5">
                      <p className="text-[9px] text-white/30 tabular-nums">{fmtTime(seg.start)}</p>
                      <p className="text-[9px] text-white/20 tabular-nums">{fmtTime(seg.end)}</p>
                    </div>
                    <textarea
                      value={seg.text}
                      onChange={e => {
                        const next = [...edited]
                        next[i] = { ...seg, text: e.target.value }
                        setEdited(next)
                      }}
                      rows={2}
                      className="flex-1 bg-transparent text-xs text-white/70 resize-none focus:outline-none focus:text-white/90 placeholder-white/20 leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
          {step === 'setup' && (
            <>
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedMedia || !whisperReady}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Brain size={12} />
                Start Transcription
              </button>
            </>
          )}

          {step === 'processing' && (
            <button
              onClick={handleCancel}
              className="ml-auto px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
            >
              Cancel
            </button>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('setup')}
                className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleAddToTimeline}
                disabled={edited.length === 0}
                className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                <Plus size={12} />
                Add {edited.length} to Timeline
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
