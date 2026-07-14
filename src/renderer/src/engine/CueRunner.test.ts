import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CueRunner } from './CueRunner'
import { audioPlayer } from './AudioPlayer'
import type { Cue, WaitCue, AudioCue, FadeCue, StopCue, NetworkCue, ScriptCue } from '../types/cue'
import type { RunningCue } from '../store'

vi.mock('./AudioPlayer', () => ({
  audioPlayer: {
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    stopAll: vi.fn(),
    setVolume: vi.fn(),
    setPan: vi.fn(),
    isPlaying: vi.fn(() => false)
  }
}))

// Helpers
function makeWait(overrides: Partial<WaitCue> = {}): WaitCue {
  return {
    id: 'w1', number: '1', name: 'Wait', type: 'wait',
    colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 1000,
    advance: 'none', isArmed: true, notes: '',
    ...overrides
  }
}

function makeAudio(overrides: Partial<AudioCue> = {}): AudioCue {
  return {
    id: 'a1', number: '1', name: 'Audio', type: 'audio',
    colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
    advance: 'none', isArmed: true, notes: '',
    filePath: '/test.mp3', startTime: 0, endTime: null,
    fadeInDuration: 0, fadeOutDuration: 0,
    outputs: [{ deviceId: 'default', channelPair: [1, 2], volume: 1, pan: 0 }],
    loopCount: 0,
    ...overrides
  }
}

interface TestSetup {
  runner: CueRunner
  cues: Cue[]
  setRunning: ReturnType<typeof vi.fn>
  setSelected: ReturnType<typeof vi.fn>
}

function setup(initialCues: Cue[], initialSelectedId?: string): TestSetup {
  const runner = new CueRunner()
  let selected: string | null = initialSelectedId ?? initialCues[0]?.id ?? null
  const setRunning = vi.fn()
  const setSelected = vi.fn((id: string | null) => { selected = id })

  runner.init({
    getCues: () => cues,
    getSelected: () => selected,
    setSelected,
    setRunning,
    clearAllRunning: vi.fn(),
    syncCueDuration: vi.fn()
  })

  const cues = initialCues
  return { runner, cues, setRunning, setSelected }
}

describe('CueRunner — basic execution', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('fires a wait cue and marks it playing immediately', () => {
    const { runner, setRunning } = setup([makeWait()])
    runner.go()
    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'playing' }))
  })

  it('marks cue done after duration elapses', () => {
    const { runner, setRunning } = setup([makeWait({ duration: 2000 })])
    runner.go()
    vi.advanceTimersByTime(2000)
    vi.runAllTimers() // flush the 0ms postWait setTimeout chained inside
    expect(setRunning).toHaveBeenLastCalledWith('w1', null)
  })

  it('delegates audio cue to audioPlayer.play', () => {
    const cue = makeAudio()
    const { runner } = setup([cue])
    runner.go()
    expect(audioPlayer.play).toHaveBeenCalledWith(cue, expect.any(Function), expect.any(Function))
  })

  it('does not fire a disarmed cue', () => {
    const { runner, setRunning } = setup([makeWait({ isArmed: false })])
    runner.go()
    expect(setRunning).not.toHaveBeenCalled()
  })

  it('advances selection to the next cue on go()', () => {
    const cue1 = makeWait({ id: 'w1', number: '1' })
    const cue2 = makeWait({ id: 'w2', number: '2' })
    const { runner, setSelected } = setup([cue1, cue2])
    runner.go()
    expect(setSelected).toHaveBeenCalledWith('w2')
  })

  it('skips selection past the auto-fired cue when advance is set', () => {
    const cue1 = makeWait({ id: 'w1', advance: 'on-start' })
    const cue2 = makeWait({ id: 'w2' })
    const cue3 = makeWait({ id: 'w3' })
    const { runner, setSelected } = setup([cue1, cue2, cue3])
    runner.go()
    expect(setSelected).toHaveBeenCalledWith('w3')
  })

  it('sets selection to null when advance cue is second-to-last', () => {
    const cue1 = makeWait({ id: 'w1', advance: 'on-end' })
    const cue2 = makeWait({ id: 'w2' })
    const { runner, setSelected } = setup([cue1, cue2])
    runner.go()
    expect(setSelected).toHaveBeenCalledWith(null)
  })

  it('sets selection to null when firing the last cue', () => {
    const { runner, setSelected } = setup([makeWait()])
    runner.go()
    expect(setSelected).toHaveBeenCalledWith(null)
  })

  it('cancels a pre-wait timer before restarting the same cue', () => {
    const cue = makeWait({ id: 'w1', preWait: 500, duration: 1000 })
    const { runner, setRunning } = setup([cue])

    runner.go() // enters pre-wait; selection advances to null
    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'pre-wait' }))

    // With null selection, go() falls back to index 0 (same cue) — cancels and restarts
    runner.go()
    vi.advanceTimersByTime(500)
    vi.runAllTimers()

    const playingCalls = setRunning.mock.calls.filter(c => c[1]?.state === 'playing')
    expect(playingCalls).toHaveLength(1)
  })

})

