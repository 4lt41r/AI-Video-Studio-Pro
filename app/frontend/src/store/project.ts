import { create } from 'zustand'
import type { Project } from '../types'

interface ProjectState {
  projects: Project[]
  setProjects: (projects: Project[]) => void

  activeProject: Project | null
  setActiveProject: (project: Project | null) => void
  updateActiveProject: (patch: Partial<Project>) => void

  isSaving: boolean
  setIsSaving: (v: boolean) => void

  lastSaved: Date | null
  setLastSaved: (d: Date) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),

  activeProject: null,
  setActiveProject: (activeProject) => set({ activeProject }),
  updateActiveProject: (patch) =>
    set((s) => ({
      activeProject: s.activeProject ? { ...s.activeProject, ...patch } : null,
    })),

  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),

  lastSaved: null,
  setLastSaved: (lastSaved) => set({ lastSaved }),
}))
