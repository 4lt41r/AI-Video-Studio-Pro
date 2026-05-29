import { useState } from 'react'
import { Music, Volume2, Download, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useMediaStore } from '../../store/media'
import { useTimelineStore } from '../../store/timeline'
import { useProjectStore } from '../../store/project'
import { useUIStore } from '../../store/ui'
import { extractMediaAudio } from '../../api/client'
import type { MediaItem } from '../../types'

function fmt(s?: number | null) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return m === 0 ? `${ss}s` : `${m}:${ss.toString().padStart(2, '0')}`
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function WaveformPreview({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return (
    <div className="h-8 flex items-center justify-center text-[9px] text-white/20">
      No waveform
    </div>
  )
  const max = Math.max(...peaks, 0.01)
  return (
    <div className="flex items-center h-8 gap-px">
      {peaks.map((p, i) => (
        <div
          key={i}
          className="flex-1 bg-emerald-500/60 rounded-sm"
          style={{ height: `${Math.max(2, (p / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export default function AudioPanel() {
  const notify        = useUIStore(s => s.notify)
  const mediaItems    = useMediaStore(s => s.items)
  const waveformCache = useMediaStore(s => s.waveformCache)
  const addItems      = useMediaStore(s => s.addItems)
  const activeProject = useProjectStore(s => s.activeProject)
  const tracks        = useTimelineStore(s => s.tracks)
  const addClipToTrack = useTimelineStore(s => s.addClipToTrack)

  const [extracting, setExtracting] = useState<string | null>(null)

  const audioTrack    = tracks.find(t => t.type === 'audio')
  const audioItems    = mediaItems.filter(m => m.type === 'audio')
  const videoItems    = mediaItems.filter(m => m.type === 'video' && m.has_audio !== false)

  const handleExtractAudio = async (item: MediaItem) => {
    if (!activeProject?.id) { notify('No active project', 'error'); return }
    setExtracting(item.id)
    try {
      const newMedia: any = await extractMediaAudio(activeProject.id, item.id)
      addItems([newMedia])
      notify(`Audio extracted: ${newMedia.name}`, 'success')
    } catch (err: any) {
      notify(err?.message ?? 'Audio extraction failed', 'error')
    } finally {
      setExtracting(null)
    }
  }

  const handleAddToTimeline = (item: MediaItem) => {
    if (!audioTrack) { notify('No audio track', 'error'); return }
    const startTime = audioTrack.clips.reduce((max, c) => Math.max(max, c.end_s), 0)
    const dur = item.duration_s ?? 10
    addClipToTrack(audioTrack.id, {
      id: crypto.randomUUID(),
      track_id: audioTrack.id,
      media_id: item.id,
      start_s: startTime,
      end_s: startTime + dur,
      source_start_s: 0,
      source_end_s: dur,
      speed: 1,
      volume: 1,
      effects: [],
    })
    notify(`"${item.name}" added to audio track`, 'success')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Music size={13} className="text-white/40" />
          <p className="text-xs font-semibold text-white/60">Audio</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Audio files in project */}
        {audioItems.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">
              Audio Files
            </p>
            <div className="space-y-1.5">
              {audioItems.map(item => {
                const peaks = waveformCache[item.id] ?? []
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-surface-200 border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-xs text-white/70 truncate">{item.name}</p>
                        <p className="text-[9px] text-white/25">{fmt(item.duration_s)} · {fmtBytes(item.size_bytes)}</p>
                      </div>
                      <button
                        onClick={() => handleAddToTimeline(item)}
                        className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full hover:bg-emerald-500/30 transition-all flex-shrink-0 ml-2"
                      >
                        + Track
                      </button>
                    </div>
                    {peaks.length > 0 && <WaveformPreview peaks={peaks.slice(0, 40)} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Extract audio from video */}
        {videoItems.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">
              Extract Audio from Video
            </p>
            <div className="space-y-1">
              {videoItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleExtractAudio(item)}
                  disabled={!!extracting}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-200 border border-white/5 hover:border-white/15 disabled:opacity-50 transition-all text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    {extracting === item.id
                      ? <Loader2 size={12} className="text-emerald-400 animate-spin" />
                      : <Download size={12} className="text-emerald-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/70 group-hover:text-white truncate">{item.name}</p>
                    <p className="text-[9px] text-white/30">Save audio track as WAV</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio tips */}
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Volume2 size={10} className="text-emerald-400" />
            <p className="text-[10px] text-emerald-400 font-medium">Audio Controls</p>
          </div>
          <p className="text-[9px] text-white/25 leading-relaxed">
            Select a clip on the timeline to adjust volume, fade in/out, and noise reduction in the Inspector panel.
            Drag audio files from your media library onto the Audio track.
          </p>
        </div>

        {audioItems.length === 0 && videoItems.length === 0 && (
          <p className="text-[10px] text-white/20 text-center pt-4">
            Import media to get started
          </p>
        )}
      </div>
    </div>
  )
}
