import { create } from 'zustand'
import type { Track, Clip, ClipEffect, TimelineState, TextStyle } from '../types'
import { DEFAULT_TEXT_STYLE } from '../types'

function computeDuration(tracks: Track[]): number {
  return tracks.reduce(
    (max, t) => t.clips.reduce((m, c) => Math.max(m, c.end_s), max),
    0,
  )
}

interface TimelineStoreState {
  tracks: Track[]
  setTracks: (tracks: Track[]) => void

  playheadTime: number
  setPlayheadTime: (t: number) => void

  duration: number
  setDuration: (d: number) => void

  zoom: number
  setZoom: (z: number) => void
  zoomIn: () => void
  zoomOut: () => void

  isPlaying: boolean
  setPlaying: (v: boolean) => void

  selectedClipId: string | null
  selectClip: (id: string | null) => void

  scrollLeft: number
  setScrollLeft: (px: number) => void

  addClipToTrack:   (trackId: string, clip: Clip) => void
  removeClip:       (clipId: string) => void
  updateClip:       (clipId: string, patch: Partial<Clip>) => void
  splitAtPlayhead:  () => void
  addTextClip:      (text: string, style?: Partial<TextStyle>, startTime?: number, duration?: number) => void
  toggleTrackMute:  (trackId: string) => void
  addEffect:        (clipId: string, effect: ClipEffect) => void
  removeEffect:     (clipId: string, effectId: string) => void
  setTransition:    (clipId: string, transition: { type: string; duration_s: number } | null) => void

  // Phase 11: AI tools
  splitClipsAtTimes:      (times: number[]) => void
  applySourceTimeRemovals: (mediaId: string, ranges: Array<{ start_s: number; end_s: number }>) => void
  addHighlightClips:      (mediaId: string, segments: Array<{ start_s: number; end_s: number }>) => void

  loadState: (state: TimelineState) => void
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => ({
  tracks: [
    { id: 'track-video-1', type: 'video',    name: 'Video 1',   muted: false, locked: false, visible: true, clips: [] },
    { id: 'track-audio-1', type: 'audio',    name: 'Audio 1',   muted: false, locked: false, visible: true, clips: [] },
    { id: 'track-sub-1',   type: 'subtitle', name: 'Subtitles', muted: false, locked: false, visible: true, clips: [] },
  ],
  setTracks: (tracks) => set({ tracks, duration: computeDuration(tracks) }),

  playheadTime: 0,
  setPlayheadTime: (playheadTime) => set({ playheadTime }),

  duration: 0,
  setDuration: (duration) => set({ duration }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(20, zoom)) }),
  zoomIn:  () => set((s) => ({ zoom: Math.min(s.zoom * 1.25, 20) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(s.zoom * 0.8, 0.1) })),

  isPlaying: false,
  setPlaying: (isPlaying) => set({ isPlaying }),

  selectedClipId: null,
  selectClip: (selectedClipId) => set({ selectedClipId }),

