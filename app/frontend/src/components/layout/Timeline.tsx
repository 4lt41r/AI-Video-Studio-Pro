import { useRef, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, Scissors, Trash2, Volume2, VolumeX, Lock, Type } from 'lucide-react'
import clsx from 'clsx'
import { useTimelineStore } from '../../store/timeline'
import { useMediaStore } from '../../store/media'
import { useProjectStore } from '../../store/project'
import { useUIStore } from '../../store/ui'
import { fetchWaveform } from '../../api/client'
import type { Clip, Track, MediaItem } from '../../types'

const TRACK_HEIGHT = 52
const PX_PER_SEC   = 80   // pixels per second at zoom = 1.0

// ── Drag state stored in a ref (not React state) to avoid re-renders mid-drag ──

type DragOp = {
  type: 'move' | 'trim-left' | 'trim-right'
  clipId: string
  startX: number
  pxPerSec: number
  origStart: number
  origEnd: number
  origSourceStart: number
  origSourceEnd: number
  speed: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function trackDotColor(type: string) {
  switch (type) {
    case 'video':    return 'bg-brand-400'
    case 'audio':    return 'bg-emerald-400'
    case 'subtitle': return 'bg-amber-400'
    default:         return 'bg-white/30'
  }
}

function clipColors(type: string, selected: boolean) {
  const base =
    type === 'video'    ? 'bg-brand-700/80 border-brand-500/60' :
    type === 'audio'    ? 'bg-emerald-900/80 border-emerald-600/60' :
    type === 'subtitle' ? 'bg-amber-900/80 border-amber-600/60' :
                          'bg-surface-400/80 border-white/20'
  return clsx(base, selected && 'ring-1 ring-white/50')
}

function formatT(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m === 0 ? `${s}s` : `${m}:${s.toString().padStart(2, '0')}`
}

// ── WaveformViz ───────────────────────────────────────────────────────────────

function WaveformViz({
  peaks, sourceStart, sourceEnd, totalDuration, clipW, clipH,
}: {
  peaks: number[]; sourceStart: number; sourceEnd: number
  totalDuration: number; clipW: number; clipH: number
}) {
  if (!peaks.length || totalDuration <= 0 || clipW < 4) return null

  const startFrac = totalDuration > 0 ? sourceStart / totalDuration : 0
  const endFrac   = totalDuration > 0 ? sourceEnd   / totalDuration : 1
  const startIdx  = Math.floor(startFrac * peaks.length)
  const endIdx    = Math.ceil(endFrac   * peaks.length)
  const visible   = peaks.slice(startIdx, endIdx)
  if (!visible.length) return null

  const barW = clipW / visible.length
  const cy   = clipH / 2
  const paths = visible.map((p, i) => {
    const x = (i * barW).toFixed(1)
    const h = Math.max(1, p * cy * 0.75)
    return `M${x},${(cy - h).toFixed(1)} V${(cy + h).toFixed(1)}`
  }).join(' ')

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={clipW} height={clipH}
      viewBox={`0 0 ${clipW} ${clipH}`}
      preserveAspectRatio="none"
    >
      <path d={paths} stroke="rgba(255,255,255,0.22)" strokeWidth={Math.max(1, barW * 0.7)} fill="none" />
    </svg>
  )
}

// ── ClipBlock ─────────────────────────────────────────────────────────────────

type ClipBlockProps = {
  clip:          Clip
  trackType:     string
  pxPerSec:      number
  isSelected:    boolean
  mediaItem:     MediaItem | undefined
  backendUrl:    string
  waveformPeaks: number[]
  onSelect:        (id: string | null) => void
  onStartDrag:     (e: React.MouseEvent, clip: Clip) => void
  onStartTrimLeft: (e: React.MouseEvent, clip: Clip) => void
  onStartTrimRight:(e: React.MouseEvent, clip: Clip) => void
}

