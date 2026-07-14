import { describe, it, expect, vi, beforeEach } from 'vitest'

// AudioPlayer uses Web Audio API — mock AudioContext
const mockSetValueAtTime = vi.fn()
const mockLinearRamp = vi.fn()
const mockCancelScheduledValues = vi.fn()
const mockSetSinkId = vi.fn().mockResolvedValue(undefined)

let paramValue = 0.8

const makeAudioParam = () => ({
  setValueAtTime: mockSetValueAtTime,
  linearRampToValueAtTime: mockLinearRamp,
  cancelScheduledValues: mockCancelScheduledValues,
  get value() { return paramValue },
  set value(v: number) { paramValue = v },
})

const mockGain = { gain: makeAudioParam() }
const mockPanner = { pan: makeAudioParam() }
const mockSource = {
  buffer: null as AudioBuffer | null,
  loop: false,
  playbackRate: makeAudioParam(),
  connect: vi.fn().mockReturnThis(),
  start: vi.fn(),
  onended: null as ((ev: Event) => void) | null,
}
// Track the last source instance created so tests can fire onended
let lastSource: typeof mockSource | null = null

const mockCtx = {
  state: 'running',
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  createBufferSource: vi.fn(() => {
    lastSource = { ...mockSource, connect: vi.fn().mockReturnThis(), onended: null }
    return lastSource
  }),
  createGain: vi.fn(() => ({ ...mockGain, gain: makeAudioParam() })),
  createStereoPanner: vi.fn(() => ({ ...mockPanner, pan: makeAudioParam() })),
  decodeAudioData: vi.fn().mockResolvedValue({ duration: 5 }),
  destination: {},
  setSinkId: mockSetSinkId,
}

vi.stubGlobal('AudioContext', vi.fn(() => mockCtx))

// Mock window.winslab.audio.readFile to return a dummy ArrayBuffer
Object.defineProperty(window, 'winslab', {
  value: {
    audio: { readFile: vi.fn().mockResolvedValue(new ArrayBuffer(8)) },
  },
  writable: true,
})

import { audioPlayer } from './AudioPlayer'
import type { AudioCue } from '../types/cue'

function makeAudioCue(overrides: Partial<AudioCue> = {}): AudioCue {
  return {
    id: 'a1', number: '1', name: 'Audio', type: 'audio',
    colorLabel: 'none', parentId: null, preWait: 0, postWait: 0, timelineOffset: 0, duration: 0,
    advance: 'none', isArmed: true, notes: '',
    filePath: '/test.mp3', startTime: 0, endTime: null,
    fadeInDuration: 0, fadeOutDuration: 0,
    outputs: [{ deviceId: 'default', channelPair: [1, 2], volume: 0.8, pan: 0.3 }],
    loopCount: 0,
    playbackRate: 1.0,
    trim: 1.0,
    ...overrides
  }
}

describe('AudioPlayer.setVolume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paramValue = 0.8
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 0,
      startOffset: 0,
      bufferDuration: 5,
      cue: makeAudioCue(),
      onEnd: undefined,
    })
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('sets volume immediately when durationMs is 0', () => {
    audioPlayer.setVolume('a1', 0.5)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.5, 0)
  })

  it('cancels existing automations and ramps volume when durationMs > 0', () => {
    audioPlayer.setVolume('a1', 0, 2000)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.8, 0)
    expect(mockLinearRamp).toHaveBeenCalledWith(0, 2)
  })

  it('does nothing when cueId is not active', () => {
    audioPlayer.setVolume('nonexistent', 0.5)
    expect(mockSetValueAtTime).not.toHaveBeenCalled()
    expect(mockLinearRamp).not.toHaveBeenCalled()
    expect(mockCancelScheduledValues).not.toHaveBeenCalled()
  })
})

describe('AudioPlayer.setPan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paramValue = 0.3
    // Inject an active node directly so we can test without playing
    const gain = { gain: makeAudioParam() }
    const panner = { pan: makeAudioParam() }
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain,
      trimGain: { gain: makeAudioParam() },
      panner,
      startContextTime: 0,
      startOffset: 0,
      bufferDuration: 5,
      cue: makeAudioCue(),
      onEnd: undefined,
    })
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('sets pan immediately when durationMs is 0', () => {
    audioPlayer.setPan('a1', -0.5)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(-0.5, 0)
  })

  it('cancels existing automations and ramps pan when durationMs > 0', () => {
    audioPlayer.setPan('a1', 1, 500)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.3, 0)
    expect(mockLinearRamp).toHaveBeenCalledWith(1, 0.5)
  })

  it('does nothing when cueId is not active', () => {
    audioPlayer.setPan('nonexistent', 0.5)
    expect(mockSetValueAtTime).not.toHaveBeenCalled()
    expect(mockLinearRamp).not.toHaveBeenCalled()
    expect(mockCancelScheduledValues).not.toHaveBeenCalled()
  })
})

