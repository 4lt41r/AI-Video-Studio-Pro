import { useEffect, useRef } from 'react'
import { useTimelineStore } from '../store/timeline'
import { saveTimeline } from '../api/client'

export function useSaveTimeline(projectId: string | undefined) {
  const tracks   = useTimelineStore(s => s.tracks)
  const duration = useTimelineStore(s => s.duration)
  const mounted  = useRef(false)
  const timer    = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    // Skip the first render so we don't save the initial empty/loaded state
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (!projectId) return

    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await saveTimeline(projectId, {
          state: { tracks, duration_s: duration, project_id: projectId },
        })
      } catch {
        // Silently ignore save errors — user data is in-memory regardless
      }
    }, 1500)

    return () => clearTimeout(timer.current)
  }, [tracks, duration, projectId])
}
