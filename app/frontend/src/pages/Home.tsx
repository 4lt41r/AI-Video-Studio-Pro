import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FolderOpen, Film, Clock, ChevronRight,
  Clapperboard, Star, Grid3X3, List, Search,
  Zap, Wifi, WifiOff, Activity, Loader2, X, Check, User,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchProjects, createProject, fetchHealth, fetchTemplates, applyTemplate } from '../api/client'
import { useUIStore } from '../store/ui'
import type { Project } from '../types'

// ── Template Picker Modal ─────────────────────────────────────────────────────

interface TemplateSummary {
  id: string
  name: string
  category: string
  aspect_ratio: string
  width: number
  height: number
  fps: number
  description: string
  preview_gradient: string[]
  duration_hint_s: number
  is_builtin: boolean
}

const TMPL_CATS = [
  { id: 'all',      label: 'All' },
  { id: 'reels',    label: 'Reels' },
  { id: 'youtube',  label: 'YouTube' },
  { id: 'business', label: 'Business' },
  { id: 'events',   label: 'Events' },
  { id: 'custom',   label: 'Saved' },
]

function TemplatePickerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const notify   = useUIStore(s => s.notify)

  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading,   setLoading]   = useState(true)
  const [cat,       setCat]       = useState('all')
  const [selected,  setSelected]  = useState<TemplateSummary | null>(null)
  const [name,      setName]      = useState('')
  const [busy,      setBusy]      = useState(false)

  useEffect(() => {
    fetchTemplates()
      .then(r => setTemplates(r.templates as TemplateSummary[]))
      .catch(() => notify('Could not load templates', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = templates.filter(t => cat === 'all' || t.category === cat)

  const handleSelect = (tmpl: TemplateSummary) => {
    setSelected(tmpl)
    setName(`${tmpl.name} — Project`)
  }

  const handleCreate = async () => {
    if (!selected || !name.trim()) return
    setBusy(true)
    try {
      const project = await createProject({
        name:         name.trim(),
        aspect_ratio: selected.aspect_ratio,
        width:        selected.width,
        height:       selected.height,
        fps:          selected.fps,
      }) as Project
      await applyTemplate(selected.id, project.id)
      navigate(`/editor/${project.id}`)
      onClose()
    } catch (err: any) {
      notify(err?.message ?? 'Could not create project from template', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-surface-100 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Star size={14} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Start from Template</h2>
              <p className="text-[10px] text-white/30">Pick a layout and create a new project</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-1">
            <X size={15} />
          </button>
        </div>

        {/* Category filter */}
        <div className="px-5 pt-3 pb-0 flex-shrink-0">
          <div className="flex gap-1.5">
            {TMPL_CATS.map(c => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
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

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 size={16} className="text-brand-400 animate-spin" />
              <p className="text-xs text-white/30">Loading templates…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-2 text-white/25">
              <Star size={24} />
              <p className="text-xs">No templates in this category</p>
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map(tmpl => {
                const [g1, g2] = tmpl.preview_gradient ?? ['#6366f1', '#8b5cf6']
                const isSel    = selected?.id === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelect(tmpl)}
                    className={clsx(
                      'rounded-xl border p-3 text-left transition-all group',
                      isSel
                        ? 'border-brand-500/50 bg-brand-500/10'
                        : 'border-white/5 bg-surface-200 hover:border-white/12',
                    )}
                  >
                    {/* Gradient preview */}
                    <div
                      className="w-full aspect-video rounded-lg mb-2.5 relative overflow-hidden flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}
                    >
                      {!tmpl.is_builtin && (
                        <User size={14} className="text-white/50" />
                      )}
                      {/* Aspect ratio indicator */}
                      <div className="absolute bottom-1.5 right-1.5">
                        <div className={clsx(
                          'border border-white/60 rounded-sm',
                          tmpl.aspect_ratio === '9:16' ? 'w-3 h-5' :
                          tmpl.aspect_ratio === '1:1'  ? 'w-4 h-4' : 'w-5 h-3',
                        )} />
                      </div>
                      {isSel && (
                        <div className="absolute inset-0 flex items-center justify-center bg-brand-500/30">
                          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-medium text-white/80 truncate">{tmpl.name}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {tmpl.aspect_ratio} · {tmpl.fps}fps
                      {tmpl.duration_hint_s > 0 ? ` · ~${tmpl.duration_hint_s}s` : ''}
                    </p>
                    {tmpl.description && (
                      <p className="text-[10px] text-white/25 mt-1 line-clamp-2">{tmpl.description}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — shown when a template is selected */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden flex-shrink-0"
            >
              <div className="px-5 py-4 border-t border-white/8 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium mb-1">Project name</p>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    className="w-full bg-surface-200 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/50"
                    autoFocus
                  />
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all flex-shrink-0"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={busy || !name.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-medium transition-all flex-shrink-0"
                >
                  {busy
                    ? <><Loader2 size={11} className="animate-spin" /> Creating…</>
                    : <><Plus size={11} /> Create Project</>
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── New Project Modal ─────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', sub: 'Reels / Shorts',     w: 1080, h: 1920 },
  { id: '16:9', label: '16:9', sub: 'YouTube / Landscape', w: 1920, h: 1080 },
  { id: '1:1',  label: '1:1',  sub: 'Instagram Post',      w: 1080, h: 1080 },
  { id: '4:5',  label: '4:5',  sub: 'Instagram Portrait',  w: 1080, h: 1350 },
]

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const navigate  = useNavigate()
  const notify    = useUIStore(s => s.notify)
  const [name,    setName]    = useState('Untitled Project')
  const [ratio,   setRatio]   = useState('9:16')
  const [fps,     setFps]     = useState('30')
  const [busy,    setBusy]    = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const sel     = ASPECT_RATIOS.find(r => r.id === ratio)!
      const project = await createProject({
        name: name.trim(), aspect_ratio: ratio,
        width: sel.w, height: sel.h, fps: Number(fps),
      }) as Project
      navigate(`/editor/${project.id}`)
      onClose()
    } catch {
      notify('Could not create project — is the backend running?', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-surface-100 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center">
            <Film size={16} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">New Project</h2>
            <p className="text-[11px] text-white/30">Set up your editing workspace</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium uppercase tracking-wide">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full bg-surface-200 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-500/60 transition-colors"
              autoFocus
              placeholder="My Awesome Project"
            />
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium uppercase tracking-wide">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map(r => (
                <button key={r.id} onClick={() => setRatio(r.id)}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                    ratio === r.id
                      ? 'bg-brand-600/15 border-brand-500/50 text-white'
                      : 'bg-surface-200 border-white/5 text-white/50 hover:border-white/15',
                  )}>
                  {/* Aspect ratio visual */}
                  <div className={clsx('flex-shrink-0 border-2 rounded', ratio === r.id ? 'border-brand-400' : 'border-white/20',
                    r.id === '9:16' ? 'w-4 h-7' : r.id === '16:9' ? 'w-7 h-4' : r.id === '1:1' ? 'w-5 h-5' : 'w-5 h-6'
                  )} />
                  <div>
                    <p className="text-xs font-semibold">{r.label}</p>
                    <p className="text-[10px] opacity-50">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-medium uppercase tracking-wide">Frame Rate</label>
            <div className="flex gap-2">
              {['24', '30', '60'].map(f => (
                <button key={f} onClick={() => setFps(f)}
                  className={clsx(
                    'flex-1 py-2 rounded-xl border text-xs font-medium transition-all',
                    fps === f ? 'bg-brand-600/15 border-brand-500/50 text-white' : 'bg-surface-200 border-white/5 text-white/40 hover:border-white/15',
                  )}>
                  {f} fps
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={busy || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-medium text-sm transition-all">
            {busy
              ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <Plus size={15} />}
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (id: string) => void }) {
  const aspectClass = project.aspect_ratio === '9:16' ? 'aspect-[9/16]' : project.aspect_ratio === '1:1' ? 'aspect-square' : 'aspect-video'

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={() => onOpen(project.id)}
      className="group bg-surface-100 border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-white/12 transition-all hover:shadow-xl hover:shadow-black/30"
    >
      <div className="aspect-video bg-surface-300 relative overflow-hidden">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-300 to-surface-400">
            <Clapperboard size={28} className="text-white/10" />
          </div>
        )}

        {/* Duration badge */}
        {project.duration_s > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white/80 text-[9px] px-1.5 py-0.5 rounded font-mono">
            {formatDuration(project.duration_s)}
          </div>
        )}

        {/* Aspect ratio badge */}
        <div className="absolute top-1.5 left-1.5 bg-black/50 text-white/60 text-[9px] px-1.5 py-0.5 rounded font-mono">
          {project.aspect_ratio}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-brand-600/0 group-hover:bg-brand-600/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="bg-white/15 backdrop-blur-sm rounded-full p-2.5 shadow-lg">
            <Film size={16} className="text-white" />
          </div>
        </div>
      </div>

      <div className="p-2.5">
        <p className="text-[11px] font-semibold text-white/80 truncate group-hover:text-white transition-colors">{project.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-white/25">{formatDate(project.updated_at)}</span>
          <span className="text-[9px] text-white/15">·</span>
          <span className="text-[9px] text-white/25">{project.width}×{project.height}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Status Bar ────────────────────────────────────────────────────────────────

function StatusBar() {
  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: false,
  })

  return (
    <div className="flex items-center gap-3 text-[10px]">
      {/* Backend status */}
      <div className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl',
        isError ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
        {isError ? <WifiOff size={10} /> : <Wifi size={10} />}
        {isError ? 'Backend offline' : `v${health?.version ?? '…'} · Running`}
      </div>

      {/* FFmpeg */}
      <div className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl',
        health?.ffmpeg_available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
        <Zap size={10} />
        {health?.ffmpeg_available ? 'FFmpeg ready' : 'FFmpeg missing'}
      </div>

      {/* Phase */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-brand-500/10 text-brand-400">
        <Activity size={10} />
        Phase {health?.phase ?? 1} · Foundation
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return d.toLocaleDateString()
  } catch { return '' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const notify   = useUIStore(s => s.notify)
  const [showNew,       setShowNew]       = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [search,        setSearch]        = useState('')
  const [view,          setView]          = useState<'grid' | 'list'>('grid')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => fetchProjects() as Promise<{ projects: Project[] }>,
    retry: 1,
  })

  const projects = (data?.projects ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3.5 border-b border-white/5 flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Film size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">AI Video Studio</p>
            <p className="text-[9px] text-white/25 mt-0.5 font-medium tracking-widest uppercase">Pro</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Status */}
        <StatusBar />

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-200 border border-white/8 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-brand-500/50 w-44 transition-colors"
          />
        </div>

        {/* View toggle */}
        <div className="flex bg-surface-200 rounded-lg p-0.5 border border-white/5">
          <button onClick={() => setView('grid')} className={clsx('p-1.5 rounded-md transition-all', view === 'grid' ? 'bg-white/10 text-white' : 'text-white/25 hover:text-white/60')}>
            <Grid3X3 size={12} />
          </button>
          <button onClick={() => setView('list')} className={clsx('p-1.5 rounded-md transition-all', view === 'list' ? 'bg-white/10 text-white' : 'text-white/25 hover:text-white/60')}>
            <List size={12} />
          </button>
        </div>

        {/* New project */}
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all shadow-lg shadow-brand-600/20"
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { icon: Plus,       label: 'New Project',  sub: 'Start from scratch',    action: () => setShowNew(true),                                   accent: 'brand'   },
              { icon: FolderOpen, label: 'Open Project', sub: 'Continue editing',       action: () => notify('File open — coming in Phase 3', 'info'),   accent: 'cyan'    },
              { icon: Star,       label: 'Templates',    sub: 'Start from a template', action: () => setShowTemplates(true),                              accent: 'amber'   },
            ].map(({ icon: Icon, label, sub, action, accent }) => (
              <button key={label} onClick={action}
                className="group flex items-center gap-3 bg-surface-100 hover:bg-surface-200 border border-white/5 hover:border-white/10 rounded-xl p-4 text-left transition-all">
                <div className={clsx(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                  accent === 'brand' ? 'bg-brand-500/15 text-brand-400 group-hover:bg-brand-500/25' :
                  accent === 'cyan'  ? 'bg-cyan-500/15 text-cyan-400 group-hover:bg-cyan-500/25' :
                                       'bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25',
                )}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>
                </div>
                <ChevronRight size={13} className="ml-auto text-white/10 group-hover:text-white/35 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Projects */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-white/30" />
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Recent Projects</h2>
                {projects.length > 0 && (
                  <span className="text-[10px] bg-white/6 text-white/30 px-1.5 py-0.5 rounded-full border border-white/8">
                    {projects.length}
                  </span>
                )}
              </div>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-surface-100 rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-video bg-surface-300" />
                    <div className="p-2.5 space-y-1.5">
                      <div className="h-2.5 bg-surface-300 rounded w-3/4" />
                      <div className="h-2 bg-surface-300 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Backend error */}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <WifiOff size={24} className="text-red-400" />
                </div>
                <p className="text-sm text-white/40">Cannot connect to backend</p>
                <p className="text-xs text-white/20">Make sure the app is running via START.bat</p>
                <button onClick={() => refetch()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-xs transition-all">
                  <Activity size={12} />
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && projects.length === 0 && (
              <div
                onClick={() => setShowNew(true)}
                className="flex flex-col items-center justify-center py-14 gap-4 border-2 border-dashed border-white/8 rounded-2xl cursor-pointer hover:border-white/14 hover:bg-white/[0.01] transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-surface-200 border border-white/8 flex items-center justify-center group-hover:bg-brand-500/10 group-hover:border-brand-500/20 transition-all">
                  <Clapperboard size={24} className="text-white/15 group-hover:text-brand-400 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-white/35">No projects yet</p>
                  <p className="text-xs text-white/20 mt-1">Click to create your first project</p>
                </div>
              </div>
            )}

            {/* Project grid */}
            {!isLoading && !error && projects.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={id => navigate(`/editor/${id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNew       && <NewProjectModal      onClose={() => setShowNew(false)} />}
        {showTemplates && <TemplatePickerModal  onClose={() => setShowTemplates(false)} />}
      </AnimatePresence>
    </div>
  )
}