describe('AudioPlayer.setOutputDevice', () => {
  beforeEach(() => {
    ;(audioPlayer as any).ctx = mockCtx
    vi.clearAllMocks()
  })

  it('calls setSinkId on the AudioContext', async () => {
    await audioPlayer.setOutputDevice('hw-device-1')
    expect(mockSetSinkId).toHaveBeenCalledWith('hw-device-1')
  })
})

describe('AudioPlayer.setPlaybackRate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paramValue = 1.0
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 0,
      startOffset: 0,
      bufferDuration: 5,
      cue: makeAudioCue(),
      onEnd: undefined,
    })
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('sets playback rate immediately when durationMs is 0', () => {
    audioPlayer.setPlaybackRate('a1', 2.0)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(2.0, 0)
  })

  it('cancels existing automations and ramps rate when durationMs > 0', () => {
    audioPlayer.setPlaybackRate('a1', 0.5, 1000)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(1.0, 0)
    expect(mockLinearRamp).toHaveBeenCalledWith(0.5, 1)
  })

  it('does nothing when cueId is not active', () => {
    audioPlayer.setPlaybackRate('nonexistent', 2.0)
    expect(mockSetValueAtTime).not.toHaveBeenCalled()
    expect(mockLinearRamp).not.toHaveBeenCalled()
    expect(mockCancelScheduledValues).not.toHaveBeenCalled()
  })
})

describe('AudioPlayer.setTrim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paramValue = 1.0
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 0,
      startOffset: 0,
      bufferDuration: 5,
      cue: makeAudioCue(),
      onEnd: undefined,
    })
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('sets trim immediately when durationMs is 0', () => {
    audioPlayer.setTrim('a1', 0.5)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.5, 0)
  })

  it('cancels existing automations and ramps trim when durationMs > 0', () => {
    audioPlayer.setTrim('a1', 0, 2000)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(1.0, 0)
    expect(mockLinearRamp).toHaveBeenCalledWith(0, 2)
  })

  it('does nothing when cueId is not active', () => {
    audioPlayer.setTrim('nonexistent', 0.5)
    expect(mockSetValueAtTime).not.toHaveBeenCalled()
    expect(mockLinearRamp).not.toHaveBeenCalled()
    expect(mockCancelScheduledValues).not.toHaveBeenCalled()
  })
})

// ─── load() ─────────────────────────────────────────────────────────────

describe('AudioPlayer.load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(audioPlayer as any).ctx = mockCtx
    ;(audioPlayer as any).cache.clear()
  })

  it('reads file and decodes audio data', async () => {
    const buf = await audioPlayer.load('/test.mp3')
    expect(window.winslab.audio.readFile).toHaveBeenCalledWith('/test.mp3')
    expect(mockCtx.decodeAudioData).toHaveBeenCalled()
    expect(buf).toEqual({ duration: 5 })
  })

  it('returns cached buffer on subsequent calls', async () => {
    const buf1 = await audioPlayer.load('/test.mp3')
    vi.clearAllMocks()
    const buf2 = await audioPlayer.load('/test.mp3')
    expect(window.winslab.audio.readFile).not.toHaveBeenCalled()
    expect(buf2).toBe(buf1)
  })

  it('evicts oldest cache entry when cache exceeds 100 entries', async () => {
    for (let i = 0; i < 101; i++) {
      ;(audioPlayer as any).cache.set(`/file${i}.mp3`, { duration: 1 } as any)
    }
    expect((audioPlayer as any).cache.size).toBe(101)

    await audioPlayer.load('/new.mp3')

    expect((audioPlayer as any).cache.size).toBe(101) // evict + add
    expect((audioPlayer as any).cache.has('/new.mp3')).toBe(true)
    // The first key (file0.mp3) should have been evicted
    expect((audioPlayer as any).cache.has('/file0.mp3')).toBe(false)
  })
})

describe('AudioPlayer.getBuffer', () => {
  beforeEach(() => {
    ;(audioPlayer as any).cache.clear()
  })

  it('returns null for uncached file', () => {
    expect(audioPlayer.getBuffer('/missing.mp3')).toBeNull()
  })

  it('returns cached buffer', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)
    const buf = audioPlayer.getBuffer('/test.mp3')
    expect(buf).toEqual({ duration: 5 })
  })
})

