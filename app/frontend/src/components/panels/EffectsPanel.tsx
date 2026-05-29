import type { ReactNode } from 'react'
import { Sparkles, Sun, Palette, Zap, Wind, Circle, Upload, X } from 'lucide-react'
import clsx from 'clsx'
import { useTimelineStore } from '../../store/timeline'

const PRESET_FILTERS = [
  { id: 'none',      label: 'None',      css: 'bg-surface-400' },
  { id: 'cinematic', label: 'Cinematic', css: 'bg-gradient-to-br from-amber-900 to-blue-900' },
  { id: 'warm',      label: 'Warm',      css: 'bg-gradient-to-br from-orange-600 to-amber-400' },
  { id: 'cool',      label: 'Cool',      css: 'bg-gradient-to-br from-blue-700 to-cyan-500' },
  { id: 'bw',        label: 'B&W',       css: 'bg-gradient-to-br from-gray-800 to-gray-200' },
  { id: 'vintage',   label: 'Vintage',   css: 'bg-gradient-to-br from-amber-800 to-yellow-600' },
  { id: 'faded',     label: 'Faded',     css: 'bg-gradient-to-br from-surface-300 to-white/20' },
  { id: 'vivid',     label: 'Vivid',     css: 'bg-gradient-to-br from-pink-600 to-yellow-500' },
  { id: 'drama',     label: 'Drama',     css: 'bg-gradient-to-br from-gray-900 to-gray-600' },
]

const PRESET_IDS = new Set(['cinematic', 'warm', 'cool', 'bw', 'vintage', 'faded', 'vivid', 'drama'])

const TRANSITIONS = [
  { id: 'fade',       label: 'Fade'    },
  { id: 'dissolve',   label: 'Dissolve'},
  { id: 'slideLeft',  label: 'Slide L' },
  { id: 'slideRight', label: 'Slide R' },
  { id: 'zoom',       label: 'Zoom'    },
  { id: 'wipeLeft',   label: 'Wipe'    },
]

function AdjRow({
  label, icon, min, max, step, value, neutral, display, onChange,
}: {
  label:    string
  icon:     ReactNode
  min:      number
  max:      number
  step:     number
  value:    number
  neutral:  number
  display:  string
  onChange: (v: number) => void
}) {
  const isActive = Math.abs(value - neutral) >= 0.005
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className={clsx(
        'text-[10px] w-20 flex-shrink-0 transition-colors',
        isActive ? 'text-white/60' : 'text-white/40',
      )}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 appearance-none bg-surface-300 rounded-full cursor-pointer accent-brand-500"
      />
      <span className={clsx(
        'text-[9px] font-mono w-10 text-right transition-colors',
        isActive ? 'text-brand-300' : 'text-white/25',
      )}>
        {display}
      </span>
    </div>
  )
}

