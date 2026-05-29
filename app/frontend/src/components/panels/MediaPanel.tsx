import { useCallback, useState, useRef } from 'react'
import { Plus, Film, Music, Image, Loader2, Search, Trash2, AlertTriangle, Zap } from 'lucide-react'
import clsx from 'clsx'
import { useMediaStore } from '../../store/media'
import { useUIStore } from '../../store/ui'
import { pickFiles, importMedia, deleteMedia, generateProxy } from '../../api/client'
import type { MediaItem } from '../../types'

function formatDuration(s: number) {
  const m  = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MediaItemCard({
  item,
  onDelete,
}: {
  item: MediaItem
  onDelete: (id: string) => void
}) {
  const TypeIcon = item.type === 'video' ? Film : item.type === 'audio' ? Music : Image
  const typeColor =
    item.type === 'video' ? 'text-brand-400 bg-brand-500/15' :
    item.type === 'audio' ? 'text-emerald-400 bg-emerald-500/15' :
                            'text-amber-400 bg-amber-500/15'
  const backendUrl  = useUIStore(s => s.backendUrl)
  const notify      = useUIStore(s => s.notify)
  const thumbSrc    = item.thumbnail ? `${backendUrl}${item.thumbnail}` : null
  const [genProxy, setGenProxy] = useState(false)

  const handleProxy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGenProxy(true)
    try {
      await generateProxy(item.project_id, item.id)
      notify(`Proxy generated for "${item.name}"`, 'success')
    } catch (err: any) {
      notify(err?.message ?? 'Proxy generation failed', 'error')
    } finally {
      setGenProxy(false)
    }
  }

  return (
    <div
      className={clsx(
        'group relative bg-surface-200 hover:bg-surface-300 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border transition-all',
        item.missing
          ? 'border-red-500/30 hover:border-red-500/50'
          : 'border-white/5 hover:border-white/10',
      )}
      draggable={!item.missing}
      onDragStart={e => {
        e.dataTransfer.setData('application/media-item', JSON.stringify(item))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      title={item.missing ? `File not found: ${item.path}` : item.name}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-400 relative overflow-hidden">
        {thumbSrc ? (
          <img src={thumbSrc} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <TypeIcon size={20} className="text-white/15" />
          </div>
        )}

        {/* Duration badge */}
        {item.duration_s != null && (
          <div className="absolute bottom-1 right-1 bg-black/70 text-white/80 text-[9px] px-1 py-0.5 rounded font-mono">
            {formatDuration(item.duration_s)}
          </div>
        )}

        {/* Type badge */}
        <div className={clsx('absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center', typeColor)}>
          <TypeIcon size={8} />
        </div>

        {/* Missing file overlay */}
        {item.missing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-[8px] text-red-300">File missing</p>
          </div>
        )}

        {/* Delete button — shown on hover */}
        <button
          onClick={e => { e.stopPropagation(); onDelete(item.id) }}
          className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
          title="Remove from project"
        >
          <Trash2 size={9} className="text-white" />
        </button>

        {/* Proxy button — video only, no proxy yet */}
        {item.type === 'video' && !item.proxy_path && !item.missing && (
          <button
            onClick={handleProxy}
            disabled={genProxy}
            className="absolute bottom-1 left-1 w-5 h-5 rounded bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-brand-500/80 transition-all disabled:opacity-50"
            title="Generate 360p proxy"
          >
            {genProxy
              ? <Loader2 size={9} className="animate-spin text-white" />
              : <Zap size={9} className="text-white" />}
          </button>
        )}
      </div>

      {/* Name + size */}
      <div className="px-2 py-1.5">
        <p className="text-[10px] text-white/60 truncate">{item.name}</p>
        <p className="text-[9px] text-white/25">{formatSize(item.size_bytes)}</p>
      </div>
    </div>
  )
}

export default function MediaPanel({ projectId }: { projectId: string }) {
  const items        = useMediaStore(s => s.items)
  const addItems     = useMediaStore(s => s.addItems)
  const removeItem   = useMediaStore(s => s.removeItem)
  const filter       = useMediaStore(s => s.filter)
  const setFilter    = useMediaStore(s => s.setFilter)
  const importing    = useMediaStore(s => s.isImporting)
  const setImporting = useMediaStore(s => s.setImporting)
  const notify       = useUIStore(s => s.notify)
  const [search, setSearch]     = useState('')
  const [dragOver, setDragOver] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const doImport = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return
    setImporting(true)
    try {
      const result = await importMedia(projectId, { paths }) as any
      const imported: MediaItem[] = result.media ?? []
      if (imported.length > 0) {
        addItems(imported)
        notify(`Imported ${imported.length} file${imported.length > 1 ? 's' : ''}`, 'success')
      } else {
        notify('No supported files found in selection', 'warning')
      }
    } catch (e: any) {
      notify(e.message ?? 'Import failed', 'error')
    } finally {
      setImporting(false)
    }
  }, [projectId, addItems, notify, setImporting])

  const handleImportClick = useCallback(async () => {
    const paths = await pickFiles({ multiple: true, type: 'any' })
    await doImport(paths)
  }, [doImport])

  const handleDelete = useCallback(async (mediaId: string) => {
    try {
      await deleteMedia(projectId, mediaId)
      removeItem(mediaId)
    } catch (e: any) {
      notify(e.message ?? 'Remove failed', 'error')
    }
  }, [projectId, removeItem, notify])

  // Drag-and-drop from OS file manager
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    // In Electron, File has a .path property; in browser it's unavailable
    const paths = files
      .map(f => (f as any).path as string | undefined)
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    await doImport(paths)
  }, [doImport])

  const filtered = items
    .filter(i => filter === 'all' || i.type === filter)
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white/60">
            Media Library
            {items.length > 0 && (
              <span className="ml-1.5 text-white/25 font-normal">({items.length})</span>
            )}
          </p>
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-600/20 border border-brand-500/30 text-brand-300 text-[10px] hover:bg-brand-600/30 transition-all disabled:opacity-50"
          >
            {importing ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
            Import
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search media…"
            className="w-full bg-surface-300 border border-white/5 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white placeholder-white/20 outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'video', 'audio', 'image'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'flex-1 py-1 rounded-lg text-[9px] font-medium transition-all capitalize',
                filter === f ? 'bg-white/10 text-white' : 'text-white/25 hover:text-white/50',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content / Drop zone */}
      <div
        ref={dropRef}
        className="flex-1 overflow-y-auto p-2"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag-over overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-brand-500/10 border-2 border-dashed border-brand-400/60 rounded-xl pointer-events-none m-2">
            <Film size={28} className="text-brand-400" strokeWidth={1.5} />
            <p className="text-sm text-brand-300 font-medium">Drop to import</p>
          </div>
        )}

        {importing && (
          <div className="flex items-center justify-center gap-2 py-4 text-white/30 text-xs">
            <Loader2 size={14} className="animate-spin" />
            Importing…
          </div>
        )}

        {!importing && filtered.length === 0 && (
          <div
            onClick={handleImportClick}
            className="flex flex-col items-center justify-center gap-2 py-8 text-white/15 border border-dashed border-white/8 rounded-xl cursor-pointer hover:border-white/15 hover:text-white/25 transition-all"
          >
            <Film size={28} strokeWidth={1} />
            <p className="text-xs text-white/25">Drop files here</p>
            <p className="text-[10px] text-white/15">or click Import</p>
          </div>
        )}

        {!importing && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map(item => (
              <MediaItemCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
