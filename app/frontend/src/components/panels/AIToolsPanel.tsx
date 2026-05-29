import { Brain, Scissors, Volume2, Maximize2, Zap, Search, TrendingUp } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'

const AI_TOOLS = [
  {
    id:     'captions',
    name:   'Auto Captions',
    sub:    'Whisper AI · offline',
    icon:   Brain,
    color:  'text-brand-400 bg-brand-500/15',
    modal:  'caption',
    ready:  true,
  },
  {
    id:     'silence',
    name:   'Remove Silence',
    sub:    'Auto-cut dead air',
    icon:   Scissors,
    color:  'text-amber-400 bg-amber-500/15',
    modal:  'silence-remove',
    ready:  true,
  },
  {
    id:     'scenes',
    name:   'Scene Detection',
    sub:    'Auto-detect cut points',
    icon:   Search,
    color:  'text-cyan-400 bg-cyan-500/15',
    modal:  'scene-detect',
    ready:  true,
  },
  {
    id:     'beat-sync',
    name:   'Beat Sync',
    sub:    'Sync cuts to music beats',
    icon:   Zap,
    color:  'text-purple-400 bg-purple-500/15',
    modal:  'beat-sync',
    ready:  true,
  },
  {
    id:     'highlights',
    name:   'Highlight Reel',
    sub:    'Auto-pick best moments',
    icon:   TrendingUp,
    color:  'text-rose-400 bg-rose-500/15',
    modal:  'ai-analysis',
    ready:  true,
  },
  {
    id:     'resize',
    name:   'Smart Resize',
    sub:    'Reframe for social formats',
    icon:   Maximize2,
    color:  'text-emerald-400 bg-emerald-500/15',
    modal:  'ai-analysis',
    ready:  true,
  },
  {
    id:     'noise',
    name:   'Noise Reduction',
    sub:    'Apply in Inspector panel',
    icon:   Volume2,
    color:  'text-green-400 bg-green-500/15',
    modal:  null,
    ready:  true,
    note:   'Select a clip and use the Inspector panel.',
  },
]

export default function AIToolsPanel() {
  const notify    = useUIStore(s => s.notify)
  const openModal = useUIStore(s => s.openModal)

  const handleTool = (tool: typeof AI_TOOLS[number]) => {
    if (tool.modal) {
      openModal(tool.modal)
    } else if (tool.note) {
      notify(tool.note, 'info')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-white/40" />
          <p className="text-xs font-semibold text-white/60">AI Tools</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <p className="text-[10px] text-white/25 mb-3">
          All AI tools run locally — no internet required.
        </p>

        {AI_TOOLS.map(tool => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              onClick={() => handleTool(tool)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-200 border border-white/5 hover:border-white/15 transition-all text-left group"
            >
              <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', tool.color)}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/80 group-hover:text-white">{tool.name}</p>
                <p className="text-[10px] text-white/30">{tool.sub}</p>
              </div>
              <div className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-500/20 text-emerald-400">
                Ready
              </div>
            </button>
          )
        })}

        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-brand-600/10 to-purple-600/10 border border-brand-500/20">
          <p className="text-[10px] text-brand-300 font-medium">All 7 AI Tools Active</p>
          <p className="text-[10px] text-white/30 mt-1">
            Scene detection, beat sync, silence removal, highlights, smart resize, captions, and noise reduction — all offline.
          </p>
        </div>
      </div>
    </div>
  )
}
