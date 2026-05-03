import { create } from 'zustand'
import type { Cue, CueType, AudioCue, GroupCue } from '../types/cue'
import type { AudioSettings, MidiSettings } from '../types/workspace'
import { createCue } from '../utils/cueDefaults'

export type RunState = 'idle' | 'pre-wait' | 'playing' | 'post-wait'

export interface RunningCue {
  cueId: string
  state: RunState
  startedAt: number
  progress: number
}

const defaultAudioSettings: AudioSettings = {
  outputDeviceId: 'default',
  sampleRate: 48000,
  bufferSize: 256,
}

const defaultMidiSettings: MidiSettings = {
  outputPortName: '',
  inputPortName: '',
}

interface CueListState {
  // Workspace metadata
  workspaceName: string
  workspacePath: string | null
  isDirty: boolean

  // Settings
  audioSettings: AudioSettings
  midiSettings: MidiSettings

  // Cue data
  cues: Cue[]
  selectedId: string | null
  running: Map<string, RunningCue>

  // Undo / redo history (snapshots of cues[])
  past: Cue[][]
  future: Cue[][]

  // Cue CRUD
  addCue: (type: CueType, afterId?: string) => void
  addAudioCuesFromFiles: (files: Array<{ filePath: string; name: string }>, afterId?: string) => void
  removeCue: (id: string) => void
  updateCue: (id: string, patch: Partial<Cue>) => void
  moveCue: (fromIndex: number, toIndex: number, newParentId?: string | null) => void
  duplicateCue: (id: string) => void

  // Selection
  select: (id: string | null) => void

  // Running state
  setRunning: (id: string, state: RunningCue | null) => void
  clearAllRunning: () => void
  syncCueDuration: (id: string, durationMs: number) => void

  // Settings
  updateAudioSettings: (patch: Partial<AudioSettings>) => void
  updateMidiSettings: (patch: Partial<MidiSettings>) => void

  // Undo / redo
  undo: () => void
  redo: () => void

  // Workspace lifecycle
  loadWorkspace: (cues: Cue[], name: string, path: string | null, audioSettings?: AudioSettings, midiSettings?: MidiSettings) => void
  saveSucceeded: (path: string, name: string) => void
  setWorkspaceName: (name: string) => void
}

const HISTORY_LIMIT = 50

function pushPast(past: Cue[][], snapshot: Cue[]): Cue[][] {
  return [...past.slice(-(HISTORY_LIMIT - 1)), snapshot]
}

// Coalesce rapid updateCue calls for the same cue into one history entry.
let _coalesceId: string | null = null
let _coalesceTime = 0

function shouldRecordUpdate(cueId: string): boolean {
  const now = Date.now()
  const record = cueId !== _coalesceId || now - _coalesceTime > 1000
  _coalesceId = cueId
  _coalesceTime = now
  return record
}

// Returns the flat index of the last child belonging to groupId,
// or the group's own index if it has no children.
function lastChildIndex(cues: Cue[], groupId: string): number {
  const groupIdx = cues.findIndex(c => c.id === groupId)
  let last = groupIdx
  while (last + 1 < cues.length && cues[last + 1].parentId === groupId) last++
  return last
}

