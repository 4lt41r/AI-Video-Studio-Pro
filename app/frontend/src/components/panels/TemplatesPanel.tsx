import { useState, useEffect } from 'react'
import { Star, Plus, BookmarkPlus, ChevronDown, ChevronUp, Trash2, Check, Loader2, User } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { useTimelineStore } from '../../store/timeline'
import { useProjectStore } from '../../store/project'
import { fetchTemplates, fetchTemplate, deleteTemplate } from '../../api/client'

interface TextClip {
  text: string
  start_s: number
  duration_s: number
  style: Record<string, unknown>
}

interface Template {
  id: string
  name: string
  category: string
  aspect_ratio: string
  width: number
  height: number
  fps: number
  description: string
  tags: string[]
  preview_gradient: string[]
  duration_hint_s: number
  is_builtin: boolean
  text_clips: TextClip[]
}

const CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'reels',    label: 'Reels' },
  { id: 'youtube',  label: 'YouTube' },
  { id: 'business', label: 'Business' },
  { id: 'events',   label: 'Events' },
  { id: 'custom',   label: 'Saved' },
]

export default function TemplatesPanel() {
  const notify         = useUIStore(s => s.notify)
  const openModal      = useUIStore(s => s.openModal)
  const activeProject  = useProjectStore(s => s.activeProject)
  const addTextClip    = useTimelineStore(s => s.addTextClip)

  const [templates,   setTemplates]   = useState<Template[]>([])
  const [loading,     setLoading]     = useState(false)
  const [cat,         setCat]         = useState('all')
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [applying,    setApplying]    = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchTemplates()
      .then(r => setTemplates(r.templates as Template[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = templates.filter(t =>
    cat === 'all' || t.category === cat
  )

  const handleApply = async (tmpl: Template) => {
    if (!activeProject) {
      notify('Open a project first', 'error')
      return
    }
    setApplying(tmpl.id)
    try {
      // Fetch full template data (with text_clips)
      const full = (await fetchTemplate(tmpl.id)) as Template
      let count = 0
      for (const tc of full.text_clips ?? []) {
        addTextClip(tc.text, tc.style as any, tc.start_s, tc.duration_s)
        count++
      }
      notify(
        `Applied "${tmpl.name}" — added ${count} text clip${count !== 1 ? 's' : ''} to timeline`,
        'success',
      )
      setExpanded(null)
    } catch (err: any) {
      notify(err?.message ?? 'Failed to apply template', 'error')
    } finally {
      setApplying(null)
    }
  }

  const handleDelete = async (tmpl: Template, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteTemplate(tmpl.id)
      setTemplates(prev => prev.filter(t => t.id !== tmpl.id))
      notify(`Deleted template "${tmpl.name}"`, 'info')
    } catch {
      notify('Could not delete template', 'error')
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={13} className="text-white/40" />
            <p className="text-xs font-semibold text-white/60">Templates</p>
          </div>
          <button
            onClick={() => openModal('save-template')}
            className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
            title="Save current project as template"
          >
            <BookmarkPlus size={11} />
            Save
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="px-3 pt-2 pb-0 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={clsx(
                'flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
                cat === c.id
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'bg-surface-300 text-white/40 hover:text-white/70 border border-transparent',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={14} className="text-brand-400 animate-spin" />
            <p className="text-xs text-white/30">Loading templates…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-2 text-white/25">
            <Star size={22} />
            <p className="text-xs">
              {cat === 'custom' ? 'No saved templates yet' : 'No templates in this category'}
            </p>
            {cat === 'custom' && (
              <button
                onClick={() => openModal('save-template')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/15 text-brand-400 text-[10px] hover:bg-brand-500/25 transition-all mt-1"
              >
                <Plus size={11} /> Save current project
              </button>
            )}
          </div>
        )}

        {!loading && filtered.map(tmpl => {
          const isExpanded = expanded === tmpl.id
          const [g1, g2]   = tmpl.preview_gradient ?? ['#6366f1', '#8b5cf6']
          const isApplying = applying === tmpl.id

          return (
            <div key={tmpl.id} className="rounded-xl overflow-hidden border border-white/5 bg-surface-200">
              {/* Card header */}
              <button
                className="w-full flex items-center gap-3 p-2.5 hover:bg-white/3 transition-all text-left"
                onClick={() => toggleExpand(tmpl.id)}
              >
                {/* Gradient preview */}
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
                >
                  {!tmpl.is_builtin && (
                    <User size={14} className="text-white/60" />
                  )}
                  {/* Aspect ratio indicator */}
                  <div className="absolute bottom-0.5 right-0.5">
                    <div
                      className={clsx(
                        'border border-white/50 rounded-sm',
                        tmpl.aspect_ratio === '9:16' ? 'w-2.5 h-4' :
                        tmpl.aspect_ratio === '1:1'  ? 'w-3 h-3' :
                                                       'w-4 h-2.5',
                      )}
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-white/80 truncate">{tmpl.name}</p>
                    {!tmpl.is_builtin && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 flex-shrink-0">saved</span>
                    )}
                  </div>
                  <p className="text-[9px] text-white/30">
                    {tmpl.aspect_ratio} · {tmpl.fps}fps
                    {tmpl.duration_hint_s > 0 ? ` · ~${tmpl.duration_hint_s}s` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!tmpl.is_builtin && (
                    <button
                      onClick={e => handleDelete(tmpl, e)}
                      className="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  {isExpanded
                    ? <ChevronUp size={12} className="text-white/30" />
                    : <ChevronDown size={12} className="text-white/30" />
                  }
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-white/5">
                  {tmpl.description && (
                    <p className="text-[10px] text-white/40 mt-2 mb-3">{tmpl.description}</p>
                  )}

                  {/* Text clips preview */}
                  {tmpl.text_clips && tmpl.text_clips.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] text-white/25 uppercase tracking-wide mb-1.5">
                        Includes {tmpl.text_clips.length} text clip{tmpl.text_clips.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-1">
                        {tmpl.text_clips.slice(0, 3).map((tc, i) => (
                          <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/3">
                            <span className="text-[8px] font-mono text-white/25 w-8 flex-shrink-0">
                              {tc.start_s.toFixed(1)}s
                            </span>
                            <p className="text-[10px] text-white/50 truncate flex-1">
                              "{tc.text}"
                            </p>
                          </div>
                        ))}
                        {tmpl.text_clips.length > 3 && (
                          <p className="text-[9px] text-white/25 pl-1">
                            +{tmpl.text_clips.length - 3} more…
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Apply button */}
                  <button
                    onClick={() => handleApply(tmpl)}
                    disabled={isApplying}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white text-xs font-medium transition-all"
                  >
                    {isApplying
                      ? <><Loader2 size={11} className="animate-spin" /> Applying…</>
                      : <><Check size={11} /> Apply to Timeline</>
                    }
                  </button>
                  <p className="text-[9px] text-white/20 text-center mt-1.5">
                    Adds text clips to your subtitle track
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {/* Save template CTA */}
        {!loading && filtered.length > 0 && (
          <button
            onClick={() => openModal('save-template')}
            className="w-full flex items-center justify-center gap-2 py-2 mt-2 rounded-xl border border-dashed border-white/10 text-white/30 text-[10px] hover:border-white/20 hover:text-white/50 transition-all"
          >
            <BookmarkPlus size={12} /> Save current project as template
          </button>
        )}
      </div>
    </div>
  )
}
