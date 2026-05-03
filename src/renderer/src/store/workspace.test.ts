import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'
import type { Cue } from '../types/cue'

function resetStore() {
  useStore.setState({
    cues: [],
    workspaceName: 'Untitled',
    workspacePath: null,
    isDirty: false,
    selectedId: null,
    running: new Map()
  })
}

const fakeCues: Cue[] = [
  {
    id: 'c1', number: '1', name: 'House to half', type: 'wait',
    colorLabel: 'orange', parentId: null, preWait: 0, postWait: 0, duration: 3000,
    advance: 'none', isArmed: true, notes: ''
  },
  {
    id: 'c2', number: '2', name: 'Scene 1 music', type: 'wait',
    colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, duration: 5000,
    advance: 'none', isArmed: true, notes: ''
  }
]

describe('store — isDirty tracking', () => {
  beforeEach(resetStore)

  it('starts clean', () => {
    expect(useStore.getState().isDirty).toBe(false)
  })

  it('addCue marks dirty', () => {
    useStore.getState().addCue('wait')
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('removeCue marks dirty', () => {
    useStore.getState().addCue('wait')
    useStore.setState({ isDirty: false })
    const id = useStore.getState().cues[0].id
    useStore.getState().removeCue(id)
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('updateCue marks dirty', () => {
    useStore.getState().addCue('wait')
    useStore.setState({ isDirty: false })
    const id = useStore.getState().cues[0].id
    useStore.getState().updateCue(id, { name: 'New name' })
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('moveCue marks dirty', () => {
    useStore.getState().addCue('wait')
    useStore.getState().addCue('audio')
    useStore.setState({ isDirty: false })
    useStore.getState().moveCue(0, 1)
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('duplicateCue marks dirty', () => {
    useStore.getState().addCue('wait')
    useStore.setState({ isDirty: false })
    const id = useStore.getState().cues[0].id
    useStore.getState().duplicateCue(id)
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('setWorkspaceName marks dirty', () => {
    useStore.getState().setWorkspaceName('My Show')
    expect(useStore.getState().isDirty).toBe(true)
  })
})

describe('store — loadWorkspace', () => {
  beforeEach(resetStore)

  it('replaces cues with loaded ones', () => {
    useStore.getState().addCue('wait') // pre-existing
    useStore.getState().loadWorkspace(fakeCues, 'My Show', '/shows/my-show.wlab')
    expect(useStore.getState().cues).toHaveLength(2)
    expect(useStore.getState().cues[0].name).toBe('House to half')
  })

  it('sets workspace name and path', () => {
    useStore.getState().loadWorkspace(fakeCues, 'My Show', '/shows/my-show.wlab')
    expect(useStore.getState().workspaceName).toBe('My Show')
    expect(useStore.getState().workspacePath).toBe('/shows/my-show.wlab')
  })

  it('clears dirty flag after load', () => {
    useStore.getState().addCue('wait') // makes dirty
    useStore.getState().loadWorkspace(fakeCues, 'My Show', '/shows/my-show.wlab')
    expect(useStore.getState().isDirty).toBe(false)
  })

  it('selects the first cue on load', () => {
    useStore.getState().loadWorkspace(fakeCues, 'My Show', '/shows/my-show.wlab')
    expect(useStore.getState().selectedId).toBe('c1')
  })

  it('sets selectedId to null if loaded with empty cue list', () => {
    useStore.getState().loadWorkspace([], 'Empty Show', null)
    expect(useStore.getState().selectedId).toBeNull()
  })

  it('clears running state on load', () => {
    useStore.setState({ running: new Map([['old', { cueId: 'old', state: 'playing', startedAt: 0, progress: 0 }]]) })
    useStore.getState().loadWorkspace(fakeCues, 'My Show', null)
    expect(useStore.getState().running.size).toBe(0)
  })
})

describe('store — saveSucceeded', () => {
  beforeEach(resetStore)

  it('clears dirty flag', () => {
    useStore.getState().addCue('wait')
    useStore.getState().saveSucceeded('/shows/my-show.wlab', 'My Show')
    expect(useStore.getState().isDirty).toBe(false)
  })

  it('updates path and name', () => {
    useStore.getState().saveSucceeded('/new/path.wlab', 'Renamed')
    expect(useStore.getState().workspacePath).toBe('/new/path.wlab')
    expect(useStore.getState().workspaceName).toBe('Renamed')
  })
})