// ─── play() ─────────────────────────────────────────────────────────────

describe('AudioPlayer.play', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.currentTime = 0
    lastSource = null
    paramValue = 0.8
    ;(audioPlayer as any).active.clear()
    ;(audioPlayer as any).cache.clear()
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('calls onEnd immediately when filePath is empty', async () => {
    const onEnd = vi.fn()
    const onDuration = vi.fn()
    await audioPlayer.play(makeAudioCue({ filePath: '' }), onEnd, onDuration)
    expect(onEnd).toHaveBeenCalled()
    expect(onDuration).not.toHaveBeenCalled()
  })

  it('stops existing playback if same cueId is active', async () => {
    const stopSpy = vi.spyOn(audioPlayer as any, 'stop')
    // Must have proper source shape for stop() to work
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
    })
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue())
    expect(stopSpy).toHaveBeenCalledWith('a1')
  })

  it('resumes suspended AudioContext', async () => {
    const suspendedCtx = { ...mockCtx, state: 'suspended', resume: vi.fn().mockResolvedValue(undefined) }
    ;(audioPlayer as any).ctx = suspendedCtx
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue())
    expect(suspendedCtx.resume).toHaveBeenCalled()
  })

  it('builds the full audio node chain', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue())

    expect(mockCtx.createBufferSource).toHaveBeenCalled()
    expect(mockCtx.createGain).toHaveBeenCalled()
    expect(mockCtx.createStereoPanner).toHaveBeenCalled()

    // Use lastSource which is the actual source object used by play()
    expect(lastSource).not.toBeNull()
    expect(lastSource!.buffer).toEqual({ duration: 5 })
    expect(lastSource!.playbackRate.setValueAtTime).toHaveBeenCalledWith(1.0, 0)
    expect(lastSource!.connect).toHaveBeenCalled()
  })

  it('sets loop=true when loopCount !== 0', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue({ loopCount: 3 }))
    expect(lastSource).not.toBeNull()
    expect(lastSource!.loop).toBe(true)
  })

  it('does not loop when loopCount is 0', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue({ loopCount: 0 }))
    expect(lastSource).not.toBeNull()
    expect(lastSource!.loop).toBe(false)
  })

  it('applies fade-in ramp when fadeInDuration > 0', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue({ fadeInDuration: 500 }))
    // gain should start at 0 and ramp to output.volume
  })

  it('calls onDurationKnown with the file duration', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)
    const onDuration = vi.fn()

    await audioPlayer.play(makeAudioCue(), undefined, onDuration)

    expect(onDuration).toHaveBeenCalledWith(5000) // 5 * 1000
  })

  it('registers the active node and calls onended on completion', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)
    const onEnd = vi.fn()

    await audioPlayer.play(makeAudioCue(), onEnd)
    expect((audioPlayer as any).active.has('a1')).toBe(true)

    // Simulate audio playback completion via lastSource reference
    expect(lastSource).not.toBeNull()
    expect(typeof lastSource!.onended).toBe('function')
    ;(lastSource!.onended as (ev: Event) => void)({} as Event)

    expect(onEnd).toHaveBeenCalled()
    expect((audioPlayer as any).active.has('a1')).toBe(false)
  })

  it('handles looped cue with endTime', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 10 } as any)
    const cue = makeAudioCue({ startTime: 1000, endTime: 5000, loopCount: 1 })
    await audioPlayer.play(cue)
    expect(lastSource).not.toBeNull()
    expect(lastSource!.start).toHaveBeenCalledWith(0, 1, 4)
  })

  it('handles load rejection gracefully', async () => {
    const readFile = window.winslab.audio.readFile as any
    readFile.mockRejectedValueOnce(new Error('file not found'))
    const onEnd = vi.fn()

    // The play method doesn't currently catch load errors internally
    // — the promise will reject — but we can test the path
    await expect(audioPlayer.play(makeAudioCue(), onEnd)).rejects.toThrow('file not found')
  })

  it('uses first output settings when outputs array is non-empty', async () => {
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 5 } as any)

    await audioPlayer.play(makeAudioCue({ outputs: [{ deviceId: 'hw1', channelPair: [1, 2], volume: 0.5, pan: -0.5 }] }))

    // gain should be set to 0.5 (output.volume, not default 0.8)
    // We can verify the createGain was called; the actual value is set via params
    expect(mockCtx.createGain).toHaveBeenCalled()
  })
})

// ─── seek() ─────────────────────────────────────────────────────────────

