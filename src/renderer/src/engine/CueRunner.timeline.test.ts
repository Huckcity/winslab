import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CueRunner } from './CueRunner'
import { audioPlayer } from './AudioPlayer'
import type { Cue, WaitCue, AudioCue, GroupCue } from '../types/cue'

vi.mock('./AudioPlayer', () => ({
  audioPlayer: {
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    stopAll: vi.fn(),
    setVolume: vi.fn(),
    isPlaying: vi.fn(() => false),
  }
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

function makeAudio(id: string, parentId: string, overrides: Partial<AudioCue> = {}): AudioCue {
  return {
    id, number: id, name: id, type: 'audio',
    colorLabel: 'none', parentId, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
    advance: 'none', isArmed: true, notes: '',
    filePath: '/test.wav', startTime: 0, endTime: null,
    fadeInDuration: 0, fadeOutDuration: 0,
    outputs: [{ deviceId: 'default', channelPair: [1, 2] as [number, number], volume: 1, pan: 0 }],
    loopCount: 0,
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

  // ── Seek behaviour ──────────────────────────────────────────────────────────

  it('seek while stopped: cues after seek point are scheduled with adjusted delay', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0,   duration: 100 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 500, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.seekTimeline('g1', 300) // c1 done (100ms), c2 fires 200ms after seek
    runner.go()
    vi.advanceTimersByTime(250)    // 200ms adjusted delay for c2 has elapsed

    const playing = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(playing).not.toContain('c1')
    expect(playing).toContain('c2')
  })

  it('seek while stopped: cues fully before seek point are skipped', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0,   duration: 100 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 500, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.seekTimeline('g1', 650) // both cues have finished by 650ms
    runner.go()
    vi.runAllTimers()

    const played = setRunning.mock.calls.filter(c => c[1]?.state === 'playing').map(c => c[0])
    expect(played).not.toContain('c1')
    expect(played).not.toContain('c2')
  })

  it('seek while stopped: in-progress wait cue plays its remaining duration', () => {
    const group = makeGroup('g1')
    // c1 starts at 0ms and runs for 1000ms — seek to 600ms leaves 400ms remaining
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0, duration: 1000 })
    const { runner, setRunning } = setup([group, c1])

    runner.seekTimeline('g1', 600)
    runner.go()

    vi.advanceTimersByTime(399) // not done yet (400ms remaining)
    const notDone = setRunning.mock.calls.some(c => c[0] === 'c1' && c[1] === null)
    expect(notDone).toBe(false)

    vi.advanceTimersByTime(2)   // 401ms total — should be done now
    const done = setRunning.mock.calls.some(c => c[0] === 'c1' && c[1] === null)
    expect(done).toBe(true)
  })

  it('seek while stopped: in-progress audio cue plays from correct file offset', () => {
    const group = makeGroup('g1')
    // audio at offset 0, seek to 5000ms → should play from startTime+5000 in the file
    const a1 = makeAudio('a1', 'g1', { timelineOffset: 0, startTime: 1000 })
    const { runner } = setup([group, a1])

    runner.seekTimeline('g1', 5000)
    runner.go()
    vi.runAllTimers()

    expect(audioPlayer.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', startTime: 6000 }), // 1000 + 5000
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('seek while stopped: audio at non-zero timeline offset is played with correct seek', () => {
    const group = makeGroup('g1')
    // audio starts at 10000ms in the timeline; seek to 12000ms → 2000ms into the cue
    const a1 = makeAudio('a1', 'g1', { timelineOffset: 10000, startTime: 0 })
    const a2 = makeAudio('a2', 'g1', { timelineOffset: 20000, startTime: 0 })
    const { runner } = setup([group, a1, a2])

    runner.seekTimeline('g1', 12000)
    runner.go()
    vi.runAllTimers()

    // a1 is in-progress: should start 2000ms into the file
    expect(audioPlayer.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', startTime: 2000 }),
      expect.any(Function),
      expect.any(Function)
    )
    // a2 hasn't started yet: should be played from its own startTime (0) with no seek offset
    expect(audioPlayer.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a2', startTime: 0 }),
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('seek while playing: stops current playback and resumes in-progress cues from offset', () => {
    const group = makeGroup('g1')
    const c1 = makeWait('c1', 'g1', { timelineOffset: 0,    duration: 2000 })
    const c2 = makeWait('c2', 'g1', { timelineOffset: 1000, duration: 100 })
    const { runner, setRunning } = setup([group, c1, c2])

    runner.go()
    vi.advanceTimersByTime(500) // c1 playing, c2 pending

    setRunning.mockClear()
    runner.seekTimeline('g1', 1500) // seek past c2 (done at 1100ms), c1 has 500ms remaining
    // stop() → setRunning(c1, null), restart → setRunning(c1, playing)

    const c1Restarted = setRunning.mock.calls.some(c => c[0] === 'c1' && c[1]?.state === 'playing')
    expect(c1Restarted).toBe(true)
    const c2Restarted = setRunning.mock.calls.some(c => c[0] === 'c2' && c[1]?.state === 'playing')
    expect(c2Restarted).toBe(false)

    // Verify c1's 500ms remaining timer hasn't fired yet
    setRunning.mockClear()
    vi.advanceTimersByTime(499)
    expect(setRunning.mock.calls.some(c => c[0] === 'c1' && c[1] === null)).toBe(false)

    vi.advanceTimersByTime(2) // push past 500ms — timer fires
    expect(setRunning.mock.calls.some(c => c[0] === 'c1' && c[1] === null)).toBe(true)
  })

  it('seek while playing: still works when all timeline timers have already fired (audio actively playing)', () => {
    const group = makeGroup('g1')
    const a1 = makeAudio('a1', 'g1', { timelineOffset: 0 })
    const a2 = makeAudio('a2', 'g1', { timelineOffset: 5000 })
    const { runner } = setup([group, a1, a2])

    runner.go()
    vi.runAllTimers() // all :timeline timers consumed — audio "playing" via audioPlayer

    // Simulate both audio nodes active in AudioPlayer
    vi.mocked(audioPlayer.isPlaying).mockImplementation(id => id === 'a1' || id === 'a2')

    ;(audioPlayer.play as ReturnType<typeof vi.fn>).mockClear()
    runner.seekTimeline('g1', 7000) // a2 started at 5s, so 2s in; a1 started at 0, 7s in

    expect(audioPlayer.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', startTime: 7000 }),
      expect.any(Function),
      expect.any(Function)
    )
    expect(audioPlayer.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a2', startTime: 2000 }),
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('seek while playing: group running state is cleared when all children finish after seek', () => {
    const group = makeGroup('g1')
    const w1 = makeWait('w1', 'g1', { duration: 1000, timelineOffset: 0 })
    const w2 = makeWait('w2', 'g1', { duration: 1000, timelineOffset: 2000 })
    const { runner, setRunning } = setup([group, w1, w2])

    runner.go()
    vi.advanceTimersByTime(500) // group playing, w1 in progress, w2 not yet started

    // Seek to 500ms: w1 has 500ms remaining; w2 starts at 1500ms from now, lasts 1000ms more
    runner.seekTimeline('g1', 500)
    vi.advanceTimersByTime(500)  // w1 finishes (500ms remaining from seek)
    vi.advanceTimersByTime(2000) // w2 :timeline fires at +1500ms, w2 wait finishes at +2500ms
    vi.runAllTimers()            // flush 0ms post-wait chains

    // After all children done, group running state must be null
    expect(setRunning).toHaveBeenLastCalledWith('g1', null)
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