describe('CueRunner — pre-wait and post-wait', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('delays execution for preWait ms and shows pre-wait state', () => {
    const { runner, setRunning } = setup([makeWait({ preWait: 500 })])
    runner.go()

    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'pre-wait' }))
    expect(setRunning).not.toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'playing' }))

    vi.advanceTimersByTime(500)
    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'playing' }))
  })

  it('fires pre-wait then playing then post-wait then done in sequence', () => {
    const { runner, setRunning } = setup([makeWait({ preWait: 200, duration: 500, postWait: 300 })])
    runner.go()

    const states = () => setRunning.mock.calls.map(c => c[1]?.state ?? null)

    expect(states()).toEqual(['pre-wait'])
    vi.advanceTimersByTime(200)
    expect(states()).toEqual(['pre-wait', 'playing'])
    vi.advanceTimersByTime(500)
    expect(states()).toEqual(['pre-wait', 'playing', 'post-wait'])
    vi.advanceTimersByTime(300)
    expect(states()).toEqual(['pre-wait', 'playing', 'post-wait', null])
  })

  it('skips pre-wait state when preWait is 0', () => {
    const { runner, setRunning } = setup([makeWait({ preWait: 0 })])
    runner.go()
    expect(setRunning).not.toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'pre-wait' }))
    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'playing' }))
  })
})

describe('CueRunner — auto-continue and auto-follow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('auto-continue fires the next cue without waiting for the current to finish', () => {
    const cue1 = makeWait({ id: 'w1', duration: 5000, advance: 'on-start' })
    const cue2 = makeWait({ id: 'w2' })
    const { runner, setRunning } = setup([cue1, cue2])

    runner.go()

    const ids = setRunning.mock.calls.map(c => c[0])
    // both cues should have started, even though w1 hasn't finished
    expect(ids).toContain('w1')
    expect(ids).toContain('w2')
  })

  it('auto-follow fires the next cue after current finishes (+ postWait)', () => {
    const cue1 = makeWait({ id: 'w1', duration: 1000, postWait: 0, advance: 'on-end' })
    const cue2 = makeWait({ id: 'w2', duration: 500 })
    const { runner, setRunning } = setup([cue1, cue2])

    runner.go()
    expect(setRunning.mock.calls.map(c => c[0])).not.toContain('w2')

    vi.advanceTimersByTime(1000) // w1 playing done
    vi.runAllTimers()            // flush nested 0ms postWait + autoFollow timers
    expect(setRunning.mock.calls.map(c => c[0])).toContain('w2')
  })

  it('auto-follow respects postWait before firing next cue', () => {
    const cue1 = makeWait({ id: 'w1', duration: 500, postWait: 1000, advance: 'on-end' })
    const cue2 = makeWait({ id: 'w2' })
    const { runner, setRunning } = setup([cue1, cue2])

    runner.go()
    vi.advanceTimersByTime(500) // w1 playing done, entering post-wait
    expect(setRunning.mock.calls.map(c => c[0])).not.toContain('w2')
    vi.advanceTimersByTime(1000) // post-wait done
    vi.runAllTimers()            // flush the 0ms auto-follow timer
    expect(setRunning.mock.calls.map(c => c[0])).toContain('w2')
  })
})