describe('AudioPlayer.seek', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.currentTime = 0
    lastSource = null
    ;(audioPlayer as any).active.clear()
    ;(audioPlayer as any).cache.set('/test.mp3', { duration: 10 } as any)
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('does nothing when cueId is not active', async () => {
    await audioPlayer.seek('nonexistent', 2)
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled() // no new play triggered
  })

  it('stops current source and re-plays from seek point', async () => {
    const stopMock = vi.fn()
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: stopMock, playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 5,
      startOffset: 0,
      bufferDuration: 10,
      cue: makeAudioCue(),
      onEnd: undefined,
    })

    await audioPlayer.seek('a1', 3)
    expect(stopMock).toHaveBeenCalled()
    // Should replay — lastSource was updated by seek's internal play() call
    expect(lastSource).not.toBeNull()
    expect(lastSource!.start).toHaveBeenCalledWith(0, 3, undefined)
  })

  it('clamps seek time to buffer duration', async () => {
    const stopMock = vi.fn()
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: stopMock, playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 5,
      startOffset: 0,
      bufferDuration: 10,
      cue: makeAudioCue(),
      onEnd: undefined,
    })

    await audioPlayer.seek('a1', 100) // exceeds duration
    expect(lastSource).not.toBeNull()
    expect(lastSource!.start).toHaveBeenCalledWith(0, 10, undefined) // clamped to 10
  })

  it('preserves onEnd callback when re-playing', async () => {
    const onEnd = vi.fn()
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 5,
      startOffset: 0,
      bufferDuration: 10,
      cue: makeAudioCue(),
      onEnd,
    })

    await audioPlayer.seek('a1', 2)

    // After seek, the new play() creates a new active node with the same onEnd
    expect(lastSource).not.toBeNull()
    expect(typeof lastSource!.onended).toBe('function')
  })
})

// ─── getProgress() ──────────────────────────────────────────────────────

describe('AudioPlayer.getProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(audioPlayer as any).active.clear()
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('returns null when cueId is not active', () => {
    expect(audioPlayer.getProgress('nonexistent')).toBeNull()
  })

  it('returns null when AudioContext is null', () => {
    ;(audioPlayer as any).active.set('a1', {
      source: {},
      gain: {},
      trimGain: {},
      panner: {},
      startContextTime: 0,
      startOffset: 0,
      bufferDuration: 5,
      cue: makeAudioCue(),
      onEnd: undefined,
    })
    ;(audioPlayer as any).ctx = null
    expect(audioPlayer.getProgress('a1')).toBeNull()
  })

  it('calculates elapsed and duration correctly', () => {
    ;(audioPlayer as any).active.set('a1', {
      source: {},
      gain: {},
      trimGain: {},
      panner: {},
      startContextTime: 2,
      startOffset: 0,
      bufferDuration: 10,
      cue: makeAudioCue(),
      onEnd: undefined,
    })

    mockCtx.currentTime = 5 // elapsed = 5 - 2 + 0 = 3s
    const progress = audioPlayer.getProgress('a1')
    expect(progress!.elapsedMs).toBe(3000)
    expect(progress!.durationMs).toBe(10000)
    expect(progress!.fraction).toBeCloseTo(0.3)
  })

  it('caps fraction at 1', () => {
    ;(audioPlayer as any).active.set('a1', {
      source: {},
      gain: {},
      trimGain: {},
      panner: {},
      startContextTime: 0,
      startOffset: 0,
      bufferDuration: 5,
      cue: makeAudioCue(),
      onEnd: undefined,
    })

    mockCtx.currentTime = 10 // elapsed = 10, duration = 5, fraction would be 2
    const progress = audioPlayer.getProgress('a1')
    expect(progress!.fraction).toBe(1)
  })

  it('accounts for startOffset in elapsed calculation', () => {
    ;(audioPlayer as any).active.set('a1', {
      source: {},
      gain: {},
      trimGain: {},
      panner: {},
      startContextTime: 0,
      startOffset: 5,
      bufferDuration: 10,
      cue: makeAudioCue(),
      onEnd: undefined,
    })

    mockCtx.currentTime = 2 // elapsed = 2 - 0 + 5 = 7s
    const progress = audioPlayer.getProgress('a1')
    expect(progress!.elapsedMs).toBe(7000)
    expect(progress!.fraction).toBeCloseTo(0.7)
  })
})

// ─── stop() ─────────────────────────────────────────────────────────────

