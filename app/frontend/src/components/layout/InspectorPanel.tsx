import { SlidersHorizontal, Info, AlignLeft, AlignCenter, AlignRight, Type, Film, VolumeX, Volume2, Sparkles, X } from 'lucide-react'
import clsx from 'clsx'
import { useTimelineStore } from '../../store/timeline'
import { useMediaStore } from '../../store/media'
import type { Clip, MediaItem, TextStyle } from '../../types'

const EFFECT_LABELS: Record<string, string> = {
  brightness: 'Brightness', contrast: 'Contrast', saturation: 'Saturation',
  sharpness: 'Sharpness', blur: 'Blur', bw: 'B&W', warm: 'Warm', cool: 'Cool',
  cinematic: 'Cinematic', vintage: 'Vintage', vivid: 'Vivid',
  faded: 'Faded', drama: 'Drama', lut3d: 'LUT',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2)
  return `${m}:${sec.padStart(5, '0')}`
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2] as const

// ── Video/audio clip inspector ────────────────────────────────────────────────

function VideoClipInspector({
  clip, media, updateClip, removeEffect,
}: {
  clip: Clip
  media: MediaItem | undefined
  updateClip:   (id: string, patch: Partial<Clip>) => void
  removeEffect: (clipId: string, effectId: string) => void
}) {
  const dur = clip.end_s - clip.start_s

  return (
    <div className="p-3 space-y-4 text-xs">
      {/* Media info */}
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Film size={12} className="text-brand-400" />
        </div>
        <div className="min-w-0">
          <p className="text-white/70 font-medium truncate">{media?.name ?? 'Unknown media'}</p>
          <p className="text-white/30 text-[10px]">
            {media?.type ?? '—'}
            {media?.width ? ` · ${media.width}×${media.height}` : ''}
            {media?.fps ? ` · ${media.fps.toFixed(0)}fps` : ''}
          </p>
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* Timecodes */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wide">Start</p>
          <p className="text-white/60 tabular-nums font-mono text-[11px]">{fmtTime(clip.start_s)}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wide">Duration</p>
          <p className="text-white/60 tabular-nums font-mono text-[11px]">{fmtTime(dur)}</p>
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* Volume */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Volume</label>
          <span className="text-[11px] text-white/50 tabular-nums font-mono">
            {Math.round(clip.volume * 100)}%
          </span>
        </div>
        <input
          type="range" min={0} max={2} step={0.05}
          value={clip.volume}
          onChange={e => updateClip(clip.id, { volume: parseFloat(e.target.value) })}
          className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Speed */}
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Speed</label>
        <div className="grid grid-cols-5 gap-1">
          {SPEED_OPTIONS.map(spd => (
            <button
              key={spd}
              onClick={() => updateClip(clip.id, { speed: spd })}
              className={clsx(
                'py-1 rounded-lg text-[10px] transition-all',
                Math.abs(clip.speed - spd) < 0.01
                  ? 'bg-brand-600 text-white font-medium'
                  : 'bg-surface-300 text-white/40 hover:text-white/70',
              )}
            >
              {spd}×
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* Mute audio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {clip.mute_audio
            ? <VolumeX size={12} className="text-red-400" />
            : <Volume2 size={12} className="text-white/40" />}
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Mute Audio</label>
        </div>
        <button
          onClick={() => updateClip(clip.id, { mute_audio: !clip.mute_audio })}
          className={clsx(
            'w-9 h-5 rounded-full transition-all relative',
            clip.mute_audio ? 'bg-red-500' : 'bg-surface-400',
          )}
        >
          <span className={clsx(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
            clip.mute_audio ? 'left-[18px]' : 'left-0.5',
          )} />
        </button>
      </div>

      {/* Fade In */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Fade In</label>
          <span className="text-[11px] text-white/50 tabular-nums font-mono">
            {(clip.fade_in_s ?? 0).toFixed(1)}s
          </span>
        </div>
        <input
          type="range" min={0} max={3} step={0.1}
          value={clip.fade_in_s ?? 0}
          onChange={e => updateClip(clip.id, { fade_in_s: parseFloat(e.target.value) })}
          className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Fade Out */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Fade Out</label>
          <span className="text-[11px] text-white/50 tabular-nums font-mono">
            {(clip.fade_out_s ?? 0).toFixed(1)}s
          </span>
        </div>
        <input
          type="range" min={0} max={3} step={0.1}
          value={clip.fade_out_s ?? 0}
          onChange={e => updateClip(clip.id, { fade_out_s: parseFloat(e.target.value) })}
          className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Noise Reduction */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Noise Reduction</label>
          <span className="text-[11px] text-white/50 tabular-nums font-mono">
            {Math.round((clip.noise_reduction ?? 0) * 10)}%
          </span>
        </div>
        <input
          type="range" min={0} max={10} step={1}
          value={clip.noise_reduction ?? 0}
          onChange={e => updateClip(clip.id, { noise_reduction: parseInt(e.target.value) })}
          className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
        />
      </div>

      {/* Active effects */}
      {((clip.effects?.length ?? 0) > 0 || clip.transition) && (
        <>
          <div className="h-px bg-white/5" />
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={11} className="text-white/30" />
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Active Effects</label>
            </div>
            <div className="flex flex-wrap gap-1">
              {(clip.effects ?? []).map(e => (
                <span
                  key={e.id}
                  className="flex items-center gap-1 bg-brand-600/20 text-brand-300 text-[9px] px-2 py-0.5 rounded-full"
                >
                  {EFFECT_LABELS[e.type] ?? e.type}
                  <button
                    onClick={() => removeEffect(clip.id, e.id)}
                    className="text-brand-400/60 hover:text-red-400 transition-colors"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
              {clip.transition && (
                <span className="bg-surface-300 text-white/40 text-[9px] px-2 py-0.5 rounded-full">
                  ↩ {clip.transition.type}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Text clip inspector ───────────────────────────────────────────────────────

function TextClipInspector({
  clip, updateClip,
}: {
  clip: Clip
  updateClip: (id: string, patch: Partial<Clip>) => void
}) {
  const style = clip.text_style!

  const updateStyle = (patch: Partial<TextStyle>) =>
    updateClip(clip.id, { text_style: { ...style, ...patch } })

  return (
    <div className="p-3 space-y-3 text-xs">
      {/* Text content */}
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Text</label>
        <textarea
          value={clip.text_content ?? ''}
          onChange={e => updateClip(clip.id, { text_content: e.target.value })}
          rows={2}
          placeholder="Enter text…"
          className="w-full bg-surface-200 border border-white/8 rounded-lg p-2 text-white/80 text-xs resize-none outline-none focus:border-brand-500/50 transition-colors placeholder:text-white/20"
        />
      </div>

      {/* Size + color */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Size</label>
          <input
            type="number" min={8} max={200}
            value={style.size}
            onChange={e => updateStyle({ size: Math.max(8, parseInt(e.target.value) || 36) })}
            className="w-full bg-surface-200 border border-white/8 rounded-lg px-2 py-1.5 text-white/70 text-xs outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Color</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={style.color}
              onChange={e => updateStyle({ color: e.target.value })}
              className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0.5 flex-shrink-0"
            />
            <input
              type="text"
              value={style.color}
              onChange={e => updateStyle({ color: e.target.value })}
              className="flex-1 min-w-0 bg-surface-200 border border-white/8 rounded-lg px-2 py-1.5 text-white/60 text-[10px] font-mono outline-none focus:border-brand-500/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Bold / Italic / Align / Shadow */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => updateStyle({ bold: !style.bold })}
          className={clsx(
            'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
            style.bold ? 'bg-brand-600 text-white' : 'bg-surface-300 text-white/40 hover:text-white/70',
          )}
          title="Bold"
        >B</button>

        <button
          onClick={() => updateStyle({ italic: !style.italic })}
          className={clsx(
            'px-2.5 py-1 rounded-lg text-xs italic transition-all',
            style.italic ? 'bg-brand-600 text-white' : 'bg-surface-300 text-white/40 hover:text-white/70',
          )}
          title="Italic"
        >I</button>

        <div className="w-px h-4 bg-white/10 mx-0.5" />

        {(['left', 'center', 'right'] as const).map(a => (
          <button
            key={a}
            onClick={() => updateStyle({ align: a })}
            className={clsx(
              'p-1.5 rounded-lg transition-all',
              style.align === a
                ? 'bg-brand-600 text-white'
                : 'bg-surface-300 text-white/40 hover:text-white/70',
            )}
            title={`Align ${a}`}
          >
            {a === 'left' ? <AlignLeft size={11} />
              : a === 'center' ? <AlignCenter size={11} />
              : <AlignRight size={11} />}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => updateStyle({ shadow: !style.shadow })}
          className={clsx(
            'px-2 py-1 rounded-lg text-[10px] transition-all',
            style.shadow
              ? 'bg-surface-400 text-white/70'
              : 'bg-surface-300 text-white/30 hover:text-white/50',
          )}
          title="Drop shadow"
        >
          Shadow
        </button>
      </div>

      <div className="h-px bg-white/5" />

      {/* Position */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Horizontal</label>
            <span className="text-[10px] text-white/30 tabular-nums font-mono">{Math.round(style.x_pct)}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={1}
            value={style.x_pct}
            onChange={e => updateStyle({ x_pct: parseInt(e.target.value) })}
            className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Vertical</label>
            <span className="text-[10px] text-white/30 tabular-nums font-mono">{Math.round(style.y_pct)}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={1}
            value={style.y_pct}
            onChange={e => updateStyle({ y_pct: parseInt(e.target.value) })}
            className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
          />
        </div>
      </div>

      <div className="h-px bg-white/5" />

      {/* Background */}
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1.5">Background</label>
        <div className="flex gap-1.5">
          {[
            { label: 'None',  value: '' },
            { label: 'Dark',  value: '#000000cc' },
            { label: 'Light', value: '#ffffffcc' },
          ].map(opt => (
            <button
              key={opt.label}
              onClick={() => updateStyle({ bg_color: opt.value })}
              className={clsx(
                'flex-1 py-1 rounded-lg text-[10px] transition-all',
                style.bg_color === opt.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-300 text-white/40 hover:text-white/70',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-white/40 uppercase tracking-wide">Stroke</label>
          <span className="text-[10px] text-white/30 tabular-nums font-mono">{style.stroke_width}px</span>
        </div>
        <input
          type="range" min={0} max={8} step={1}
          value={style.stroke_width}
          onChange={e => updateStyle({ stroke_width: parseInt(e.target.value) })}
          className="w-full h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InspectorPanel() {
  const selectedClipId = useTimelineStore(s => s.selectedClipId)
  const tracks         = useTimelineStore(s => s.tracks)
  const updateClip     = useTimelineStore(s => s.updateClip)
  const removeEffect   = useTimelineStore(s => s.removeEffect)
  const mediaItems     = useMediaStore(s => s.items)

  const selectedClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) ?? null
  const selectedTrack = tracks.find(t => t.clips.some(c => c.id === selectedClipId)) ?? null
  const media = selectedClip ? mediaItems.find(m => m.id === selectedClip.media_id) : undefined

  const isTextClip = Boolean(selectedClip?.text_content !== undefined && selectedClip.text_style)

  return (
    <div className="w-60 flex-shrink-0 flex flex-col border-l border-white/5 bg-surface-50 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 flex-shrink-0">
        {isTextClip
          ? <Type size={13} className="text-white/40" />
          : <SlidersHorizontal size={13} className="text-white/40" />}
        <p className="text-xs font-semibold text-white/60">
          {isTextClip ? 'Text' : 'Inspector'}
        </p>
        {selectedTrack && (
          <span className="ml-auto text-[9px] bg-surface-300 text-white/30 px-1.5 py-0.5 rounded-full">
            {selectedTrack.name}
          </span>
        )}
      </div>

      {selectedClip ? (
        isTextClip ? (
          <TextClipInspector clip={selectedClip} updateClip={updateClip} />
        ) : (
          <VideoClipInspector clip={selectedClip} media={media} updateClip={updateClip} removeEffect={removeEffect} />
        )
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/15 p-4">
          <Info size={24} strokeWidth={1} />
          <p className="text-xs text-center text-white/25">
            Select a clip on the timeline to see its properties
          </p>
        </div>
      )}
    </div>
  )
}
