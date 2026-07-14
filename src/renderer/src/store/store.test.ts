import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'

function resetStore() {
  useStore.setState({
    cues: [],
    selectedId: null,
    running: new Map()
  })
}

describe('store — addCue', () => {
  beforeEach(resetStore)

  it('appends a cue to the end by default', () => {
    useStore.getState().addCue('wait')
    expect(useStore.getState().cues).toHaveLength(1)
    expect(useStore.getState().cues[0].type).toBe('wait')
  })

  it('inserts a cue after the specified id', () => {
    useStore.getState().addCue('wait')
    const firstId = useStore.getState().cues[0].id
    useStore.getState().addCue('audio', firstId)

    const cues = useStore.getState().cues
    expect(cues[0].type).toBe('wait')
    expect(cues[1].type).toBe('audio')
  })

  it('selects the newly added cue', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    expect(useStore.getState().selectedId).toBe(id)
  })

})

describe('store — removeCue', () => {
  beforeEach(resetStore)

  it('removes the cue by id', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().removeCue(id)
    expect(useStore.getState().cues).toHaveLength(0)
  })

  it('clears selectedId when the selected cue is removed', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().select(id)
    useStore.getState().removeCue(id)
    expect(useStore.getState().selectedId).toBeNull()
  })

  it('preserves selectedId when a different cue is removed', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    const [first, second] = useStore.getState().cues
    useStore.getState().select(second.id)
    useStore.getState().removeCue(first.id)
    expect(useStore.getState().selectedId).toBe(second.id)
  })

})

describe('store — updateCue', () => {
  beforeEach(resetStore)

  it('patches the named fields without touching others', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    const originalNumber = useStore.getState().cues[0].number

    useStore.getState().updateCue(id, { name: 'My Wait', preWait: 500 })

    const cue = useStore.getState().cues[0]
    expect(cue.name).toBe('My Wait')
    expect(cue.preWait).toBe(500)
    expect(cue.number).toBe(originalNumber) // untouched
  })

  it('ignores updates to non-existent ids', () => {
    useStore.getState().addCue('wait')
    useStore.getState().updateCue('does-not-exist', { name: 'Ghost' })
    expect(useStore.getState().cues[0].name).not.toBe('Ghost')
  })
})

describe('store — moveCue', () => {
  beforeEach(resetStore)

  it('reorders cues correctly (move down)', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    useStore.getState().addCue('midi')

    const [a, b, c] = useStore.getState().cues.map(c => c.id)
    useStore.getState().moveCue(0, 2)

    const ids = useStore.getState().cues.map(c => c.id)
    expect(ids).toEqual([b, c, a])
  })

  it('reorders cues correctly (move up)', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    useStore.getState().addCue('midi')

    const [a, b, c] = useStore.getState().cues.map(c => c.id)
    useStore.getState().moveCue(2, 0)

    const ids = useStore.getState().cues.map(c => c.id)
    expect(ids).toEqual([c, a, b])
  })
})

describe('store — groups and parentId', () => {
  beforeEach(resetStore)

  it('adding a cue after a group header makes it a child', () => {
    useStore.getState().addCue('group')
    const groupId = useStore.getState().cues[0].id
    useStore.getState().addCue('wait', groupId)

    const cues = useStore.getState().cues
    expect(cues).toHaveLength(2)
    expect(cues[1].parentId).toBe(groupId)
  })

  it('adding a cue after a child inherits the same parentId', () => {
    useStore.getState().addCue('group')
    const groupId = useStore.getState().cues[0].id
    useStore.getState().addCue('wait', groupId)         // child
    const childId = useStore.getState().cues[1].id
    useStore.getState().addCue('audio', childId)        // sibling child

    const cues = useStore.getState().cues
    expect(cues[2].parentId).toBe(groupId)
  })

  it('removing a group also removes its children', () => {
    useStore.getState().addCue('group')
    const groupId = useStore.getState().cues[0].id
    useStore.getState().addCue('wait', groupId)
    useStore.getState().addCue('audio', groupId)
    expect(useStore.getState().cues).toHaveLength(3)

    useStore.getState().removeCue(groupId)
    expect(useStore.getState().cues).toHaveLength(0)
  })

  it('moveCue with newParentId updates the parentId', () => {
    useStore.getState().addCue('group')
    const groupId = useStore.getState().cues[0].id
    useStore.getState().addCue('wait')                  // top-level wait at index 1

    // Remove from index 1, re-insert at index 1 (post-removal), with new parentId
    useStore.getState().moveCue(1, 1, groupId)
    expect(useStore.getState().cues[1].parentId).toBe(groupId)
  })

  it('duplicating a group duplicates its children too', () => {
    useStore.getState().addCue('group')
    const groupId = useStore.getState().cues[0].id
    useStore.getState().addCue('wait', groupId)
    useStore.getState().addCue('audio', groupId)
    expect(useStore.getState().cues).toHaveLength(3)

    useStore.getState().duplicateCue(groupId)
    const cues = useStore.getState().cues
    expect(cues).toHaveLength(6)

    const copyGroup = cues[3]
    expect(copyGroup.type).toBe('group')
    expect(copyGroup.id).not.toBe(groupId)
    expect(cues[4].parentId).toBe(copyGroup.id)
    expect(cues[5].parentId).toBe(copyGroup.id)
  })
})