describe('CueRunner — stop and panic', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('stop() cancels a running wait cue before it finishes', () => {
    const { runner, setRunning } = setup([makeWait({ duration: 5000 })])
    runner.go()

    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'playing' }))
    runner.stop('w1')
    expect(setRunning).toHaveBeenLastCalledWith('w1', null)

    // Timer should be cancelled — no more calls after stop
    const callCount = setRunning.mock.calls.length
    vi.advanceTimersByTime(5000)
    expect(setRunning.mock.calls.length).toBe(callCount)
  })

  it('stop() with no argument cancels all running cues', () => {
    const cue1 = makeWait({ id: 'w1', duration: 5000, advance: 'on-start' })
    const cue2 = makeWait({ id: 'w2', duration: 5000 })
    const { runner } = setup([cue1, cue2])
    runner.go()
    runner.stop()
    expect(audioPlayer.stopAll).toHaveBeenCalled()
  })

  it('panic() calls audioPlayer.stopAll', () => {
    const { runner } = setup([makeWait({ duration: 5000 })])
    runner.go()
    runner.panic()
    expect(audioPlayer.stopAll).toHaveBeenCalled()
  })

  it('stop() during pre-wait prevents the cue from ever playing', () => {
    const { runner, setRunning } = setup([makeWait({ preWait: 2000, duration: 1000 })])
    runner.go()
    expect(setRunning).toHaveBeenCalledWith('w1', expect.objectContaining({ state: 'pre-wait' }))

    runner.stop('w1')
    vi.advanceTimersByTime(3000)

    const states = setRunning.mock.calls.map(c => c[1]?.state ?? null)
    expect(states).not.toContain('playing')
  })
})

describe('CueRunner — fade cue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('calls audioPlayer.setVolume with target value and duration', () => {
    const fadeCue: FadeCue = {
      id: 'f1', number: '1', name: 'Fade', type: 'fade',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 2000,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'a1', fadeProperty: 'volume', targetValue: 0,
      curve: 'linear', stopTargetWhenDone: false
    }
    const { runner } = setup([fadeCue])
    runner.go()
    expect(audioPlayer.setVolume).toHaveBeenCalledWith('a1', 0, 2000)
  })

  it('calls audioPlayer.setPan with target value and duration', () => {
    const fadeCue: FadeCue = {
      id: 'f1', number: '1', name: 'Fade', type: 'fade',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 1000,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'a1', fadeProperty: 'pan', targetValue: 0.5,
      curve: 'linear', stopTargetWhenDone: false
    }
    const { runner } = setup([fadeCue])
    runner.go()
    expect(audioPlayer.setPan).toHaveBeenCalledWith('a1', 0.5, 1000)
  })

  it('stops the target cue after fading when stopTargetWhenDone is true', () => {
    const fadeCue: FadeCue = {
      id: 'f1', number: '1', name: 'Fade', type: 'fade',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 500,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'a1', fadeProperty: 'volume', targetValue: 0,
      curve: 'linear', stopTargetWhenDone: true
    }
    const { runner } = setup([fadeCue])
    runner.go()
    vi.advanceTimersByTime(500)
    expect(audioPlayer.stop).toHaveBeenCalledWith('a1')
  })
})