export default function EffectsPanel() {
  const selectedClipId = useTimelineStore(s => s.selectedClipId)
  const tracks         = useTimelineStore(s => s.tracks)
  const addEffect      = useTimelineStore(s => s.addEffect)
  const removeEffect   = useTimelineStore(s => s.removeEffect)
  const setTransition  = useTimelineStore(s => s.setTransition)

  const selectedClip = tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) ?? null
  const isTextClip   = Boolean(selectedClip?.text_content !== undefined && selectedClip?.text_style)

  if (!selectedClipId || !selectedClip || isTextClip) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/15 p-4">
        <Sparkles size={24} strokeWidth={1} />
        <p className="text-xs text-center text-white/25">Select a video clip to apply effects</p>
      </div>
    )
  }

  const effects    = selectedClip.effects ?? []
  const transition = selectedClip.transition

  const activePreset = effects.find(e => PRESET_IDS.has(e.type))?.type ?? 'none'

  const getVal = (type: string, def: number) =>
    ((effects.find(e => e.type === type)?.params ?? {}) as Record<string, number>).value ?? def

  const setAdj = (type: string, value: number, neutral: number) => {
    if (Math.abs(value - neutral) < 0.001) {
      removeEffect(selectedClipId, type)
    } else {
      addEffect(selectedClipId, { id: type, type, params: { value } })
    }
  }

  const blurSigma = ((effects.find(e => e.type === 'blur')?.params ?? {}) as Record<string, number>).sigma ?? 0

  const applyPreset = (id: string) => {
    PRESET_IDS.forEach(pid => removeEffect(selectedClipId, pid))
    if (id !== 'none') {
      addEffect(selectedClipId, { id, type: id, params: {} })
    }
  }

  const brightness = getVal('brightness', 0)
  const contrast   = getVal('contrast',   1)
  const saturation = getVal('saturation', 1)
  const sharpness  = getVal('sharpness',  0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-white/40" />
          <p className="text-xs font-semibold text-white/60">Effects & Filters</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* ── Color Presets ── */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">Color Presets</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESET_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => applyPreset(f.id)}
                className={clsx(
                  'flex flex-col items-center gap-1 group rounded-lg p-1.5 transition-all',
                  activePreset === f.id
                    ? 'bg-brand-600/20 ring-1 ring-brand-500/50'
                    : 'hover:bg-white/5',
                )}
              >
                <div className={clsx(
                  'w-full h-7 rounded-md border transition-all', f.css,
                  activePreset === f.id ? 'border-brand-500/60' : 'border-white/10 group-hover:border-white/25',
                )} />
                <p className={clsx(
                  'text-[9px]',
                  activePreset === f.id ? 'text-brand-300' : 'text-white/30 group-hover:text-white/50',
                )}>{f.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Adjustments ── */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">Adjustments</p>
          <div className="space-y-3">
            <AdjRow
              label="Brightness"
              icon={<Sun size={11} className="text-white/30 flex-shrink-0" />}
              min={-0.5} max={0.5} step={0.01} value={brightness} neutral={0}
              display={`${brightness >= 0 ? '+' : ''}${Math.round(brightness * 100)}`}
              onChange={v => setAdj('brightness', v, 0)}
            />
            <AdjRow
              label="Contrast"
              icon={<Circle size={11} className="text-white/30 flex-shrink-0" />}
              min={0} max={2} step={0.01} value={contrast} neutral={1}
              display={`${Math.round(contrast * 100)}%`}
              onChange={v => setAdj('contrast', v, 1)}
            />
            <AdjRow
              label="Saturation"
              icon={<Palette size={11} className="text-white/30 flex-shrink-0" />}
              min={0} max={2.5} step={0.01} value={saturation} neutral={1}
              display={`${Math.round(saturation * 100)}%`}
              onChange={v => setAdj('saturation', v, 1)}
            />
            <AdjRow
              label="Sharpness"
              icon={<Zap size={11} className="text-white/30 flex-shrink-0" />}
              min={0} max={3} step={0.1} value={sharpness} neutral={0}
              display={sharpness.toFixed(1)}
              onChange={v => setAdj('sharpness', v, 0)}
            />
            <AdjRow
              label="Blur"
              icon={<Wind size={11} className="text-white/30 flex-shrink-0" />}
              min={0} max={10} step={0.5} value={blurSigma} neutral={0}
              display={`${blurSigma}px`}
              onChange={v => {
                if (v <= 0) removeEffect(selectedClipId, 'blur')
                else addEffect(selectedClipId, { id: 'blur', type: 'blur', params: { sigma: v } })
              }}
            />
          </div>
        </div>

        {/* ── Transitions ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium">Transition (into clip)</p>
            {transition && (
              <button
                onClick={() => setTransition(selectedClipId, null)}
                className="text-[9px] text-white/30 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {TRANSITIONS.map(tr => (
              <button
                key={tr.id}
                onClick={() => setTransition(
                  selectedClipId,
                  transition?.type === tr.id ? null : { type: tr.id, duration_s: 0.5 },
                )}
                className={clsx(
                  'py-2 rounded-xl text-[10px] transition-all border',
                  transition?.type === tr.id
                    ? 'bg-brand-600/30 border-brand-500/50 text-brand-300'
                    : 'bg-surface-200 border-white/5 text-white/40 hover:border-white/15 hover:text-white/60',
                )}
              >
                {tr.label}
              </button>
            ))}
          </div>
          {transition && (
            <p className="text-[9px] text-white/20 mt-1.5 pl-0.5">
              {transition.type} · {transition.duration_s}s
            </p>
          )}
        </div>

        {/* ── LUT ── */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">LUT (3D Color)</p>
          <button
            onClick={async () => {
              const ea = (window as any).electronAPI
              if (!ea?.showOpenDialog) return
              const result = await ea.showOpenDialog({
                filters: [{ name: 'LUT Files', extensions: ['cube', '3dl'] }],
                properties: ['openFile'],
              })
              if (!result.canceled && result.filePaths?.[0]) {
                addEffect(selectedClipId, {
                  id: 'lut3d', type: 'lut3d',
                  params: { path: result.filePaths[0] },
                })
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-surface-200 border border-white/8 text-[10px] text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
          >
            <Upload size={11} />
            Import .cube / .3dl
          </button>
          {effects.find(e => e.type === 'lut3d') && (
            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[9px] text-white/30 truncate">
                {String(((effects.find(e => e.type === 'lut3d')?.params ?? {}) as any).path ?? '')
                  .split(/[\\/]/).pop()}
              </p>
              <button
                onClick={() => removeEffect(selectedClipId, 'lut3d')}
                className="text-white/25 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