describe('store — duplicateCue', () => {
  beforeEach(resetStore)

  it('inserts a copy directly after the original', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    const [wait] = useStore.getState().cues

    useStore.getState().duplicateCue(wait.id)

    expect(useStore.getState().cues).toHaveLength(3)
    expect(useStore.getState().cues[0].id).toBe(wait.id)
    expect(useStore.getState().cues[1].type).toBe('wait') // the copy
    expect(useStore.getState().cues[1].id).not.toBe(wait.id) // new id
  })

  it('selects the duplicate', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().duplicateCue(id)

    const copyId = useStore.getState().cues[1].id
    expect(useStore.getState().selectedId).toBe(copyId)
  })
})

describe('store — settings', () => {
  beforeEach(() => {
    useStore.setState({
      audioSettings: { outputDeviceId: 'default', sampleRate: 48000, bufferSize: 256 },
      midiSettings: { outputPortName: '', inputPortName: '' },
    })
  })

  it('updateAudioSettings merges patch into audioSettings', () => {
    useStore.getState().updateAudioSettings({ outputDeviceId: 'device-123' })
    expect(useStore.getState().audioSettings.outputDeviceId).toBe('device-123')
    expect(useStore.getState().audioSettings.sampleRate).toBe(48000)
  })

  it('updateMidiSettings merges patch into midiSettings', () => {
    useStore.getState().updateMidiSettings({ outputPortName: 'IAC Driver Bus 1' })
    expect(useStore.getState().midiSettings.outputPortName).toBe('IAC Driver Bus 1')
    expect(useStore.getState().midiSettings.inputPortName).toBe('')
  })

  it('updateAudioSettings marks workspace dirty', () => {
    useStore.setState({ isDirty: false })
    useStore.getState().updateAudioSettings({ outputDeviceId: 'x' })
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('loadWorkspace restores audioSettings when provided', () => {
    const audioSettings = { outputDeviceId: 'hw-1', sampleRate: 44100, bufferSize: 512 }
    const midiSettings = { outputPortName: 'Port A', inputPortName: '' }
    useStore.getState().loadWorkspace([], 'Test', null, audioSettings, midiSettings)
    expect(useStore.getState().audioSettings).toEqual(audioSettings)
    expect(useStore.getState().midiSettings).toEqual(midiSettings)
  })

  it('loadWorkspace falls back to defaults when settings are omitted', () => {
    useStore.getState().loadWorkspace([], 'Test', null)
    expect(useStore.getState().audioSettings.outputDeviceId).toBe('default')
    expect(useStore.getState().midiSettings.outputPortName).toBe('')
  })
})

describe('store — undo/redo', () => {
  beforeEach(() => {
    useStore.setState({ cues: [], selectedId: null, running: new Map(), past: [], future: [] })
  })

  it('undo after addCue restores the empty list', () => {
    useStore.getState().addCue('wait')
    expect(useStore.getState().cues).toHaveLength(1)
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(0)
  })

  it('undo after removeCue restores the cue', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().removeCue(id)
    expect(useStore.getState().cues).toHaveLength(0)
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(1)
  })

  it('undo after duplicateCue removes the copy', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().duplicateCue(id)
    expect(useStore.getState().cues).toHaveLength(2)
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(1)
    expect(useStore.getState().cues[0].id).toBe(id)
  })

  it('undo is a no-op when history is empty', () => {
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(0)
  })

  it('redo restores the state that was undone', () => {
    useStore.getState().addCue('wait')
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(0)
    useStore.getState().redo()
    expect(useStore.getState().cues).toHaveLength(1)
  })

  it('redo is a no-op when future is empty', () => {
    useStore.getState().addCue('wait')
    useStore.getState().redo() // no-op
    expect(useStore.getState().cues).toHaveLength(1)
  })

  it('new mutation clears redo stack', () => {
    useStore.getState().addCue('wait')
    useStore.getState().undo()
    useStore.getState().addCue('audio') // new action after undo
    expect(useStore.getState().future).toHaveLength(0)
    // redo should be a no-op
    useStore.getState().redo()
    expect(useStore.getState().cues).toHaveLength(1)
    expect(useStore.getState().cues[0].type).toBe('audio')
  })

  it('multiple undos step back through history', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    useStore.getState().addCue('midi')
    expect(useStore.getState().cues).toHaveLength(3)
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(2)
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(1)
    useStore.getState().undo()
    expect(useStore.getState().cues).toHaveLength(0)
  })

  it('updateCue coalesces rapid calls for the same cue into one history entry', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    const originalName = useStore.getState().cues[0].name

    // First call records history; rapid follow-ups do not
    useStore.getState().updateCue(id, { name: 'A' })
    useStore.getState().updateCue(id, { name: 'AB' })
    useStore.getState().updateCue(id, { name: 'ABC' })

    // One undo should restore state before 'A' was set
    useStore.getState().undo()
    expect(useStore.getState().cues[0].name).toBe(originalName)
  })

  it('updateCue records separate history for different cues', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    const [c1, c2] = useStore.getState().cues

    useStore.getState().updateCue(c1.id, { name: 'First' })
    useStore.getState().updateCue(c2.id, { name: 'Second' }) // different cue → new entry

    useStore.getState().undo()
    expect(useStore.getState().cues.find(c => c.id === c2.id)?.name).not.toBe('Second')
    expect(useStore.getState().cues.find(c => c.id === c1.id)?.name).toBe('First')
  })

  it('loadWorkspace clears undo and redo stacks', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    expect(useStore.getState().past.length).toBeGreaterThan(0)

    useStore.getState().loadWorkspace([], 'Fresh', null)
    expect(useStore.getState().past).toHaveLength(0)
    expect(useStore.getState().future).toHaveLength(0)
  })
})

