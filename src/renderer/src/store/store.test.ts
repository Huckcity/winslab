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
