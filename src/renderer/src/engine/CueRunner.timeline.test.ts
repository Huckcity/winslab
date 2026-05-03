import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CueRunner } from './CueRunner'
import type { Cue, WaitCue, GroupCue } from '../types/cue'

vi.mock('./AudioPlayer', () => ({
  audioPlayer: { play: vi.fn(), stop: vi.fn(), stopAll: vi.fn(), setVolume: vi.fn() }
}))

function makeGroup(id: string, overrides: Partial<GroupCue> = {}): GroupCue {
  return {
    id, number: id, name: id, type: 'group',
    colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
    advance: 'none', isArmed: true, notes: '',
    mode: 'timeline',
    ...overrides
  }
}

function makeWait(id: string, parentId: string, overrides: Partial<WaitCue> = {}): WaitCue {
  return {
    id, number: id, name: id, type: 'wait',
    colorLabel: 'none', parentId, preWait: 0, postWait: 0, timelineOffset: 0, duration: 100,
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
    syncCueDuration: vi.fn(),
  })
  return { runner, setRunning }
}

describe('CueRunner — timeline group mode', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('fires all children concurrently (both playing before first finishes)', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 500 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 200, duration: 500 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.advanceTimersByTime(250) // c1 started at 0, c2 started at 200 — both playing

    const playing = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
    expect(playing).toContain('c1')
    expect(playing).toContain('c2')
  })

  it('fires children at their timelineOffset, not sequentially', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 100 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 500, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.advanceTimersByTime(50) // only c1 should have started

    const firedSoFar = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
    expect(firedSoFar).toContain('c1')
    expect(firedSoFar).not.toContain('c2')

    vi.advanceTimersByTime(500) // c2's offset reached
    const allFired = setRunning.mock.calls
      .filter(c => c[1]?.state === 'playing')
      .map(c => c[0])
    expect(allFired).toContain('c2')
  })

  it('calls onDone after the last child finishes (slowest child)', () => {
    const group = makeGroup('g1')
    // c1 fires at 0 and takes 100ms; c2 fires at 50ms and takes 300ms — c2 finishes last at 350ms
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 100 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 50, duration: 300 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.advanceTimersByTime(340) // c1 done at 100ms, c2 should still be running

    // group should not yet be cleared
    const groupCleared = setRunning.mock.calls.some(c => c[0] === 'g1' && c[1] === null)
    expect(groupCleared).toBe(false)

    vi.runAllTimers()
    const groupClearedAfter = setRunning.mock.calls.some(c => c[0] === 'g1' && c[1] === null)
    expect(groupClearedAfter).toBe(true)
  })

  it('calls onDone immediately when group has no children', () => {
    const group = makeGroup('g1')
    const { runner, setRunning } = setup([group])

    runner.go()
    vi.runAllTimers()

    expect(setRunning).toHaveBeenCalledWith('g1', null)
  })

  it('skips disarmed children', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { isArmed: false })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 0, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.runAllTimers()

    const fired = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(fired).not.toContain('c1')
    expect(fired).toContain('c2')
  })

  it('stop() cancels pending timeline-offset timers', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 1000, duration: 100 })
    const { runner, setRunning } = setup([group, c1])

    runner.go()
    vi.advanceTimersByTime(0) // group starts but c1 is pending at 1000ms

    runner.stop('g1')
    vi.runAllTimers() // advance past the offset — c1 should never fire

    const firedC1 = setRunning.mock.calls.filter(c => c[0] === 'c1' && c[1]?.state === 'playing')
    expect(firedC1).toHaveLength(0)
  })

  it('seekTimeline while stopped stores offset for next go', () => {
    const group = makeGroup('g1')
    // c1 at 0ms, c2 at 500ms — seek to 600ms skips both
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 100 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 500, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.seekTimeline('g1', 600)
    runner.go()
    vi.runAllTimers()

    const fired = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(fired).not.toContain('c1')
    expect(fired).not.toContain('c2')
  })

  it('seekTimeline while stopped — children past offset still fire', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 100 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 500, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.seekTimeline('g1', 300) // skip c1 (at 0), c2 (at 500) fires after 200ms
    runner.go()
    vi.advanceTimersByTime(250) // 200ms delay for c2 has elapsed

    const fired = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(fired).not.toContain('c1')
    expect(fired).toContain('c2')
  })

  it('seekTimeline while playing stops current playback and restarts from offset', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 2000 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 1000, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.advanceTimersByTime(500) // c1 playing, c2 not yet scheduled

    setRunning.mockClear()
    runner.seekTimeline('g1', 1500) // seek past c2's offset — c2 should not fire
    vi.runAllTimers()

    const firedAfterSeek = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(firedAfterSeek).not.toContain('c2')
  })

  it('getGroupStartOffset returns 0 when no seek set', () => {
    const group = makeGroup('g1')
    const { runner } = setup([group])
    expect(runner.getGroupStartOffset('g1')).toBe(0)
  })

  it('getGroupStartOffset returns the stored value after seekTimeline', () => {
    const group = makeGroup('g1')
    const { runner } = setup([group])
    runner.seekTimeline('g1', 750)
    expect(runner.getGroupStartOffset('g1')).toBe(750)
  })
})
