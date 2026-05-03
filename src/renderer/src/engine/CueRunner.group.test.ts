import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CueRunner } from './CueRunner'
import type { Cue, WaitCue, GroupCue } from '../types/cue'
import type { RunningCue } from '../store'

vi.mock('./AudioPlayer', () => ({
  audioPlayer: { play: vi.fn(), stop: vi.fn(), stopAll: vi.fn(), setVolume: vi.fn() }
}))

function makeGroup(id: string, overrides: Partial<GroupCue> = {}): GroupCue {
  return {
    id, number: id, name: id, type: 'group',
    colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, duration: 0,
    advance: 'none', isArmed: true, notes: '',
    mode: 'sequence',
    ...overrides
  }
}

function makeWait(id: string, parentId: string | null, overrides: Partial<WaitCue> = {}): WaitCue {
  return {
    id, number: id, name: id, type: 'wait',
    colorLabel: 'none', parentId, preWait: 0, postWait: 0, duration: 100,
    advance: 'none', isArmed: true, notes: '',
    ...overrides
  }
}

function setup(cues: Cue[]) {
  const runner = new CueRunner()
  const setRunning = vi.fn()

  runner.init({
    getCues: () => cues,
    getSelected: () => cues[0]?.id ?? null,
    setSelected: vi.fn(),
    setRunning,
    clearAllRunning: vi.fn(),
    syncCueDuration: vi.fn()
  })
  return { runner, setRunning }
}

describe('CueRunner — group cue (sequence mode)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('runs all children in order before calling done', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { duration: 100 })
    const c2 = makeWait('c2', 'g1', { duration: 100 })
    const c3 = makeWait('c3', 'g1', { duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2, c3])

    runner.go()
    vi.runAllTimers()

    const fired = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
    expect(fired).toContain('c1')
    expect(fired).toContain('c2')
    expect(fired).toContain('c3')
  })

  it('runs children sequentially — c2 does not start until c1 finishes', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { duration: 500 })
    const c2 = makeWait('c2', 'g1', { duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.advanceTimersByTime(200) // c1 is still playing

    const firedSoFar = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
    expect(firedSoFar).toContain('c1')
    expect(firedSoFar).not.toContain('c2')

    vi.runAllTimers()
    const allFired = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
    expect(allFired).toContain('c2')
  })

  it('skips disarmed children', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { isArmed: false })
    const c2 = makeWait('c2', 'g1')
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.runAllTimers()

    const fired = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(fired).not.toContain('c1')
    expect(fired).toContain('c2')
  })

  it('calls done immediately when child list is empty', () => {
    const group = makeGroup('g1')
    const { runner, setRunning } = setup([group])

    runner.go()
    vi.runAllTimers()

    expect(setRunning).toHaveBeenCalledWith('g1', null)
  })
})

describe('CueRunner — group cue (random mode)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('fires exactly one child in random mode', () => {
    const group = makeGroup('g1', { mode: 'random' })
    const c1 = makeWait('c1', 'g1')
    const c2 = makeWait('c2', 'g1')
    const c3 = makeWait('c3', 'g1')
    const { runner, setRunning } = setup([group, c1, c2, c3])

    runner.go()
    vi.runAllTimers()

    const fired = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
      .filter(id => id !== 'g1')
    expect(fired).toHaveLength(1)
    expect(['c1', 'c2', 'c3']).toContain(fired[0])
  })
})

describe('CueRunner — selection skips group children', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('GO on a group advances selection past its children to the next top-level cue', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1')
    const c2 = makeWait('c2', 'g1')
    const next = makeWait('next', null)
    const setSelected = vi.fn()

    const runner = new CueRunner()
    runner.init({
      getCues: () => [group, c1, c2, next],
      getSelected: () => 'g1',
      setSelected,
      setRunning: vi.fn(),
      clearAllRunning: vi.fn(),
      syncCueDuration: vi.fn(),
    })

    runner.go()
    expect(setSelected).toHaveBeenCalledWith('next')
  })
})
