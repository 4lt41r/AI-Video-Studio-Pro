import { Type, Plus } from 'lucide-react'
import clsx from 'clsx'
import { useTimelineStore } from '../../store/timeline'
import { useUIStore } from '../../store/ui'
import type { TextStyle } from '../../types'

// ── Caption style presets ─────────────────────────────────────────────────────

type CaptionPreset = {
  id:      string
  label:   string
  preview: string
  bgClass: string
  textClass: string
  style:   Partial<TextStyle>
}

const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: 'basic', label: 'Basic', preview: 'Aa',
    bgClass: 'bg-white/10', textClass: 'text-white',
    style: { size: 36, color: '#ffffff', shadow: true },
  },
  {
    id: 'bold-white', label: 'Bold White', preview: 'Aa',
    bgClass: 'bg-white', textClass: 'text-black font-bold',
    style: { size: 40, color: '#ffffff', bold: true, shadow: true },
  },
  {
    id: 'outline', label: 'Outline', preview: 'Aa',
    bgClass: 'bg-transparent border-2 border-white', textClass: 'text-white',
    style: { size: 36, color: '#ffffff', stroke_width: 2, stroke_color: '#000000', shadow: false },
  },
  {
    id: 'filled', label: 'Filled', preview: 'Aa',
    bgClass: 'bg-black/70', textClass: 'text-white',
    style: { size: 34, color: '#ffffff', bg_color: '#000000cc', shadow: false },
  },
  {
    id: 'gradient', label: 'Gradient', preview: 'Aa',
    bgClass: 'bg-gradient-to-r from-brand-500 to-purple-600', textClass: 'text-white',
    style: { size: 36, color: '#818cf8', bold: true, shadow: true },
  },
  {
    id: 'neon', label: 'Neon', preview: 'Aa',
    bgClass: 'bg-surface-300', textClass: 'text-cyan-400',
    style: { size: 36, color: '#22d3ee', shadow: true, stroke_width: 1, stroke_color: '#0891b2' },
  },
]

// ── Title template presets ────────────────────────────────────────────────────

type TitleTemplate = {
  id:    string
  label: string
  sub:   string
  text:  string
  style: Partial<TextStyle>
}

const TITLE_TEMPLATES: TitleTemplate[] = [
  {
    id: 'lower-third', label: 'Lower Third', sub: 'Name / title overlay',
    text: 'Your Name',
    style: { size: 32, bold: true, x_pct: 15, y_pct: 80, align: 'left' },
  },
  {
    id: 'big-title', label: 'Big Title', sub: 'Full screen title card',
    text: 'BIG TITLE',
    style: { size: 72, bold: true, x_pct: 50, y_pct: 50, shadow: true },
  },
  {
    id: 'end-card', label: 'End Card', sub: 'Subscribe / follow CTA',
    text: '🔔 Subscribe!',
    style: { size: 44, bold: true, x_pct: 50, y_pct: 60 },
  },
  {
    id: 'intro', label: 'Intro', sub: 'Animated intro text',
    text: 'INTRO',
    style: { size: 72, bold: true, x_pct: 50, y_pct: 50, stroke_width: 2, stroke_color: '#6366f1' },
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function TextPanel() {
  const addTextClip = useTimelineStore(s => s.addTextClip)
  const notify      = useUIStore(s => s.notify)
  const openModal   = useUIStore(s => s.openModal)

  const handleAddText = () => {
    addTextClip('Text')
    notify('Text clip added at playhead', 'success')
  }

  const handlePreset = (preset: CaptionPreset) => {
    addTextClip(preset.label, preset.style)
    notify(`"${preset.label}" text added at playhead`, 'success')
  }

  const handleTemplate = (tmpl: TitleTemplate) => {
    addTextClip(tmpl.text, tmpl.style)
    notify(`"${tmpl.label}" added at playhead`, 'success')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Type size={13} className="text-white/40" />
          <p className="text-xs font-semibold text-white/60">Text & Captions</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Add text button */}
        <button
          onClick={handleAddText}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition-all text-xs"
        >
          <Plus size={13} />
          Add Text Layer
        </button>

        {/* Caption styles */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">
            Caption Styles
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {CAPTION_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-all group"
              >
                <div className={clsx(
                  'w-full h-8 rounded-lg flex items-center justify-center text-sm font-bold border border-white/5',
                  preset.bgClass, preset.textClass,
                )}>
                  {preset.preview}
                </div>
                <p className="text-[9px] text-white/30 group-hover:text-white/50">{preset.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Title templates */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">
            Title Templates
          </p>
          <div className="space-y-1.5">
            {TITLE_TEMPLATES.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => handleTemplate(tmpl)}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-surface-200 border border-white/5 hover:border-white/15 text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                  <Type size={12} className="text-brand-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white/70 group-hover:text-white">{tmpl.label}</p>
                  <p className="text-[9px] text-white/30">{tmpl.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* AI Captions (Phase 8) */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">
            AI Captions
          </p>
          <button
            onClick={() => openModal('caption')}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-brand-600/10 to-purple-600/10 border border-brand-500/20 hover:border-brand-500/40 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0">
              <Type size={15} className="text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">Auto Caption</p>
              <p className="text-[10px] text-white/30">Whisper AI · offline</p>
            </div>
            <div className="ml-auto text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              Ready
            </div>
          </button>
        </div>

      </div>
    </div>
  )
}