describe('store — setRunning / clearAllRunning', () => {
  beforeEach(() => {
    useStore.setState({ running: new Map(), cues: [], selectedId: null })
  })

  it('setRunning adds a running cue', () => {
    useStore.getState().setRunning('c1', { cueId: 'c1', state: 'playing', startedAt: 1000, progress: 0.5 })
    const running = useStore.getState().running
    expect(running.get('c1')).toEqual({ cueId: 'c1', state: 'playing', startedAt: 1000, progress: 0.5 })
  })

  it('setRunning with null removes the running cue', () => {
    useStore.getState().setRunning('c1', { cueId: 'c1', state: 'playing', startedAt: 1000, progress: 0.5 })
    useStore.getState().setRunning('c1', null)
    expect(useStore.getState().running.has('c1')).toBe(false)
  })

  it('setRunning preserves other running cues when removing one', () => {
    useStore.getState().setRunning('c1', { cueId: 'c1', state: 'playing', startedAt: 1000, progress: 0 })
    useStore.getState().setRunning('c2', { cueId: 'c2', state: 'playing', startedAt: 2000, progress: 0 })
    useStore.getState().setRunning('c1', null)
    expect(useStore.getState().running.has('c2')).toBe(true)
    expect(useStore.getState().running.size).toBe(1)
  })

  it('clearAllRunning removes all running cues', () => {
    useStore.getState().setRunning('c1', { cueId: 'c1', state: 'playing', startedAt: 1000, progress: 0 })
    useStore.getState().setRunning('c2', { cueId: 'c2', state: 'playing', startedAt: 2000, progress: 0 })
    useStore.getState().clearAllRunning()
    expect(useStore.getState().running.size).toBe(0)
  })

  it('clearAllRunning on empty map is a no-op', () => {
    useStore.getState().clearAllRunning()
    expect(useStore.getState().running.size).toBe(0)
  })
})