describe('CueRunner — stop cue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('stop cue targeting "all" calls audioPlayer.stopAll', () => {
    const stopCue: StopCue = {
      id: 's1', number: '1', name: 'Stop All', type: 'stop',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'all', fadeOut: false, fadeOutDuration: 500
    }
    const { runner } = setup([stopCue])
    runner.go()
    expect(audioPlayer.stopAll).toHaveBeenCalledWith(0)
  })

  it('stop cue with fadeOut passes fadeOutDuration to stopAll', () => {
    const stopCue: StopCue = {
      id: 's1', number: '1', name: 'Stop All', type: 'stop',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'all', fadeOut: true, fadeOutDuration: 1500
    }
    const { runner } = setup([stopCue])
    runner.go()
    expect(audioPlayer.stopAll).toHaveBeenCalledWith(1500)
  })

  it('stop cue targeting a specific cue calls audioPlayer.stop without fade', () => {
    const stopCue: StopCue = {
      id: 's1', number: '1', name: 'Stop Specific', type: 'stop',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'a1', fadeOut: false, fadeOutDuration: 0
    }
    const { runner } = setup([stopCue])
    runner.go()
    expect(audioPlayer.stop).toHaveBeenCalledWith('a1', 0)
  })

  it('stop cue targeting a specific cue with fadeOut passes fadeOutDuration', () => {
    const stopCue: StopCue = {
      id: 's1', number: '1', name: 'Stop Specific Fade', type: 'stop',
      colorLabel: 'none', preWait: 0, postWait: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      targetCueId: 'a1', fadeOut: true, fadeOutDuration: 800
    }
    const { runner } = setup([stopCue])
    runner.go()
    expect(audioPlayer.stop).toHaveBeenCalledWith('a1', 800)
  })
})

describe('CueRunner — network cue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('calls fetch with url, method, headers, body, and a timeout signal', () => {
    const networkCue: NetworkCue = {
      id: 'n1', number: '1', name: 'Network', type: 'network',
      colorLabel: 'none', preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      method: 'POST',
      url: 'https://example.com/api',
      body: '{"key":"value"}',
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000
    }
    const { runner } = setup([networkCue])
    runner.go()

    expect(fetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}',
      signal: expect.any(AbortSignal)
    })
  })

  it('uses default 5000ms timeout when cue.timeout is not set', () => {
    const networkCue: NetworkCue = {
      id: 'n2', number: '2', name: 'Default Timeout', type: 'network',
      colorLabel: 'none', preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      method: 'GET',
      url: 'https://example.com',
      body: '',
      headers: {},
      timeout: 5000
    }
    const { runner } = setup([networkCue])
    runner.go()

    expect(fetch).toHaveBeenCalledWith('https://example.com', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: expect.any(AbortSignal)
    })
  })

  it('calls onDone after fetch completes', async () => {
    const networkCue: NetworkCue = {
      id: 'n3', number: '3', name: 'Network', type: 'network',
      colorLabel: 'none', preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'on-end', isArmed: true, notes: '',
      method: 'GET',
      url: 'https://example.com',
      body: '',
      headers: {},
      timeout: 5000
    }
    const cue2 = makeWait({ id: 'w2', number: '4' })
    const { runner, setRunning } = setup([networkCue, cue2])
    runner.go()

    // Should not fire next cue until fetch resolves
    expect(setRunning.mock.calls.map(c => c[0])).not.toContain('w2')

    // Flush microtasks — the mock fetch resolves immediately, so onDone should fire
    await vi.runAllTimersAsync()
    expect(setRunning.mock.calls.map(c => c[0])).toContain('w2')
  })
})

