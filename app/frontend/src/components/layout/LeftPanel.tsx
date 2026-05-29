import { useState } from 'react'
import clsx from 'clsx'
import { Film, Brain, Type, Star, Sparkles, Music, ChevronLeft } from 'lucide-react'
import { useUIStore } from '../../store/ui'
import MediaPanel from '../panels/MediaPanel'
import TextPanel from '../panels/TextPanel'
import EffectsPanel from '../panels/EffectsPanel'
import TemplatesPanel from '../panels/TemplatesPanel'
import AIToolsPanel from '../panels/AIToolsPanel'
import AudioPanel from '../panels/AudioPanel'

type TabId = 'media' | 'ai-tools' | 'text' | 'effects' | 'templates' | 'audio'

const TABS: { id: TabId; icon: typeof Film; label: string }[] = [
  { id: 'media',     icon: Film,     label: 'Media' },
  { id: 'ai-tools',  icon: Brain,    label: 'AI Tools' },
  { id: 'text',      icon: Type,     label: 'Text' },
  { id: 'effects',   icon: Sparkles, label: 'Effects' },
  { id: 'templates', icon: Star,     label: 'Templates' },
  { id: 'audio',     icon: Music,    label: 'Audio' },
]

export default function LeftPanel({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>('media')
  const collapsed = useUIStore(s => s.sidebarCollapsed)
  const toggle    = useUIStore(s => s.toggleSidebar)

  return (
    <div className={clsx(
      'flex-shrink-0 flex border-r border-white/5 transition-all duration-200',
      collapsed ? 'w-12' : 'w-72',
    )}>
      {/* Icon nav */}
      <div className="w-12 flex flex-col border-r border-white/5 bg-surface-50 py-2">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { if (collapsed) toggle(); setActiveTab(id) }}
            title={label}
            className={clsx(
              'w-full h-11 flex items-center justify-center transition-all relative group',
              activeTab === id && !collapsed ? 'text-white' : 'text-white/25 hover:text-white/60',
            )}
          >
            <Icon size={16} />
            {/* Active indicator */}
            {activeTab === id && !collapsed && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-400 rounded-r" />
            )}
            {/* Tooltip */}
            <div className="absolute left-full ml-2 bg-surface-300 border border-white/10 shadow-xl text-white text-[11px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              {label}
            </div>
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full h-10 flex items-center justify-center text-white/20 hover:text-white/50 transition-all"
        >
          <ChevronLeft size={14} className={clsx('transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Panel content */}
      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden bg-surface-50 min-w-0">
          {activeTab === 'media'     && <MediaPanel projectId={projectId} />}
          {activeTab === 'ai-tools'  && <AIToolsPanel />}
          {activeTab === 'text'      && <TextPanel />}
          {activeTab === 'effects'   && <EffectsPanel />}
          {activeTab === 'templates' && <TemplatesPanel />}
          {activeTab === 'audio'     && <AudioPanel />}
        </div>
      )}
    </div>
  )
}