describe('store — syncCueDuration', () => {
  beforeEach(() => {
    useStore.setState({ cues: [] })
  })

  it('sets duration on the matching cue', () => {
    useStore.getState().addCue('audio')
    const id = useStore.getState().cues[0].id
    useStore.getState().syncCueDuration(id, 5000)
    expect(useStore.getState().cues[0].duration).toBe(5000)
  })

  it('does nothing when cue id is not found', () => {
    useStore.getState().addCue('audio')
    const originalDuration = useStore.getState().cues[0].duration
    useStore.getState().syncCueDuration('nonexistent', 5000)
    expect(useStore.getState().cues[0].duration).toBe(originalDuration)
  })

  it('returns early when duration is unchanged', () => {
    useStore.getState().addCue('audio')
    const id = useStore.getState().cues[0].id
    useStore.getState().syncCueDuration(id, 0) // initial duration is 0
    expect(useStore.getState().cues[0].duration).toBe(0)
  })
})

describe('store — loadWorkspace', () => {
  beforeEach(() => {
    useStore.setState({ cues: [], selectedId: null, past: [], future: [] })
  })

  it('selects the first top-level cue', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    const waitId = useStore.getState().cues[0].id
    const audioId = useStore.getState().cues[1].id

    useStore.getState().loadWorkspace(
      useStore.getState().cues.map(c => ({ ...c, parentId: null })),
      'Test', null
    )
    // Should select the first cue (wait)
    expect(useStore.getState().selectedId).toBe(waitId)
  })

  it('selects null when cues array is empty', () => {
    useStore.getState().loadWorkspace([], 'Empty', null)
    expect(useStore.getState().selectedId).toBeNull()
  })
})

describe('store — hooks logic', () => {
  beforeEach(() => {
    useStore.setState({ cues: [], selectedId: null, running: new Map() })
  })

  it('selectedId null causes find to return null (useSelectedCue logic)', () => {
    const state = useStore.getState()
    const found = state.cues.find(c => c.id === state.selectedId) ?? null
    expect(found).toBeNull()
  })

  it('selectedId matching a cue returns that cue (useSelectedCue logic)', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().select(id)

    const state = useStore.getState()
    const found = state.cues.find(c => c.id === state.selectedId) ?? null
    expect(found).not.toBeNull()
    expect(found!.id).toBe(id)
  })

  it('selectedId pointing to a removed cue returns null (useSelectedCue logic)', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id
    useStore.getState().select(id)
    useStore.getState().removeCue(id)

    const state = useStore.getState()
    const found = state.cues.find(c => c.id === state.selectedId) ?? null
    expect(found).toBeNull()
  })

  it('parent group lookup returns null when cue has no parentId', () => {
    useStore.getState().addCue('wait')
    const id = useStore.getState().cues[0].id

    const state = useStore.getState()
    const cue = state.cues.find(c => c.id === id)
    const parent = cue?.parentId ? state.cues.find(c => c.id === cue.parentId) : null
    expect(parent).toBeNull()
  })

  it('parent group lookup returns null when parent is not a group', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio', useStore.getState().cues[0].id)
    const childId = useStore.getState().cues[1].id

    const state = useStore.getState()
    const cue = state.cues.find(c => c.id === childId)
    const parent = cue?.parentId ? state.cues.find(c => c.id === cue.parentId) : null
    const result = parent?.type === 'group' ? parent : null
    expect(result).toBeNull()
  })

  it('parent group lookup returns the group cue for a child', () => {
    useStore.getState().addCue('group')
    const groupId = useStore.getState().cues[0].id
    useStore.getState().addCue('wait', groupId)
    const childId = useStore.getState().cues[1].id

    const state = useStore.getState()
    const cue = state.cues.find(c => c.id === childId)
    const parent = cue?.parentId ? state.cues.find(c => c.id === cue.parentId) : null
    const result = parent?.type === 'group' ? parent : null
    expect(result).not.toBeNull()
    expect(result!.id).toBe(groupId)
    expect(result!.type).toBe('group')
  })

  it('parent group lookup returns null for non-existent cue id', () => {
    const state = useStore.getState()
    const cue = state.cues.find(c => c.id === 'nonexistent')
    const parent = cue?.parentId ? state.cues.find(c => c.id === cue.parentId) : null
    expect(parent).toBeNull()
  })
})
