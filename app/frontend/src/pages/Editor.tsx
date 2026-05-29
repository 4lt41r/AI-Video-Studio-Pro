import { useEffect, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useKeyboard } from '../hooks/useKeyboard'
import { useSaveTimeline } from '../hooks/useSaveTimeline'
import TopBar from '../components/layout/TopBar'
import LeftPanel from '../components/layout/LeftPanel'
import PreviewArea from '../components/layout/PreviewArea'
import Timeline from '../components/layout/Timeline'
import InspectorPanel from '../components/layout/InspectorPanel'
import Notification from '../components/ui/Notification'
import ResizeHandle from '../components/ui/ResizeHandle'
import ExportModal from '../components/dialogs/ExportModal'
import SettingsModal from '../components/dialogs/SettingsModal'
import CaptionModal from '../components/dialogs/CaptionModal'
import SceneDetectModal from '../components/dialogs/SceneDetectModal'
import SilenceRemoveModal from '../components/dialogs/SilenceRemoveModal'
import BeatSyncModal from '../components/dialogs/BeatSyncModal'
import AIAnalysisModal from '../components/dialogs/AIAnalysisModal'
import SaveTemplateModal from '../components/dialogs/SaveTemplateModal'
import TrackerModal from '../components/dialogs/TrackerModal'
import { useUIStore } from '../store/ui'
import { useProjectStore } from '../store/project'
import { useMediaStore } from '../store/media'
import { useTimelineStore } from '../store/timeline'
import { fetchProject, fetchMedia, fetchTimeline, fetchCrashState, clearCrashState } from '../api/client'
import type { MediaItem, TimelineState } from '../types'

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate       = useNavigate()
  const activeModal    = useUIStore(s => s.activeModal)
  const timelineHeight = useUIStore(s => s.timelineHeight)
  const setTimelineH   = useUIStore(s => s.setTimelineHeight)
  const setActiveProj  = useProjectStore(s => s.setActiveProject)
  const setMediaItems  = useMediaStore(s => s.setItems)
  const loadTimeline   = useTimelineStore(s => s.loadState)
  const [crashBanner, setCrashBanner] = useState(false)

  useWebSocket()
  useKeyboard()
  useSaveTimeline(projectId)

  useEffect(() => {
    if (!projectId) { navigate('/'); return }

    fetchProject(projectId)
      .then(p => setActiveProj(p as any))
      .catch(() => navigate('/'))

    fetchMedia(projectId)
      .then((r: any) => setMediaItems(r.media as MediaItem[]))
      .catch(() => {})

    fetchTimeline(projectId)
      .then((r: any) => {
        const s = r.state
        if (s?.tracks?.length) {
          loadTimeline({
            project_id: projectId,
            tracks:     s.tracks,
            duration_s: s.duration_s ?? 0,
            saved_at:   r.saved_at ?? '',
            version:    r.version  ?? 1,
          } as TimelineState)
        }
      })
      .catch(() => {})
  }, [projectId, navigate, setActiveProj, setMediaItems, loadTimeline])

  useEffect(() => {
    fetchCrashState().then(s => { if (s.crashed) setCrashBanner(true) }).catch(() => {})
  }, [])

  const dismissCrash = useCallback(() => {
    setCrashBanner(false)
    clearCrashState().catch(() => {})
  }, [])

  const handleTimelineResize = useCallback((delta: number) => {
    setTimelineH(prev => Math.max(120, Math.min(600, prev - delta)))
  }, [setTimelineH])

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-surface-0">
      <TopBar projectId={projectId!} />

      {/* Crash recovery banner */}
      <AnimatePresence>
        {crashBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <p className="text-xs flex-1">
                The previous session ended unexpectedly. Your timeline has been auto-saved — check the Tracker for backups.
              </p>
              <button onClick={dismissCrash} className="p-0.5 rounded hover:bg-amber-500/20 transition-colors">
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <LeftPanel projectId={projectId!} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Preview — fills remaining space above timeline */}
          <div className="flex-1 overflow-hidden min-h-0">
            <PreviewArea />
          </div>

          {/* Drag handle to resize timeline */}
          <ResizeHandle direction="horizontal" onResize={handleTimelineResize} />

          {/* Timeline */}
          <div style={{ height: timelineHeight }} className="flex-shrink-0">
            <Timeline />
          </div>
        </div>

        <InspectorPanel />
      </div>

      {/* Global notification toast */}
      <Notification />

      {/* Modals */}
      <AnimatePresence>
        {activeModal === 'export'        && <ExportModal />}
        {activeModal === 'settings'      && <SettingsModal />}
        {activeModal === 'caption'       && <CaptionModal />}
        {activeModal === 'scene-detect'  && <SceneDetectModal />}
        {activeModal === 'silence-remove' && <SilenceRemoveModal />}
        {activeModal === 'beat-sync'     && <BeatSyncModal />}
        {activeModal === 'ai-analysis'   && <AIAnalysisModal />}
        {activeModal === 'save-template' && <SaveTemplateModal />}
        {activeModal === 'tracker'       && <TrackerModal />}
      </AnimatePresence>
    </div>
  )
}