export const useStore = create<CueListState>((set) => ({
  workspaceName: 'Untitled',
  workspacePath: null,
  isDirty: false,

  audioSettings: { ...defaultAudioSettings },
  midiSettings: { ...defaultMidiSettings },

  cues: [],
  selectedId: null,
  running: new Map(),
  past: [],
  future: [],

  addCue: (type, afterId) => set(s => {
    const cue = createCue(type)
    const cues = [...s.cues]

    let insertIdx: number
    if (!afterId) {
      insertIdx = cues.length
    } else {
      const afterCue = cues.find(c => c.id === afterId)
      if (afterCue?.type === 'group') {
        // Inserting after a group header → becomes its last child
        cue.parentId = afterId
        insertIdx = lastChildIndex(cues, afterId) + 1
      } else {
        // Inserting after a regular cue or group child → inherit context
        cue.parentId = afterCue?.parentId ?? null
        insertIdx = cues.findIndex(c => c.id === afterId) + 1
      }
    }

    cues.splice(insertIdx, 0, cue)
    return { cues, selectedId: cue.id, isDirty: true, past: pushPast(s.past, s.cues), future: [] }
  }),

  addAudioCuesFromFiles: (files, afterId) => set(s => {
    const cues = [...s.cues]
    let insertIdx: number
    let parentId: string | null = null

    if (!afterId) {
      insertIdx = cues.length
    } else {
      const afterCue = cues.find(c => c.id === afterId)
      if (afterCue?.type === 'group') {
        parentId = afterId
        insertIdx = lastChildIndex(cues, afterId) + 1
      } else {
        parentId = afterCue?.parentId ?? null
        insertIdx = cues.findIndex(c => c.id === afterId) + 1
      }
    }

    const newCues: Cue[] = files.map(({ filePath, name }) => ({
      ...(createCue('audio') as AudioCue),
      filePath,
      name,
      parentId,
    }))
    cues.splice(insertIdx, 0, ...newCues)
    const lastAdded = newCues[newCues.length - 1]
    return { cues, selectedId: lastAdded.id, isDirty: true, past: pushPast(s.past, s.cues), future: [] }
  }),

  removeCue: (id) => set(s => {
    // Collect the cue and all its children (if it's a group)
    const toRemove = new Set<string>([id])
    for (const c of s.cues) {
      if (c.parentId === id) toRemove.add(c.id)
    }
    return {
      cues: s.cues.filter(c => !toRemove.has(c.id)),
      selectedId: toRemove.has(s.selectedId ?? '') ? null : s.selectedId,
      isDirty: true,
      past: pushPast(s.past, s.cues),
      future: [],
    }
  }),

  updateCue: (id, patch) => set(s => {
    const record = shouldRecordUpdate(id)
    return {
      cues: s.cues.map(c => c.id === id ? { ...c, ...patch } as Cue : c),
      isDirty: true,
      past: record ? pushPast(s.past, s.cues) : s.past,
      future: record ? [] : s.future,
    }
  }),

  // toIndex is the insertion index AFTER fromIndex has been removed from the array.
  moveCue: (fromIndex, toIndex, newParentId) => set(s => {
    const cues = [...s.cues]
    const [moved] = cues.splice(fromIndex, 1)
    const parentId = newParentId !== undefined ? newParentId : moved.parentId
    cues.splice(toIndex, 0, { ...moved, parentId })
    return { cues, isDirty: true, past: pushPast(s.past, s.cues), future: [] }
  }),

  duplicateCue: (id) => set(s => {
    const src = s.cues.find(c => c.id === id)
    if (!src) return s

    const newGroupId = crypto.randomUUID()
    const isGroup = src.type === 'group'

    // Build the duplicated cue(s)
    const copies: Cue[] = [{
      ...src,
      id: isGroup ? newGroupId : crypto.randomUUID(),
      number: src.number + ' copy'
    }]

    if (isGroup) {
      // Duplicate all children with updated parentId
      const children = s.cues.filter(c => c.parentId === id)
      for (const child of children) {
        copies.push({ ...child, id: crypto.randomUUID(), parentId: newGroupId })
      }
    }

    // Insert after the original cue (and its children)
    const srcIdx = s.cues.findIndex(c => c.id === id)
    const insertAfter = isGroup ? lastChildIndex([...s.cues], id) : srcIdx
    const cues = [...s.cues]
    cues.splice(insertAfter + 1, 0, ...copies)
    return { cues, selectedId: copies[0].id, isDirty: true, past: pushPast(s.past, s.cues), future: [] }
  }),

  undo: () => set(s => {
    if (s.past.length === 0) return s
    const past = [...s.past]
    const cues = past.pop()!
    return { cues, past, future: [s.cues, ...s.future.slice(0, HISTORY_LIMIT - 1)] }
  }),

  redo: () => set(s => {
    if (s.future.length === 0) return s
    const future = [...s.future]
    const cues = future.shift()!
    return { cues, future, past: pushPast(s.past, s.cues) }
  }),

  select: (id) => set({ selectedId: id }),

  setRunning: (id, state) => set(s => {
    const running = new Map(s.running)
    if (state === null) running.delete(id)
    else running.set(id, state)
    return { running }
  }),

  clearAllRunning: () => set({ running: new Map() }),

  syncCueDuration: (id, durationMs) => set(s => {
    const cue = s.cues.find(c => c.id === id)
    if (!cue || cue.duration === durationMs) return s
    return { cues: s.cues.map(c => c.id === id ? { ...c, duration: durationMs } : c) }
  }),

  loadWorkspace: (cues, name, path, audioSettings, midiSettings) => set({
    cues,
    workspaceName: name,
    workspacePath: path,
    isDirty: false,
    selectedId: cues.find(c => c.parentId === null)?.id ?? cues[0]?.id ?? null,
    running: new Map(),
    audioSettings: audioSettings ?? { ...defaultAudioSettings },
    midiSettings: midiSettings ?? { ...defaultMidiSettings },
    past: [],
    future: [],
  }),

  saveSucceeded: (path, name) => set({
    workspacePath: path,
    workspaceName: name,
    isDirty: false
  }),

  setWorkspaceName: (name) => set({ workspaceName: name, isDirty: true }),

  updateAudioSettings: (patch) => set(s => ({
    audioSettings: { ...s.audioSettings, ...patch },
    isDirty: true
  })),

  updateMidiSettings: (patch) => set(s => ({
    midiSettings: { ...s.midiSettings, ...patch },
    isDirty: true
  }))
}))

export function useSelectedCue(): Cue | null {
  return useStore(s => s.cues.find(c => c.id === s.selectedId) ?? null)
}

// Returns the GroupCue that owns the given cue, or null.
export function useParentGroup(cueId: string): GroupCue | null {
  return useStore(s => {
    const cue = s.cues.find(c => c.id === cueId)
    if (!cue?.parentId) return null
    const parent = s.cues.find(c => c.id === cue.parentId)
    return parent?.type === 'group' ? (parent as GroupCue) : null
  })
}