  scrollLeft: 0,
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),

  addClipToTrack: (trackId, clip) =>
    set((s) => {
      const tracks = s.tracks.map(t =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
      )
      return { tracks, duration: computeDuration(tracks) }
    }),

  removeClip: (clipId) =>
    set((s) => {
      const tracks = s.tracks.map(t => ({
        ...t,
        clips: t.clips.filter(c => c.id !== clipId),
      }))
      return {
        tracks,
        duration: computeDuration(tracks),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
      }
    }),

  updateClip: (clipId, patch) =>
    set((s) => {
      const tracks = s.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => c.id === clipId ? { ...c, ...patch } : c),
      }))
      return { tracks, duration: computeDuration(tracks) }
    }),

  splitAtPlayhead: () =>
    set((s) => {
      const t = s.playheadTime
      let found: { clip: Clip; trackIdx: number; clipIdx: number } | null = null

      outer: for (let ti = 0; ti < s.tracks.length; ti++) {
        for (let ci = 0; ci < s.tracks[ti].clips.length; ci++) {
          const clip = s.tracks[ti].clips[ci]
          if (clip.start_s < t && clip.end_s > t) {
            found = { clip, trackIdx: ti, clipIdx: ci }
            break outer
          }
        }
      }
      if (!found) return s

      const { clip, trackIdx, clipIdx } = found
      const progress = (t - clip.start_s) / (clip.end_s - clip.start_s)
      const splitSrc  = clip.source_start_s + (clip.source_end_s - clip.source_start_s) * progress

      const left: Clip  = { ...clip, id: crypto.randomUUID(), end_s: t,         source_end_s: splitSrc }
      const right: Clip = { ...clip, id: crypto.randomUUID(), start_s: t,       source_start_s: splitSrc }

      const tracks = s.tracks.map((track, ti) => {
        if (ti !== found!.trackIdx) return track
        const clips = [...track.clips]
        clips.splice(clipIdx, 1, left, right)
        return { ...track, clips }
      })
      return { tracks, duration: computeDuration(tracks) }
    }),

  addTextClip: (text, style = {}, startTime, duration) =>
    set((s) => {
      const targetTrack = s.tracks.find(t => t.type === 'subtitle') ?? s.tracks[0]
      if (!targetTrack) return s

      const st  = startTime ?? s.playheadTime
      const dur = duration  ?? 3
      const clip: Clip = {
        id:             crypto.randomUUID(),
        track_id:       targetTrack.id,
        media_id:       '',
        start_s:        st,
        end_s:          st + dur,
        source_start_s: 0,
        source_end_s:   dur,
        speed:          1,
        volume:         1,
        effects:        [],
        text_content:   text,
        text_style:     { ...DEFAULT_TEXT_STYLE, ...style },
      }
      const tracks = s.tracks.map(t =>
        t.id === targetTrack.id ? { ...t, clips: [...t.clips, clip] } : t,
      )
      return { tracks, duration: computeDuration(tracks), selectedClipId: clip.id }
    }),

  toggleTrackMute: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t),
    })),

  addEffect: (clipId, effect) =>
    set((s) => ({
      tracks: s.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => {
          if (c.id !== clipId) return c
          const rest = (c.effects ?? []).filter(e => e.type !== effect.type)
          return { ...c, effects: [...rest, effect] }
        }),
      })),
    })),

  removeEffect: (clipId, effectId) =>
    set((s) => ({
      tracks: s.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id !== clipId ? c : { ...c, effects: (c.effects ?? []).filter(e => e.id !== effectId) }
        ),
      })),
    })),

  setTransition: (clipId, transition) =>
    set((s) => ({
      tracks: s.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c =>
          c.id !== clipId ? c : { ...c, transition: transition ?? undefined }
        ),
      })),
    })),

  // ── Phase 11: AI Smart Tools ───────────────────────────────────────────────

  splitClipsAtTimes: (times) =>
    set((s) => {
      // Apply splits in descending time order so earlier indices stay valid
      const sorted = [...times].sort((a, b) => b - a)
      let tracks = s.tracks
      for (const t of sorted) {
        let found: { clip: Clip; trackIdx: number; clipIdx: number } | null = null
        outer: for (let ti = 0; ti < tracks.length; ti++) {
          for (let ci = 0; ci < tracks[ti].clips.length; ci++) {
            const clip = tracks[ti].clips[ci]
            if (clip.start_s < t - 0.05 && clip.end_s > t + 0.05) {
              found = { clip, trackIdx: ti, clipIdx: ci }
              break outer
            }
          }
        }
        if (!found) continue
        const { clip, trackIdx, clipIdx } = found
        const prog    = (t - clip.start_s) / (clip.end_s - clip.start_s)
        const splitSrc = clip.source_start_s + (clip.source_end_s - clip.source_start_s) * prog
        const left:  Clip = { ...clip, id: crypto.randomUUID(), end_s: t,   source_end_s: splitSrc }
        const right: Clip = { ...clip, id: crypto.randomUUID(), start_s: t, source_start_s: splitSrc }
        tracks = tracks.map((track, ti) => {
          if (ti !== found!.trackIdx) return track
          const clips = [...track.clips]
          clips.splice(clipIdx, 1, left, right)
          return { ...track, clips }
        })
      }
      return { tracks, duration: computeDuration(tracks) }
    }),

  applySourceTimeRemovals: (mediaId, ranges) =>
    set((s) => {
      let tracks = s.tracks
      // Process each range
      for (const range of ranges) {
        const { start_s: rStart, end_s: rEnd } = range
        const updates: Array<{ trackIdx: number; clipIdx: number; action: 'remove' | 'trimStart' | 'trimEnd' | 'split'; data?: any }> = []

        for (let ti = 0; ti < tracks.length; ti++) {
          for (let ci = 0; ci < tracks[ti].clips.length; ci++) {
            const clip = tracks[ti].clips[ci]
            if (clip.media_id !== mediaId) continue
            const { source_start_s: ss, source_end_s: se, start_s: ts, speed = 1 } = clip
            // Check overlap in source time
            if (rEnd <= ss || rStart >= se) continue
            // Map source range to timeline range
            const tlStart = ts + (Math.max(rStart, ss) - ss) / speed
            const tlEnd   = ts + (Math.min(rEnd, se)   - ss) / speed

            if (rStart <= ss && rEnd >= se) {
              updates.push({ trackIdx: ti, clipIdx: ci, action: 'remove' })
            } else if (rStart <= ss) {
              // silence covers start of clip — trim from left
              const newSrcStart = rEnd
              const newTlStart  = ts + (rEnd - ss) / speed
              updates.push({ trackIdx: ti, clipIdx: ci, action: 'trimStart', data: { source_start_s: newSrcStart, start_s: newTlStart } })
            } else if (rEnd >= se) {
              // silence covers end of clip — trim from right
              const newSrcEnd = rStart
              const newTlEnd  = ts + (rStart - ss) / speed
              updates.push({ trackIdx: ti, clipIdx: ci, action: 'trimEnd', data: { source_end_s: newSrcEnd, end_s: newTlEnd } })
            } else {
              // silence is in the middle — split and remove middle
              updates.push({ trackIdx: ti, clipIdx: ci, action: 'split', data: { tlStart, tlEnd, rStart, rEnd } })
            }
          }
        }

        // Apply updates in reverse clip index order to preserve indices
        for (const u of updates.sort((a, b) => b.clipIdx - a.clipIdx)) {
          const { trackIdx, clipIdx, action, data } = u
          if (action === 'remove') {
            tracks = tracks.map((t, ti) => ti !== trackIdx ? t : { ...t, clips: t.clips.filter((_, ci) => ci !== clipIdx) })
          } else if (action === 'trimStart') {
            tracks = tracks.map((t, ti) => ti !== trackIdx ? t : {
              ...t,
              clips: t.clips.map((c, ci) => ci !== clipIdx ? c : { ...c, ...data }),
            })
          } else if (action === 'trimEnd') {
            tracks = tracks.map((t, ti) => ti !== trackIdx ? t : {
              ...t,
              clips: t.clips.map((c, ci) => ci !== clipIdx ? c : { ...c, ...data }),
            })
          } else if (action === 'split') {
            const clip = tracks[trackIdx].clips[clipIdx]
            const { tlStart, tlEnd, rStart: rs, rEnd: re } = data
            const left:  Clip = { ...clip, id: crypto.randomUUID(), end_s: tlStart, source_end_s: rs }
            const right: Clip = { ...clip, id: crypto.randomUUID(), start_s: tlEnd, source_start_s: re }
            tracks = tracks.map((t, ti) => {
              if (ti !== trackIdx) return t
              const clips = [...t.clips]
              clips.splice(clipIdx, 1, left, right)
              return { ...t, clips }
            })
          }
        }
      }
      return { tracks, duration: computeDuration(tracks) }
    }),

  addHighlightClips: (mediaId, segments) =>
    set((s) => {
      const videoTrack = s.tracks.find(t => t.type === 'video')
      if (!videoTrack) return s
      // Find a source clip that uses this mediaId to copy its metadata
      let srcClip: Clip | null = null
      for (const t of s.tracks) {
        const found = t.clips.find(c => c.media_id === mediaId)
        if (found) { srcClip = found; break }
      }
      const timelineStart = computeDuration(s.tracks)
      let cursor = timelineStart
      const newClips: Clip[] = []
      for (const seg of segments) {
        const dur = seg.end_s - seg.start_s
        if (dur <= 0) continue
        newClips.push({
          id:             crypto.randomUUID(),
          track_id:       videoTrack.id,
          media_id:       mediaId,
          start_s:        cursor,
          end_s:          cursor + dur,
          source_start_s: seg.start_s,
          source_end_s:   seg.end_s,
          speed:          1,
          volume:         srcClip?.volume ?? 1,
          effects:        [],
        })
        cursor += dur
      }
      if (!newClips.length) return s
      const tracks = s.tracks.map(t =>
        t.id === videoTrack.id ? { ...t, clips: [...t.clips, ...newClips] } : t,
      )
      return { tracks, duration: computeDuration(tracks) }
    }),

  loadState: (state) =>
    set({
      tracks:   state.tracks,
      duration: state.duration_s,
    }),
}))