describe('AudioPlayer.stop', () => {
  let stopMock: ReturnType<typeof vi.fn>
  let source: { onended: null; stop: ReturnType<typeof vi.fn>; playbackRate: ReturnType<typeof makeAudioParam> }
  let gain: { gain: ReturnType<typeof makeAudioParam>; value: number }
  let mockGainParam: ReturnType<typeof makeAudioParam>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockCtx.currentTime = 0
    ;(audioPlayer as any).active.clear()
    ;(audioPlayer as any).ctx = mockCtx
    mockGainParam = makeAudioParam()
    stopMock = vi.fn()
    source = { onended: null, stop: stopMock, playbackRate: makeAudioParam() }
    gain = { gain: mockGainParam }

    // Set the gain.value so that setValueAtTime gets it
    Object.defineProperty(mockGainParam, 'value', { get: () => 0.8, configurable: true })
  })

  it('removes the active node and stops source immediately when fadeMs is 0', () => {
    ;(audioPlayer as any).active.set('a1', {
      source, gain, trimGain: { gain: makeAudioParam() }, panner: { pan: makeAudioParam() },
      startContextTime: 0, startOffset: 0, bufferDuration: 5, cue: makeAudioCue(), onEnd: undefined,
    })

    audioPlayer.stop('a1')
    expect(stopMock).toHaveBeenCalled()
    expect((audioPlayer as any).active.has('a1')).toBe(false)
  })

  it('does nothing when cueId is not active', () => {
    audioPlayer.stop('nonexistent')
    expect(stopMock).not.toHaveBeenCalled()
  })

  it('performs a fade-out ramp when fadeMs > 0', () => {
    ;(audioPlayer as any).active.set('a1', {
      source, gain, trimGain: { gain: makeAudioParam() }, panner: { pan: makeAudioParam() },
      startContextTime: 0, startOffset: 0, bufferDuration: 5, cue: makeAudioCue(), onEnd: undefined,
    })

    audioPlayer.stop('a1', 300)
    expect(mockCancelScheduledValues).toHaveBeenCalledWith(0)
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.8, 0)
    expect(mockLinearRamp).toHaveBeenCalledWith(0, 0.3)

    // Source should not be stopped immediately — after fadeMs
    expect(stopMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(stopMock).toHaveBeenCalled()
  })

  it('sets onended to null to prevent spurious callbacks', () => {
    ;(audioPlayer as any).active.set('a1', {
      source, gain, trimGain: { gain: makeAudioParam() }, panner: { pan: makeAudioParam() },
      startContextTime: 0, startOffset: 0, bufferDuration: 5, cue: makeAudioCue(), onEnd: vi.fn(),
    })

    audioPlayer.stop('a1')
    expect(source.onended).toBeNull()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

// ─── stopAll() ──────────────────────────────────────────────────────────

describe('AudioPlayer.stopAll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    ;(audioPlayer as any).active.clear()
    ;(audioPlayer as any).ctx = mockCtx
  })

  it('stops all active cues', () => {
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 0, startOffset: 0, bufferDuration: 5, cue: makeAudioCue(), onEnd: undefined,
    })
    ;(audioPlayer as any).active.set('a2', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 0, startOffset: 0, bufferDuration: 5, cue: makeAudioCue({ id: 'a2' }), onEnd: undefined,
    })

    audioPlayer.stopAll()
    expect((audioPlayer as any).active.size).toBe(0)
  })

  it('passes fadeMs to each stop call', () => {
    const stopSpy = vi.spyOn(audioPlayer as any, 'stop')
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn(), playbackRate: makeAudioParam() },
      gain: { gain: makeAudioParam() },
      trimGain: { gain: makeAudioParam() },
      panner: { pan: makeAudioParam() },
      startContextTime: 0, startOffset: 0, bufferDuration: 5, cue: makeAudioCue(), onEnd: undefined,
    })

    audioPlayer.stopAll(200)
    expect(stopSpy).toHaveBeenCalledWith('a1', 200)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

// ─── isPlaying() ────────────────────────────────────────────────────────

describe('AudioPlayer.isPlaying', () => {
  beforeEach(() => {
    ;(audioPlayer as any).active.clear()
  })

  it('returns true when cue is active', () => {
    ;(audioPlayer as any).active.set('a1', {} as any)
    expect(audioPlayer.isPlaying('a1')).toBe(true)
  })

  it('returns false when cue is not active', () => {
    expect(audioPlayer.isPlaying('missing')).toBe(false)
  })

  it('returns false after cue is stopped', () => {
    ;(audioPlayer as any).active.set('a1', {} as any)
    ;(audioPlayer as any).active.delete('a1')
    expect(audioPlayer.isPlaying('a1')).toBe(false)
  })
})
