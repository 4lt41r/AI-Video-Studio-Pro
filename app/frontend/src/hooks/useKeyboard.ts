import { useEffect } from 'react'
import { useTimelineStore } from '../store/timeline'
import { useUIStore } from '../store/ui'

export function useKeyboard() {
  const setPlaying      = useTimelineStore(s => s.setPlaying)
  const isPlaying       = useTimelineStore(s => s.isPlaying)
  const zoomIn          = useTimelineStore(s => s.zoomIn)
  const zoomOut         = useTimelineStore(s => s.zoomOut)
  const selectedClipId  = useTimelineStore(s => s.selectedClipId)
  const removeClip      = useTimelineStore(s => s.removeClip)
  const playheadTime    = useTimelineStore(s => s.playheadTime)
  const setPlayhead     = useTimelineStore(s => s.setPlayheadTime)
  const splitAtPlayhead = useTimelineStore(s => s.splitAtPlayhead)
  const openModal       = useUIStore(s => s.openModal)
  const notify          = useUIStore(s => s.notify)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          setPlaying(!isPlaying)
          break
        case 'Delete':
        case 'Backspace':
          if (selectedClipId) removeClip(selectedClipId)
          break
        case '[':
          e.preventDefault()
          setPlayhead(Math.max(0, playheadTime - 1 / 30))
          break
        case ']':
          e.preventDefault()
          setPlayhead(playheadTime + 1 / 30)
          break
        case 'ArrowLeft':
          if (e.shiftKey) { e.preventDefault(); setPlayhead(Math.max(0, playheadTime - 1)) }
          break
        case 'ArrowRight':
          if (e.shiftKey) { e.preventDefault(); setPlayhead(playheadTime + 1) }
          break
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            splitAtPlayhead()
          }
          break
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            notify('Undo — coming in Phase 7', 'info')
          }
          break
        case 'y':
        case 'Y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            notify('Redo — coming in Phase 7', 'info')
          }
          break
        case 'e':
        case 'E':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            openModal('export')
          }
          break
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomIn() }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomOut() }
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPlaying, selectedClipId, playheadTime, setPlaying, removeClip, setPlayhead, splitAtPlayhead, zoomIn, zoomOut, openModal, notify])
}
