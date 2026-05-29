import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  X, Settings, Monitor, Cpu, Brain, HardDrive, Save,
  RefreshCw, Trash2, FolderOpen, ChevronRight, CheckCircle2, Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '../../store/ui'
import { fetchCacheStats, clearCacheTemp, clearCacheThumbnails } from '../../api/client'

const TABS = [
  { id: 'general', label: 'General',     icon: Settings },
  { id: 'editor',  label: 'Editor',      icon: Monitor },
  { id: 'ai',      label: 'AI Models',   icon: Brain },
  { id: 'cache',   label: 'Cache',       icon: HardDrive },
]

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-white/80">{label}</p>
        {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={clsx('relative w-9 h-5 rounded-full transition-colors',
        value ? 'bg-brand-500' : 'bg-white/15')}>
      <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
        value ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="bg-surface-300 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer">
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function GeneralTab() {
  const [autosave, setAutosave] = useState('30')
  const [theme,    setTheme]    = useState('dark')
  const [lang,     setLang]     = useState('en')

  return (
    <div>
      <Row label="Theme" sub="App color scheme">
        <Select value={theme} onChange={setTheme} options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light (coming soon)' },
        ]} />
      </Row>
      <Row label="Language">
        <Select value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }]} />
      </Row>
      <Row label="Auto-save interval" sub="How often the project is auto-saved">
        <Select value={autosave} onChange={setAutosave} options={[
          { value: '15',  label: 'Every 15 seconds' },
          { value: '30',  label: 'Every 30 seconds' },
          { value: '60',  label: 'Every minute' },
          { value: '300', label: 'Every 5 minutes' },
          { value: '0',   label: 'Disabled' },
        ]} />
      </Row>
      <Row label="Check for updates" sub="Notify when a new version is available">
        <Toggle value={false} onChange={() => {}} />
      </Row>
    </div>
  )
}

function EditorTab() {
  const [snap,      setSnap]      = useState(true)
  const [waveforms, setWaveforms] = useState(true)
  const [proxy,     setProxy]     = useState(false)
  const [previewQ,  setPreviewQ]  = useState('half')

  return (
    <div>
      <Row label="Snap clips to grid" sub="Automatically align clips when dragging">
        <Toggle value={snap} onChange={setSnap} />
      </Row>
      <Row label="Show audio waveforms" sub="Display waveforms on audio/video clips">
        <Toggle value={waveforms} onChange={setWaveforms} />
      </Row>
      <Row label="Generate proxy media" sub="Create low-res proxies for large files (Phase 15)">
        <Toggle value={proxy} onChange={setProxy} />
      </Row>
      <Row label="Preview quality">
        <Select value={previewQ} onChange={setPreviewQ} options={[
          { value: 'quarter', label: '1/4 (Fastest)' },
          { value: 'half',    label: '1/2 (Balanced)' },
          { value: 'full',    label: 'Full (Slowest)' },
        ]} />
      </Row>
      <Row label="Max undo history">
        <Select value="100" onChange={() => {}} options={[
          { value: '50',  label: '50 steps' },
          { value: '100', label: '100 steps' },
          { value: '200', label: '200 steps' },
        ]} />
      </Row>
    </div>
  )
}

