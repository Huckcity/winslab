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

const mockCtx = {
  state: 'running',
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  createBufferSource: vi.fn(() => ({ ...mockSource, connect: vi.fn().mockReturnThis() })),
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
