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
