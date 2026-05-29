import { create } from 'zustand'
import type { PanelId, Theme } from '../types'

interface UIState {
  backendUrl: string
  setBackendUrl: (url: string) => void

  theme: Theme
  setTheme: (theme: Theme) => void

  activeLeftPanel: PanelId
  setActiveLeftPanel: (panel: PanelId) => void

  inspectorOpen: boolean
  toggleInspector: () => void

  activeModal: string | null
  openModal: (id: string) => void
  closeModal: () => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void

  timelineHeight: number
  setTimelineHeight: (h: number) => void

  isLoading: boolean
  setLoading: (v: boolean) => void

  notification: { message: string; type: 'success' | 'error' | 'info' } | null
  notify: (message: string, type?: 'success' | 'error' | 'info') => void
  clearNotification: () => void
}

export const useUIStore = create<UIState>((set) => ({
  backendUrl: 'http://127.0.0.1:8000',
  setBackendUrl: (url) => set({ backendUrl: url }),

  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  activeLeftPanel: 'media',
  setActiveLeftPanel: (activeLeftPanel) => set({ activeLeftPanel }),

  inspectorOpen: true,
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),

  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  timelineHeight: 240,
  setTimelineHeight: (timelineHeight) => set({ timelineHeight }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

  notification: null,
  notify: (message, type = 'info') => {
    set({ notification: { message, type } })
    setTimeout(() => set({ notification: null }), 4000)
  },
  clearNotification: () => set({ notification: null }),
}))
