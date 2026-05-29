import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookmarkPlus, X, Loader2, Check } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useProjectStore } from '../../store/project'
import { useTimelineStore } from '../../store/timeline'
import { saveTemplate } from '../../api/client'

const CATEGORIES = [
  { id: 'reels',    label: 'Reels / TikTok' },
  { id: 'youtube',  label: 'YouTube' },
  { id: 'business', label: 'Business' },
  { id: 'events',   label: 'Events' },
  { id: 'custom',   label: 'Custom' },
]

const GRADIENTS: [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#ec4899', '#9333ea'],
  ['#dc2626', '#f97316'],
  ['#10b981', '#0891b2'],
  ['#f59e0b', '#ef4444'],
  ['#0ea5e9', '#6366f1'],
]

export default function SaveTemplateModal() {
  const closeModal    = useUIStore(s => s.closeModal)
  const notify        = useUIStore(s => s.notify)
  const activeProject = useProjectStore(s => s.activeProject)
  const tracks        = useTimelineStore(s => s.tracks)

  const [name,       setName]       = useState(activeProject?.name ? `${activeProject.name} Template` : 'My Template')
  const [category,   setCategory]   = useState('custom')
  const [description, setDescription] = useState('')
  const [gradient,   setGradient]   = useState(0)
  const [saving,     setSaving]     = useState(false)

  if (!activeProject) return null

  // Collect text clips from subtitle/overlay tracks
  const textClips = tracks
    .filter(t => t.type === 'subtitle' || t.type === 'overlay')
    .flatMap(t => t.clips)
    .filter(c => c.text_content)
    .map(c => ({
      text:      c.text_content!,
      start_s:   c.start_s,
      duration_s: c.end_s - c.start_s,
      style:     c.text_style ?? {},
    }))

  const handleSave = async () => {
    if (!name.trim()) { notify('Enter a template name', 'error'); return }
    setSaving(true)
    try {
      await saveTemplate({
        name:             name.trim(),
        category,
        description,
        aspect_ratio:     activeProject.aspect_ratio,
        width:            activeProject.width,
        height:           activeProject.height,
        fps:              activeProject.fps,
        text_clips:       textClips,
        preview_gradient: GRADIENTS[gradient],
      })
      notify(`Template "${name.trim()}" saved!`, 'success')
      closeModal()
    } catch (err: any) {
      notify(err?.message ?? 'Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
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
        className="w-full max-w-sm bg-surface-100 rounded-2xl shadow-2xl border border-white/10 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <BookmarkPlus size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">Save as Template</h2>
          </div>
          <button onClick={closeModal} className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Project info */}
          <div className="p-3 rounded-xl bg-surface-200 border border-white/5 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${GRADIENTS[gradient][0]}, ${GRADIENTS[gradient][1]})` }}
            />
            <div>
              <p className="text-xs font-medium text-white/70">{activeProject.name}</p>
              <p className="text-[10px] text-white/30">
                {activeProject.aspect_ratio} · {activeProject.width}×{activeProject.height} · {activeProject.fps}fps
              </p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/50"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
                    category === c.id
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'bg-surface-300 text-white/40 hover:text-white/60 border border-transparent',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-1.5">
              Preview Color
            </label>
            <div className="flex gap-2">
              {GRADIENTS.map(([g1, g2], i) => (
                <button
                  key={i}
                  onClick={() => setGradient(i)}
                  className={clsx(
                    'w-7 h-7 rounded-lg transition-all',
                    gradient === i ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-surface-100' : '',
                  )}
                  style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide font-medium block mb-1.5">
              Description <span className="text-white/20">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. My go-to layout for product demos"
              className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* What's included */}
          <div className="p-3 rounded-xl bg-white/3 border border-white/5">
            <p className="text-[10px] text-white/40 font-medium mb-1">What gets saved</p>
            <ul className="space-y-0.5">
              <li className="text-[10px] text-white/50 flex items-center gap-1.5">
                <Check size={9} className="text-emerald-400" />
                Project format ({activeProject.aspect_ratio}, {activeProject.width}×{activeProject.height}, {activeProject.fps}fps)
              </li>
              <li className="text-[10px] text-white/50 flex items-center gap-1.5">
                <Check size={9} className="text-emerald-400" />
                {textClips.length} text clip{textClips.length !== 1 ? 's' : ''} from subtitle track
              </li>
              <li className="text-[10px] text-white/25 flex items-center gap-1.5">
                <X size={9} className="text-white/20" />
                Media files (not included — templates are layout-only)
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-white text-xs font-medium transition-all"
          >
            {saving
              ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
              : <><BookmarkPlus size={11} /> Save Template</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