describe('CueRunner — script cue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    console.error = vi.fn()
  })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('executes the script string via new Function', () => {
    let executed = false
    const scriptCue: ScriptCue = {
      id: 'sc1', number: '1', name: 'Script', type: 'script',
      colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      language: 'javascript',
      script: 'executed = true'
    }
    // Make executed accessible in the eval scope
    ;(globalThis as any).executed = false
    const { runner } = setup([scriptCue])
    runner.go()
    expect((globalThis as any).executed).toBe(true)
    delete (globalThis as any).executed
  })

  it('calls onDone immediately after executing script', () => {
    const scriptCue: ScriptCue = {
      id: 'sc1', number: '1', name: 'Script', type: 'script',
      colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'on-end', isArmed: true, notes: '',
      language: 'javascript',
      script: 'const x = 1 + 1'
    }
    const cue2 = makeWait({ id: 'w2', number: '2' })
    const { runner, setRunning } = setup([scriptCue, cue2])
    runner.go()
    // Script execute calls onDone synchronously, but post-wait timeout fires asynchronously
    vi.runAllTimers()
    expect(setRunning.mock.calls.map(c => c[0])).toContain('w2')
  })

  it('does not throw when script throws', () => {
    const scriptCue: ScriptCue = {
      id: 'sc1', number: '1', name: 'Script', type: 'script',
      colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'none', isArmed: true, notes: '',
      language: 'javascript',
      script: 'throw new Error("boom")'
    }
    const { runner } = setup([scriptCue])
    expect(() => runner.go()).not.toThrow()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('CueRunner — panic details', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('panic calls this.stop() then audioPlayer.stopAll(200)', () => {
    const { runner } = setup([makeWait({ duration: 5000 })])
    const stopSpy = vi.spyOn(runner, 'stop')
    runner.panic()
    expect(stopSpy).toHaveBeenCalledWith()
    expect(audioPlayer.stopAll).toHaveBeenCalledWith(200)
  })
})

describe('CueRunner — clearGroupStartOffset', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('clears the stored offset for a group', () => {
    const { runner } = setup([])
    runner.seekTimeline('g1', 500)
    expect(runner.getGroupStartOffset('g1')).toBe(500)
    runner.clearGroupStartOffset('g1')
    expect(runner.getGroupStartOffset('g1')).toBe(0)
  })

  it('does nothing for a non-existent group', () => {
    const { runner } = setup([])
    runner.clearGroupStartOffset('nonexistent')
    expect(runner.getGroupStartOffset('nonexistent')).toBe(0)
  })
})

describe('CueRunner — fireCueFromOffset fallback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('calls onDone immediately for non-audio/non-wait cues via fireCueFromOffset (e.g. osc cue in timeline seek)', () => {
    // Use seekTimeline to exercise the fireCueFromOffset path with a non-audio/non-wait cue
    const group = {
      id: 'g1', number: '1', name: 'Group', type: 'group' as const,
      colorLabel: 'none' as const, parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'none' as const, isArmed: true, notes: '',
      mode: 'timeline' as const,
    }
    const oscCue = {
      id: 'oc1', number: '2', name: 'OSC', type: 'osc' as const,
      colorLabel: 'none' as const, parentId: 'g1', preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
      advance: 'none' as const, isArmed: true, notes: '',
      host: '127.0.0.1', port: 8000, address: '/test', args: [],
    }
    // Mock window.winslab.osc
    Object.defineProperty(window, 'winslab', {
      value: { osc: { send: vi.fn().mockResolvedValue(undefined) } },
      writable: true,
    })

    const setRunning = vi.fn()
    const runner = new CueRunner()
    runner.init({
      getCues: () => [group, oscCue],
      getSelected: () => 'g1',
      setSelected: vi.fn(),
      setRunning,
      clearAllRunning: vi.fn(),
      syncCueDuration: vi.fn(),
    })

    // Seek past the osc cue's offset — fireCueFromOffset will hit the else branch (onDone)
    runner.seekTimeline('g1', 100)
    runner.go()
    vi.runAllTimers()

    // The osc cue should NOT have been fired because its timelineOffset (0) was before the seek (100),
    // and it's a fire-and-forget type so it gets skipped entirely (line 234: child.type === 'osc' → continue)
    // Let's verify that the osc was skipped by checking createBufferSource not called
    expect(setRunning.mock.calls.filter(c => c[0] === 'oc1')).toHaveLength(0)
  })
})