function AITab() {
  const models = [
    { name: 'Whisper Tiny',    size: '75 MB',   status: 'not_downloaded', desc: 'Fastest captions, basic accuracy' },
    { name: 'Whisper Base',    size: '145 MB',  status: 'not_downloaded', desc: 'Recommended default for captions' },
    { name: 'Whisper Small',   size: '465 MB',  status: 'not_downloaded', desc: 'Better accuracy, moderate speed' },
    { name: 'Whisper Medium',  size: '1.5 GB',  status: 'not_downloaded', desc: 'High accuracy, slower processing' },
    { name: 'Whisper Large v3','size': '3.1 GB', status: 'not_downloaded', desc: 'Best quality, professional use' },
  ]

  return (
    <div>
      <p className="text-xs text-white/30 mb-4">
        AI models run locally — no internet required after download.
        Models are stored in <span className="font-mono text-white/50">models/whisper/</span>
      </p>
      <div className="space-y-2">
        {models.map(m => (
          <div key={m.name} className="flex items-center gap-3 bg-surface-200 rounded-xl p-3 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
              <Brain size={14} className="text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white">{m.name}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{m.desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-white/30 font-mono">{m.size}</span>
              <button className="px-2.5 py-1 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300 text-[10px] hover:bg-brand-600/30 transition-all">
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/20 mt-3">
        Model download will be wired up in Phase 8 (AI Captions).
      </p>
    </div>
  )
}

function CacheTab({ onClose }: { onClose: () => void }) {
  const notify = useUIStore(s => s.notify)
  const [stats, setStats]       = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [clearing, setClearing] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCacheStats() as any
      setStats(data)
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handleClearThumbnails = async () => {
    setClearing('thumbnails')
    try {
      await clearCacheThumbnails()
      notify('Thumbnails cleared', 'success')
      await loadStats()
    } catch (e: any) {
      notify(e?.message ?? 'Clear failed', 'error')
    } finally {
      setClearing(null)
    }
  }

  const handleClearTemp = async () => {
    setClearing('temp')
    try {
      await clearCacheTemp()
      notify('Temp files cleared', 'success')
      await loadStats()
    } catch (e: any) {
      notify(e?.message ?? 'Clear failed', 'error')
    } finally {
      setClearing(null)
    }
  }

  // Backend returns nested { thumbnails: { size_mb, file_count }, ... }
  const categories = [
    { label: 'Thumbnails', key: 'thumbnails', sub: 'Generated previews' },
    { label: 'Temp Files', key: 'temp',       sub: 'Processing workspace' },
    { label: 'Exports',    key: 'exports',    sub: 'Rendered videos' },
    { label: 'Proxies',    key: 'proxies',    sub: 'Low-res preview files' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-white/30">Disk usage by category</p>
        <button onClick={loadStats} disabled={loading}
          className="p-1 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all disabled:opacity-40">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {categories.map(c => (
          <div key={c.label} className="bg-surface-200 rounded-xl p-3 border border-white/5">
            <p className="text-xs font-semibold text-white">{c.label}</p>
            <p className="text-lg font-bold text-white/80 mt-1">
              {loading ? '…' : stats ? `${(stats[c.key]?.size_mb ?? 0).toFixed(1)} MB` : '—'}
            </p>
            <p className="text-[10px] text-white/30">{c.sub}</p>
          </div>
        ))}
      </div>

      {stats && (
        <div className="mb-4 bg-surface-200 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] text-white/30 mb-1">Total tracked</p>
          <p className="text-sm font-bold text-white/70">
            {(stats.total_mb ?? 0).toFixed(1)} MB
          </p>
        </div>
      )}

      <Row label="Max cache size" sub="Auto-delete oldest thumbnails when exceeded">
        <Select value="5" onChange={() => {}} options={[
          { value: '2',  label: '2 GB' },
          { value: '5',  label: '5 GB' },
          { value: '10', label: '10 GB' },
          { value: '0',  label: 'Unlimited' },
        ]} />
      </Row>

      <div className="flex gap-2 mt-4">
        <button onClick={handleClearThumbnails} disabled={!!clearing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-xs transition-all disabled:opacity-50">
          {clearing === 'thumbnails' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Clear Cache
        </button>
        <button onClick={handleClearTemp} disabled={!!clearing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-xs transition-all disabled:opacity-50">
          {clearing === 'temp' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Clear Temp
        </button>
      </div>
    </div>
  )
}

export default function SettingsModal() {
  const closeModal = useUIStore(s => s.closeModal)
  const notify     = useUIStore(s => s.notify)
  const [tab, setTab] = useState('general')

  const handleSave = () => {
    notify('Settings saved', 'success')
    closeModal()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        className="bg-surface-100 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Settings size={15} className="text-white/50" />
          </div>
          <p className="text-sm font-semibold text-white">Settings</p>
          <button onClick={closeModal} className="ml-auto p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-36 flex-shrink-0 border-r border-white/5 py-2">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-all text-left',
                    tab === t.id ? 'text-white bg-white/5 border-r-2 border-brand-400' : 'text-white/40 hover:text-white/70',
                  )}>
                  <Icon size={13} />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'general' && <GeneralTab />}
            {tab === 'editor'  && <EditorTab />}
            {tab === 'ai'      && <AITab />}
            {tab === 'cache'   && <CacheTab onClose={closeModal} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5">
          <button onClick={closeModal}
            className="px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all">
            <Save size={13} />
            Save
          </button>
        </div>
      </motion.div>
    </div>
  )
}
