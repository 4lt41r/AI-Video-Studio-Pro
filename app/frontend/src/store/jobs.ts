import { create } from 'zustand'
import type { Job } from '../types'

interface JobsState {
  jobs: Job[]
  setJobs: (jobs: Job[]) => void
  upsertJob: (job: Job) => void
  removeJob: (id: string) => void

  activeExportId: string | null
  setActiveExportId: (id: string | null) => void
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  setJobs: (jobs) => set({ jobs }),
  upsertJob: (job) =>
    set((s) => {
      const idx = s.jobs.findIndex(j => j.id === job.id)
      if (idx >= 0) {
        const next = [...s.jobs]
        next[idx] = job
        return { jobs: next }
      }
      return { jobs: [job, ...s.jobs] }
    }),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter(j => j.id !== id) })),

  activeExportId: null,
  setActiveExportId: (activeExportId) => set({ activeExportId }),
}))
