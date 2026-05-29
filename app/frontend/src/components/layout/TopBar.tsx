import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Film, Save, Undo2, Redo2, Upload, Settings, Wifi, WifiOff, LayoutDashboard } from 'lucide-react'
import clsx from 'clsx'
import { useProjectStore } from '../../store/project'
import { useHealth } from '../../hooks/useHealth'
import { useUIStore } from '../../store/ui'

export default function TopBar({ projectId }: { projectId: string }) {
  const navigate     = useNavigate()
  const project      = useProjectStore(s => s.activeProject)
  const isSaving     = useProjectStore(s => s.isSaving)
  const lastSaved    = useProjectStore(s => s.lastSaved)
  const openModal    = useUIStore(s => s.openModal)
  const { data: health, isError } = useHealth()

  const saveStatus = isSaving ? 'Saving…' :
    lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
    'Unsaved'

  return (
    <div className="h-12 flex-shrink-0 flex items-center gap-3 px-4 border-b border-white/5 bg-surface-50">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-xs"
      >
        <ArrowLeft size={14} />
        <span>Home</span>
      </button>

      <div className="w-px h-4 bg-white/10" />

      {/* Brand */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
          <Film size={11} className="text-white" />
        </div>
      </div>

      {/* Project name */}
      <p className="text-sm font-medium text-white/80 max-w-[200px] truncate">
        {project?.name ?? 'Loading…'}
      </p>

      {/* Save status */}
      <span className={clsx(
        'text-[10px] flex items-center gap-1',
        isSaving ? 'text-amber-400' : lastSaved ? 'text-white/20' : 'text-white/20',
      )}>
        {isSaving && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />}
        {saveStatus}
      </span>

      <div className="flex-1" />

      {/* Undo / Redo */}
      <div className="flex items-center">
        <button className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all" title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all" title="Redo (Ctrl+Y)">
          <Redo2 size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Connection indicator */}
      <div className={clsx(
        'flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg',
        isError ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10',
      )}>
        {isError ? <WifiOff size={10} /> : <Wifi size={10} />}
        {isError ? 'Offline' : `v${health?.version ?? '…'}`}
      </div>

      {/* Activity tracker */}
      <button
        onClick={() => openModal('tracker')}
        className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
        title="Activity & Health"
      >
        <LayoutDashboard size={14} />
      </button>

      {/* Settings */}
      <button
        onClick={() => openModal('settings')}
        className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
        title="Settings"
      >
        <Settings size={14} />
      </button>

      {/* Export */}
      <button
        onClick={() => openModal('export')}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-all"
      >
        <Upload size={13} />
        Export
      </button>
    </div>
  )
}
