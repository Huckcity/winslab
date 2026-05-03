import { create } from 'zustand'
import type { Cue, CueType, AudioCue } from '../types/cue'
import { createCue } from '../utils/cueDefaults'

export type RunState = 'idle' | 'pre-wait' | 'playing' | 'post-wait'

export interface RunningCue {
  cueId: string
  state: RunState
  startedAt: number
  progress: number
}

interface CueListState {
  // Workspace metadata
  workspaceName: string
  workspacePath: string | null
  isDirty: boolean

  // Cue data
  cues: Cue[]
  selectedId: string | null
  running: Map<string, RunningCue>

  // Cue CRUD
  addCue: (type: CueType, afterId?: string) => void
  addAudioCuesFromFiles: (files: Array<{ filePath: string; name: string }>, afterId?: string) => void
  removeCue: (id: string) => void
  updateCue: (id: string, patch: Partial<Cue>) => void
  moveCue: (fromIndex: number, toIndex: number) => void
  duplicateCue: (id: string) => void

  // Selection
  select: (id: string | null) => void

  // Running state
  setRunning: (id: string, state: RunningCue | null) => void
  clearAllRunning: () => void
  syncCueDuration: (id: string, durationMs: number) => void

  // Workspace lifecycle
  loadWorkspace: (cues: Cue[], name: string, path: string | null) => void
  saveSucceeded: (path: string, name: string) => void
  setWorkspaceName: (name: string) => void
}

export const useStore = create<CueListState>((set) => ({
  workspaceName: 'Untitled',
  workspacePath: null,
  isDirty: false,

  cues: [],
  selectedId: null,
  running: new Map(),

  addCue: (type, afterId) => set(s => {
    const cue = createCue(type)
    const cues = [...s.cues]
    const idx = afterId ? cues.findIndex(c => c.id === afterId) + 1 : cues.length
    cues.splice(idx, 0, cue)
    return { cues, selectedId: cue.id, isDirty: true }
  }),

  addAudioCuesFromFiles: (files, afterId) => set(s => {
    const cues = [...s.cues]
    const insertIdx = afterId ? cues.findIndex(c => c.id === afterId) + 1 : cues.length
    const newCues: Cue[] = files.map(({ filePath, name }) => ({
      ...(createCue('audio') as AudioCue),
      filePath,
      name
    }))
    cues.splice(insertIdx, 0, ...newCues)
    const lastAdded = newCues[newCues.length - 1]
    return { cues, selectedId: lastAdded.id, isDirty: true }
  }),

  removeCue: (id) => set(s => ({
    cues: s.cues.filter(c => c.id !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
    isDirty: true
  })),

  updateCue: (id, patch) => set(s => ({
    cues: s.cues.map(c => c.id === id ? { ...c, ...patch } as Cue : c),
    isDirty: true
  })),

  moveCue: (fromIndex, toIndex) => set(s => {
    const cues = [...s.cues]
    const [moved] = cues.splice(fromIndex, 1)
    cues.splice(toIndex, 0, moved)
    return { cues, isDirty: true }
  }),

  duplicateCue: (id) => set(s => {
    const src = s.cues.find(c => c.id === id)
    if (!src) return s
    const copy: Cue = { ...src, id: crypto.randomUUID(), number: src.number + ' copy' }
    const idx = s.cues.findIndex(c => c.id === id)
    const cues = [...s.cues]
    cues.splice(idx + 1, 0, copy)
    return { cues, selectedId: copy.id, isDirty: true }
  }),

  select: (id) => set({ selectedId: id }),

  setRunning: (id, state) => set(s => {
    const running = new Map(s.running)
    if (state === null) running.delete(id)
    else running.set(id, state)
    return { running }
  }),

  clearAllRunning: () => set({ running: new Map() }),

  // Syncs duration from the audio file — does NOT mark workspace dirty
  syncCueDuration: (id, durationMs) => set(s => {
    const cue = s.cues.find(c => c.id === id)
    if (!cue || cue.duration === durationMs) return s
    return { cues: s.cues.map(c => c.id === id ? { ...c, duration: durationMs } : c) }
  }),

  loadWorkspace: (cues, name, path) => set({
    cues,
    workspaceName: name,
    workspacePath: path,
    isDirty: false,
    selectedId: cues[0]?.id ?? null,
    running: new Map()
  }),

  saveSucceeded: (path, name) => set({
    workspacePath: path,
    workspaceName: name,
    isDirty: false
  }),

  setWorkspaceName: (name) => set({ workspaceName: name, isDirty: true })
}))

export function useSelectedCue(): Cue | null {
  return useStore(s => s.cues.find(c => c.id === s.selectedId) ?? null)
}
