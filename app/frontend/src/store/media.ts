import { create } from 'zustand'
import type { MediaItem } from '../types'

interface MediaState {
  items: MediaItem[]
  setItems: (items: MediaItem[]) => void
  addItems: (items: MediaItem[]) => void
  removeItem: (id: string) => void

  selected: string[]
  selectItem: (id: string) => void
  deselectAll: () => void

  isImporting: boolean
  setImporting: (v: boolean) => void

  filter: 'all' | 'video' | 'audio' | 'image'
  setFilter: (f: 'all' | 'video' | 'audio' | 'image') => void

  // Waveform peak cache: mediaId → normalized 0..1 peak array
  waveformCache: Record<string, number[]>
  setWaveform: (mediaId: string, peaks: number[]) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItems: (newItems) =>
    set((s) => ({
      items: [...s.items, ...newItems.filter(n => !s.items.find(e => e.id === n.id))],
    })),
  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),

  selected: [],
  selectItem: (id) => set({ selected: [id] }),
  deselectAll: () => set({ selected: [] }),

  isImporting: false,
  setImporting: (isImporting) => set({ isImporting }),

  filter: 'all',
  setFilter: (filter) => set({ filter }),

  waveformCache: {},
  setWaveform: (mediaId, peaks) =>
    set((s) => ({ waveformCache: { ...s.waveformCache, [mediaId]: peaks } })),
}))
