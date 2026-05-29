import { useRef, useEffect, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  ChevronLeft, ChevronRight, Maximize2,
} from 'lucide-react'
import clsx from 'clsx'
import { useTimelineStore } from '../../store/timeline'
import { useProjectStore } from '../../store/project'
import { useMediaStore } from '../../store/media'
import { useUIStore } from '../../store/ui'
import type { Clip, ClipEffect, MediaItem, TextStyle } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFileUrl(nativePath: string): string {
  const p = nativePath.replace(/\\/g, '/')
  return `file:///${p.startsWith('/') ? p.slice(1) : p}`
}

function getVideoSrc(item: MediaItem, backendUrl: string): string {
  if (typeof (window as any).electronAPI !== 'undefined') {
    return toFileUrl(item.path)
  }
  return `${backendUrl}/api/projects/${item.project_id}/media/${item.id}/stream`
}

function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.floor(seconds * fps)
  const f  = totalFrames % fps
  const s  = Math.floor(totalFrames / fps) % 60
  const m  = Math.floor(totalFrames / fps / 60) % 60
  const h  = Math.floor(totalFrames / fps / 3600)
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
    f.toString().padStart(2, '0'),
  ].join(':')
}

function findVideoClipAt(tracks: ReturnType<typeof useTimelineStore.getState>['tracks'], t: number): Clip | null {
  for (const track of tracks) {
    if (track.type !== 'video') continue
    for (const clip of track.clips) {
      if (t >= clip.start_s && t < clip.end_s) return clip
    }
  }
  return null
}

function findTextClipsAt(tracks: ReturnType<typeof useTimelineStore.getState>['tracks'], t: number): Clip[] {
  const result: Clip[] = []
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.text_content !== undefined && t >= clip.start_s && t < clip.end_s) {
        result.push(clip)
      }
    }
  }
  return result
}

function TextOverlay({ clips }: { clips: Clip[] }) {
  return (
    <>
      {clips.map(clip => {
        const s = clip.text_style!
        if (!s) return null
        const shadow = s.shadow ? '2px 2px 6px rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.8)' : 'none'
        const stroke = s.stroke_width > 0
          ? `0 0 0 ${s.stroke_width}px ${s.stroke_color}`
          : undefined
        const textShadow = [shadow !== 'none' ? shadow : '', stroke].filter(Boolean).join(', ') || 'none'

        return (
          <div
            key={clip.id}
            className="absolute pointer-events-none"
            style={{
              left:        `${s.x_pct}%`,
              top:         `${s.y_pct}%`,
              transform:   'translate(-50%, -50%)',
              fontSize:    `${s.size}px`,
              color:       s.color,
              fontWeight:  s.bold ? 'bold' : 'normal',
              fontStyle:   s.italic ? 'italic' : 'normal',
              textAlign:   s.align,
              textShadow,
              backgroundColor: s.bg_color
                ? s.bg_color.length === 9 ? s.bg_color.slice(0, 7) + 'cc' : s.bg_color
                : undefined,
              opacity: s.bg_color ? undefined : 1,
              padding:       s.bg_color ? '4px 12px' : '0',
              borderRadius:  s.bg_color ? '4px' : '0',
              maxWidth:      '80%',
              whiteSpace:    'pre-wrap',
              wordBreak:     'break-word',
              lineHeight:    1.2,
              zIndex:        10,
              WebkitTextStroke: s.stroke_width > 0
                ? `${s.stroke_width}px ${s.stroke_color}`
                : undefined,
            } as React.CSSProperties}
          >
            {clip.text_content}
          </div>
        )
      })}
    </>
  )
}

function effectsToCSSFilter(effects: ClipEffect[]): string {
  const parts: string[] = []
  for (const e of effects) {
    const p = (e.params ?? {}) as Record<string, number>
    switch (e.type) {
      case 'brightness': {
        const v = p.value ?? 0
        if (Math.abs(v) > 0.001) parts.push(`brightness(${(1 + v).toFixed(3)})`)
        break
      }
      case 'contrast': {
        const v = p.value ?? 1
        if (Math.abs(v - 1) > 0.001) parts.push(`contrast(${v.toFixed(3)})`)
        break
      }
      case 'saturation': {
        const v = p.value ?? 1
        if (Math.abs(v - 1) > 0.001) parts.push(`saturate(${v.toFixed(3)})`)
        break
      }
      case 'blur': {
        const sigma = p.sigma ?? 0
        if (sigma > 0) parts.push(`blur(${(sigma * 0.4).toFixed(1)}px)`)
        break
      }
      case 'bw':        parts.push('saturate(0)'); break
      case 'warm':      parts.push('sepia(0.3) hue-rotate(-10deg)'); break
      case 'cool':      parts.push('hue-rotate(20deg) saturate(0.9)'); break
      case 'cinematic': parts.push('contrast(1.08) saturate(0.85)'); break
      case 'vintage':   parts.push('sepia(0.3) contrast(0.88) saturate(0.72)'); break
      case 'vivid':     parts.push('saturate(1.85) contrast(1.12)'); break
      case 'faded':     parts.push('brightness(1.06) contrast(0.88) saturate(0.68)'); break
      case 'drama':     parts.push('contrast(1.2) saturate(0.9)'); break
    }
  }
  return parts.join(' ')
}