function ClipBlock({
  clip, trackType, pxPerSec, isSelected, mediaItem, backendUrl, waveformPeaks,
  onSelect, onStartDrag, onStartTrimLeft, onStartTrimRight,
}: ClipBlockProps) {
  const left      = clip.start_s * pxPerSec
  const width     = Math.max(4, (clip.end_s - clip.start_s) * pxPerSec)
  const clipH     = TRACK_HEIGHT - 8
  const thumbSrc  = mediaItem?.thumbnail ? `${backendUrl}${mediaItem.thumbnail}` : null
  const isText    = clip.text_content !== undefined
  const showWave  = !isText && waveformPeaks.length > 0 && (trackType === 'audio' || mediaItem?.type === 'audio')

  const trimHandle = (side: 'left' | 'right', handler: (e: React.MouseEvent, c: Clip) => void) => (
    <div
      className={clsx(
        'absolute top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-white/25 z-10',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      onMouseDown={e => { e.stopPropagation(); onSelect(clip.id); handler(e, clip) }}
    />
  )

  return (
    <div
      style={{ left, width, top: 4, height: TRACK_HEIGHT - 8 }}
      className={clsx(
        'absolute rounded-md border overflow-hidden select-none cursor-grab active:cursor-grabbing',
        clipColors(trackType, isSelected),
        mediaItem?.missing && !isText && 'opacity-40',
      )}
      onMouseDown={e => { e.stopPropagation(); onSelect(clip.id); onStartDrag(e, clip) }}
    >
      {/* Thumbnail tint (media clips only) */}
      {!isText && thumbSrc && width > 48 && (
        <img
          src={thumbSrc} alt="" draggable={false}
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        />
      )}

      {/* Waveform overlay for audio clips */}
      {showWave && (
        <WaveformViz
          peaks={waveformPeaks}
          sourceStart={clip.source_start_s}
          sourceEnd={clip.source_end_s}
          totalDuration={mediaItem?.duration_s ?? 1}
          clipW={width}
          clipH={clipH}
        />
      )}

      {/* Text clip content */}
      {isText && width > 20 && (
        <div className="absolute inset-0 flex items-center gap-1 px-2 pointer-events-none">
          <Type size={8} className="text-amber-300/70 flex-shrink-0" />
          <span className="text-[9px] text-amber-100/80 truncate leading-tight">
            {clip.text_content || '…'}
          </span>
        </div>
      )}

      {/* Clip name (media clips) */}
      {!isText && width > 24 && (
        <span className="absolute left-2 top-1 right-2 text-[9px] text-white/75 truncate pointer-events-none leading-tight">
          {mediaItem?.name ?? '…'}
        </span>
      )}

      {/* Missing indicator */}
      {!isText && mediaItem?.missing && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-red-300 pointer-events-none">
          ⚠ missing
        </span>
      )}

      {trimHandle('left',  onStartTrimLeft)}
      {trimHandle('right', onStartTrimRight)}
    </div>
  )
}

// ── RulerTicks ────────────────────────────────────────────────────────────────

function RulerTicks({ duration, pxPerSec }: { duration: number; pxPerSec: number }) {
  const interval = pxPerSec >= 200 ? 1 : pxPerSec >= 80 ? 5 : pxPerSec >= 30 ? 10 : 30
  const ticks: number[] = []
  for (let t = 0; t <= duration; t += interval) ticks.push(t)

  return (
    <>
      {ticks.map(t => (
        <div key={t} style={{ left: t * pxPerSec }} className="absolute top-0 h-full flex flex-col items-start pointer-events-none">
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[9px] text-white/25 font-mono ml-1 mt-0.5">{formatT(t)}</span>
        </div>
      ))}
    </>
  )
}

// ── Timeline (main) ───────────────────────────────────────────────────────────

export default function Timeline() {
  const tracks          = useTimelineStore(s => s.tracks)
  const zoom            = useTimelineStore(s => s.zoom)
  const zoomIn          = useTimelineStore(s => s.zoomIn)
  const zoomOut         = useTimelineStore(s => s.zoomOut)
  const playheadTime    = useTimelineStore(s => s.playheadTime)
  const setPlayhead     = useTimelineStore(s => s.setPlayheadTime)
  const duration        = useTimelineStore(s => s.duration)
  const selectedClipId  = useTimelineStore(s => s.selectedClipId)
  const selectClip      = useTimelineStore(s => s.selectClip)
  const addClipToTrack  = useTimelineStore(s => s.addClipToTrack)
  const removeClip      = useTimelineStore(s => s.removeClip)
  const updateClip      = useTimelineStore(s => s.updateClip)
  const splitAtPlayhead = useTimelineStore(s => s.splitAtPlayhead)
  const toggleTrackMute = useTimelineStore(s => s.toggleTrackMute)

  const mediaItems     = useMediaStore(s => s.items)
  const waveformCache  = useMediaStore(s => s.waveformCache)
  const setWaveform    = useMediaStore(s => s.setWaveform)
  const activeProject  = useProjectStore(s => s.activeProject)
  const backendUrl     = useUIStore(s => s.backendUrl)

  const dragRef      = useRef<DragOp | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rulerRef     = useRef<HTMLDivElement>(null)

  const pxPerSec   = PX_PER_SEC * zoom
  const totalWidth = Math.max(duration * pxPerSec + 400, 1200)

  // ── Window-level mouse handlers for dragging clips ────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const op = dragRef.current
      if (!op) return
      const dx = e.clientX - op.startX
      const dt = dx / op.pxPerSec

      if (op.type === 'move') {
        const dur      = op.origEnd - op.origStart
        const newStart = Math.max(0, op.origStart + dt)
        updateClip(op.clipId, { start_s: newStart, end_s: newStart + dur })

      } else if (op.type === 'trim-left') {
        const newStart    = Math.max(0, Math.min(op.origEnd - 0.1, op.origStart + dt))
        const srcDelta    = (newStart - op.origStart) * op.speed
        const newSrcStart = Math.max(0, op.origSourceStart + srcDelta)
        updateClip(op.clipId, { start_s: newStart, source_start_s: newSrcStart })

      } else {
        const newEnd    = Math.max(op.origStart + 0.1, op.origEnd + dt)
        const srcDelta  = (newEnd - op.origEnd) * op.speed
        const newSrcEnd = Math.max(op.origSourceStart + 0.1, op.origSourceEnd + srcDelta)
        updateClip(op.clipId, { end_s: newEnd, source_end_s: newSrcEnd })
      }
    }

    const onUp = () => { dragRef.current = null }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [updateClip])

  // ── Ctrl+wheel zoom (passive: false so preventDefault works) ──────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.deltaY < 0 ? zoomIn() : zoomOut()
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoomIn, zoomOut])

  // ── Ruler click → move playhead ───────────────────────────────────────────
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPlayhead(Math.max(0, (e.clientX - rect.left) / pxPerSec))
  }, [pxPerSec, setPlayhead])

  // ── Drop media item onto a track ──────────────────────────────────────────
  const handleTrackDrop = useCallback((e: React.DragEvent, track: Track) => {
    e.preventDefault()
    const json = e.dataTransfer.getData('application/media-item')
    if (!json) return
    // Text/subtitle tracks only accept text clips (created via TextPanel)
    if (track.type === 'subtitle') return
    let item: MediaItem
    try { item = JSON.parse(json) } catch { return }

    // Compute drop time from clientX relative to track row
    const rect      = e.currentTarget.getBoundingClientRect()
    const dropTime  = Math.max(0, (e.clientX - rect.left) / pxPerSec)
    const clipDur   = item.duration_s ?? 5

    // Overlap prevention: if drop position collides, snap to end of last clip
    let startTime = dropTime
    const overlaps = track.clips.some(
      c => startTime < c.end_s && startTime + clipDur > c.start_s,
    )
    if (overlaps) {
      startTime = track.clips.reduce((max, c) => Math.max(max, c.end_s), 0)
    }

    const clip: Clip = {
      id:             crypto.randomUUID(),
      track_id:       track.id,
      media_id:       item.id,
      start_s:        startTime,
      end_s:          startTime + clipDur,
      source_start_s: 0,
      source_end_s:   clipDur,
      speed:          1,
      volume:         1,
      effects:        [],
    }
    addClipToTrack(track.id, clip)
    selectClip(clip.id)
  }, [pxPerSec, addClipToTrack, selectClip])

  // ── Drag operation starters (capture pxPerSec at drag-start time) ─────────
  const startDrag = useCallback((e: React.MouseEvent, clip: Clip) => {
    e.preventDefault()
    dragRef.current = {
      type: 'move', clipId: clip.id, startX: e.clientX, pxPerSec,
      origStart: clip.start_s, origEnd: clip.end_s,
      origSourceStart: clip.source_start_s, origSourceEnd: clip.source_end_s,
      speed: clip.speed,
    }
  }, [pxPerSec])

  const startTrimLeft = useCallback((e: React.MouseEvent, clip: Clip) => {
    e.preventDefault()
    dragRef.current = {
      type: 'trim-left', clipId: clip.id, startX: e.clientX, pxPerSec,
      origStart: clip.start_s, origEnd: clip.end_s,
      origSourceStart: clip.source_start_s, origSourceEnd: clip.source_end_s,
      speed: clip.speed,
    }
  }, [pxPerSec])

  const startTrimRight = useCallback((e: React.MouseEvent, clip: Clip) => {
    e.preventDefault()
    dragRef.current = {
      type: 'trim-right', clipId: clip.id, startX: e.clientX, pxPerSec,
      origStart: clip.start_s, origEnd: clip.end_s,
      origSourceStart: clip.source_start_s, origSourceEnd: clip.source_end_s,
      speed: clip.speed,
    }
  }, [pxPerSec])

  // ── Fetch waveforms for all media items with audio ───────────────────────
  useEffect(() => {
    if (!activeProject?.id) return
    const mediaIds = new Set<string>()
    tracks.forEach(t => t.clips.forEach(c => {
      if (c.media_id && !c.text_content) mediaIds.add(c.media_id)
    }))
    mediaIds.forEach(mediaId => {
      if (waveformCache[mediaId] !== undefined) return
      const item = mediaItems.find(m => m.id === mediaId)
      if (!item || !item.duration_s) return
      // Only fetch waveform for items with audio (video or audio type)
      if (item.type !== 'video' && item.type !== 'audio') return
      // Optimistically mark as empty so we don't re-fetch on every render
      setWaveform(mediaId, [])
      fetchWaveform(activeProject.id, mediaId, 300)
        .then(r => { if (r.peaks.length > 0) setWaveform(mediaId, r.peaks) })
        .catch(() => {})
    })
  }, [tracks, mediaItems, waveformCache, activeProject, setWaveform])

  const clipCount = tracks.reduce((n, t) => n + t.clips.length, 0)

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-surface-50 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-white/5">
        <button
          onClick={zoomOut}
          className="p-1 text-white/30 hover:text-white rounded hover:bg-white/5 transition-all"
          title="Zoom out (Ctrl –)"
        >
          <ZoomOut size={13} />
        </button>
        <span className="text-[10px] text-white/30 font-mono w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-1 text-white/30 hover:text-white rounded hover:bg-white/5 transition-all"
          title="Zoom in (Ctrl +)"
        >
          <ZoomIn size={13} />
        </button>

        <div className="w-px h-3 bg-white/10 mx-1" />

        <button
          onClick={splitAtPlayhead}
          className="p-1 text-white/30 hover:text-white rounded hover:bg-white/5 transition-all"
          title="Split at playhead (S)"
        >
          <Scissors size={13} />
        </button>
        <button
          onClick={() => selectedClipId && removeClip(selectedClipId)}
          className={clsx(
            'p-1 rounded transition-all',
            selectedClipId
              ? 'text-white/40 hover:text-red-400 hover:bg-white/5'
              : 'text-white/15 cursor-default',
          )}
          title="Delete selected clip (Delete)"
        >
          <Trash2 size={13} />
        </button>

        <div className="flex-1" />
        <span className="text-[10px] text-white/20 mr-1">
          {clipCount} clip{clipCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Body ── */}
      <div
        className="flex-1 flex overflow-hidden"
        onClick={() => selectClip(null)}
      >
        {/* Track header column */}
        <div className="w-28 flex-shrink-0 flex flex-col border-r border-white/5">
          {/* Ruler spacer */}
          <div className="h-6 border-b border-white/5 bg-surface-100" />
          {/* Per-track header */}
          {tracks.map(track => (
            <div
              key={track.id}
              style={{ height: TRACK_HEIGHT }}
              className="flex items-center gap-1.5 px-2 border-b border-white/5 bg-surface-100"
            >
              <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', trackDotColor(track.type))} />
              <p className="text-[10px] text-white/50 flex-1 truncate">{track.name}</p>
              <div className="flex gap-0.5">
                <button
                  onClick={e => { e.stopPropagation(); toggleTrackMute(track.id) }}
                  className={clsx(
                    'p-0.5 rounded transition-all',
                    track.muted ? 'text-red-400 hover:text-red-300' : 'text-white/20 hover:text-white/50',
                  )}
                  title={track.muted ? 'Unmute track' : 'Mute track'}
                >
                  {track.muted ? <VolumeX size={9} /> : <Volume2 size={9} />}
                </button>
                <button
                  className="p-0.5 text-white/20 hover:text-white/50 rounded transition-all"
                  title={track.locked ? 'Unlock' : 'Lock'}
                >
                  <Lock size={9} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div style={{ width: totalWidth }} className="relative">

            {/* Ruler */}
            <div
              ref={rulerRef}
              onClick={handleRulerClick}
              className="h-6 border-b border-white/5 bg-surface-100 relative cursor-pointer select-none"
            >
              <RulerTicks duration={Math.max(duration + 10, 30)} pxPerSec={pxPerSec} />
            </div>

            {/* Track rows */}
            {tracks.map(track => (
              <div
                key={track.id}
                style={{ height: TRACK_HEIGHT }}
                className="relative border-b border-white/5 bg-surface-50 hover:bg-surface-100/30 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleTrackDrop(e, track)}
              >
                {track.clips.map(clip => (
                  <ClipBlock
                    key={clip.id}
                    clip={clip}
                    trackType={track.type}
                    pxPerSec={pxPerSec}
                    isSelected={clip.id === selectedClipId}
                    mediaItem={mediaItems.find(m => m.id === clip.media_id)}
                    backendUrl={backendUrl}
                    waveformPeaks={waveformCache[clip.media_id] ?? []}
                    onSelect={selectClip}
                    onStartDrag={startDrag}
                    onStartTrimLeft={startTrimLeft}
                    onStartTrimRight={startTrimRight}
                  />
                ))}
              </div>
            ))}

            {/* Playhead */}
            <div
              style={{ left: playheadTime * pxPerSec }}
              className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
            >
              <div
                className="w-3 h-3 bg-red-500 -ml-1.5 -mt-0.5"
                style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
