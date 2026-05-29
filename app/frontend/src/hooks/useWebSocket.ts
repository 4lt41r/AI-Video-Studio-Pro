import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../store/ui'
import { useJobsStore } from '../store/jobs'
import type { Job } from '../types'

type WSMessage =
  | { type: 'job_update'; job: Job }
  | { type: 'caption_update'; job_id: string; status: string; progress?: number; segments?: unknown[]; error?: string }
  | { type: 'ping' }
  | { type: 'connected' }

export function useWebSocket() {
  const backendUrl = useUIStore(s => s.backendUrl)
  const upsertJob  = useJobsStore(s => s.upsertJob)
  const wsRef      = useRef<WebSocket | null>(null)
  const retryRef   = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen  = () => console.debug('[WS] connected')
    ws.onclose = () => {
      retryRef.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => ws.close()

    ws.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data)
        if (msg.type === 'job_update') upsertJob(msg.job)
        // Broadcast all messages as a DOM event so modals can listen without coupling
        window.dispatchEvent(new CustomEvent('ws-message', { detail: msg }))
      } catch { /* ignore */ }
    }
  }, [backendUrl, upsertJob])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