type Quality = 'full' | 'half' | 'quarter'

// ── Component ─────────────────────────────────────────────────────────────────

export default function PreviewArea() {
  const isPlaying    = useTimelineStore(s => s.isPlaying)
  const setPlaying   = useTimelineStore(s => s.setPlaying)
  const playheadTime = useTimelineStore(s => s.playheadTime)
  const setPlayhead  = useTimelineStore(s => s.setPlayheadTime)
  const duration     = useTimelineStore(s => s.duration)
  const tracks       = useTimelineStore(s => s.tracks)

  const project    = useProjectStore(s => s.activeProject)
  const mediaItems = useMediaStore(s => s.items)
  const backendUrl = useUIStore(s => s.backendUrl)

  const [quality, setQuality] = useState<Quality>('full')

  // ── Refs for the always-running RAF loop (avoids stale closures) ───────────
  const videoRef       = useRef<HTMLVideoElement>(null)
  const playheadRef    = useRef(playheadTime)
  const isPlayingRef   = useRef(isPlaying)
  const durationRef    = useRef(duration)
  const tracksRef      = useRef(tracks)
  const mediaRef       = useRef(mediaItems)
  const backendUrlRef  = useRef(backendUrl)
  const currentSrcRef  = useRef('')

  // Keep refs in sync with latest values on every render
  playheadRef.current   = playheadTime
  isPlayingRef.current  = isPlaying
  durationRef.current   = duration
  tracksRef.current     = tracks
  mediaRef.current      = mediaItems
  backendUrlRef.current = backendUrl

  const fps         = project?.fps ?? 30
  const aspectRatio = project ? project.width / project.height : 16 / 9

  // ── Video sync logic (runs inside RAF — no stale closure risk) ────────────
  useEffect(() => {
    let lastNow = performance.now()
    let rafId:  number

    const syncVideo = (t: number) => {
      const video = videoRef.current
      if (!video) return

      const clip = findVideoClipAt(tracksRef.current, t)

      if (!clip) {
        // Gap in timeline — pause video but keep last frame visible
        if (!video.paused) video.pause()
        return
      }

      const item = mediaRef.current.find(m => m.id === clip.media_id)
      if (!item || item.missing) {
        if (!video.paused) video.pause()
        return
      }

      const url = getVideoSrc(item, backendUrlRef.current)

      // Swap source when clip changes
      if (currentSrcRef.current !== url) {
        currentSrcRef.current = url
        video.src = url
        const targetTime = clip.source_start_s + (t - clip.start_s) * clip.speed
        video.addEventListener(
          'loadedmetadata',
          () => {
            video.currentTime = Math.max(0, targetTime)
            if (isPlayingRef.current) video.play().catch(() => {})
          },
          { once: true },
        )
        video.load()
        return
      }

      // Seek if more than 150 ms off (during scrub or clip boundary)
      const targetTime = clip.source_start_s + (t - clip.start_s) * clip.speed
      if (Math.abs(video.currentTime - targetTime) > 0.15) {
        video.currentTime = Math.max(0, targetTime)
      }

      // Ensure play/pause matches store state
      if (isPlayingRef.current && video.paused && video.readyState >= 2) {
        video.play().catch(() => {})
      } else if (!isPlayingRef.current && !video.paused) {
        video.pause()
      }
    }

    const tick = (now: number) => {
      const dt = Math.min((now - lastNow) / 1000, 0.1)
      lastNow = now

      // Advance playhead during active play
      if (isPlayingRef.current && durationRef.current > 0) {
        const next = playheadRef.current + dt
        if (next >= durationRef.current) {
          // Reached end — stop and reset
          playheadRef.current = 0
          setPlayhead(0)
          setPlaying(false)
        } else {
          playheadRef.current = next
          setPlayhead(next)
        }
      }

      syncVideo(playheadRef.current)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // Intentionally empty — refs carry all live values

  // ── Controls ──────────────────────────────────────────────────────────────

  const togglePlay = () => setPlaying(!isPlaying)

  const stop = () => {
    setPlaying(false)
    setPlayhead(0)
  }

  const stepFrame = (dir: 1 | -1) => {
    setPlayhead(Math.max(0, Math.min(duration, playheadTime + dir / fps)))
  }

  const skipToStart = () => { setPlaying(false); setPlayhead(0) }
  const skipToEnd   = () => { setPlaying(false); setPlayhead(Math.max(0, duration)) }

  // ── Active clip (for placeholder visibility + effects) ───────────────────
  const activeClip  = findVideoClipAt(tracks, playheadTime)
  const hasClip     = activeClip !== null
  const textClips   = findTextClipsAt(tracks, playheadTime)
  const cssFilter   = activeClip ? effectsToCSSFilter(activeClip.effects ?? []) : ''

  return (
    <div className="h-full flex flex-col bg-surface-0 items-center justify-center select-none">

      {/* ── Preview frame ── */}
      <div className="flex-1 flex items-center justify-center p-3 min-h-0 w-full overflow-hidden">
        <div
          className="relative bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl"
          style={{
            aspectRatio: String(aspectRatio),
            maxWidth:    '100%',
            maxHeight:   '100%',
            width:       quality === 'quarter' ? '25%' :
                         quality === 'half'    ? '50%' : '100%',
          }}
        >
          {/* Video element */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            playsInline
            preload="auto"
            style={{ display: hasClip ? 'block' : 'none', filter: cssFilter || undefined }}
          />

          {/* Placeholder when no clip at playhead */}
          {!hasClip && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10">
              <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center mb-3">
                <Play size={22} className="ml-1" />
              </div>
              <p className="text-xs">
                {duration > 0 ? 'No clip at this position' : 'Drop clips onto the timeline'}
              </p>
            </div>
          )}

          {/* Text overlays */}
          <TextOverlay clips={textClips} />

          {/* Timecode overlay */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white/70 text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none">
            {formatTimecode(playheadTime, fps)}
          </div>

          {/* Duration overlay */}
          <div className="absolute bottom-2 right-2 bg-black/70 text-white/30 text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none">
            {formatTimecode(duration, fps)}
          </div>

          {/* Quality badge */}
          <div className="absolute top-2 right-2">
            <select
              value={quality}
              onChange={e => setQuality(e.target.value as Quality)}
              onClick={e => e.stopPropagation()}
              className="bg-black/60 text-white/40 text-[9px] border border-white/10 rounded px-1.5 py-0.5 cursor-pointer outline-none hover:border-white/25 transition-colors"
            >
              <option value="full">Full</option>
              <option value="half">1/2</option>
              <option value="quarter">1/4</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Playback controls ── */}
      <div className="flex-shrink-0 flex items-center gap-1 pb-3">
        <button
          onClick={skipToStart}
          className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          title="Go to start"
        >
          <SkipBack size={14} />
        </button>

        <button
          onClick={() => stepFrame(-1)}
          className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          title="Frame back ([)"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={togglePlay}
          className={clsx(
            'w-9 h-9 rounded-full flex items-center justify-center transition-all',
            isPlaying
              ? 'bg-white/15 hover:bg-white/20 text-white'
              : 'bg-brand-600/30 hover:bg-brand-600/50 text-brand-300',
          )}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>

        <button
          onClick={() => stepFrame(1)}
          className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          title="Frame forward (])"
        >
          <ChevronRight size={14} />
        </button>

        <button
          onClick={skipToEnd}
          className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          title="Go to end"
        >
          <SkipForward size={14} />
        </button>

        {/* Timecode readout */}
        <div className="ml-3 tabular-nums text-[11px] font-mono text-white/30">
          {formatTimecode(playheadTime, fps)}
          <span className="mx-1 text-white/15">/</span>
          {formatTimecode(duration, fps)}
        </div>

        <button
          onClick={() => {/* fullscreen in future phase */}}
          className="ml-2 p-1.5 text-white/15 hover:text-white/40 rounded-lg hover:bg-white/5 transition-all"
          title="Fullscreen (Phase 10)"
        >
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  )
}
