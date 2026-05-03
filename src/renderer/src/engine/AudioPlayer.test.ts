import { describe, it, expect, vi, beforeEach } from 'vitest'

// AudioPlayer uses Web Audio API — mock AudioContext
const mockSetValueAtTime = vi.fn()
const mockLinearRamp = vi.fn()
const mockSetSinkId = vi.fn().mockResolvedValue(undefined)

const makeAudioParam = () => ({
  setValueAtTime: mockSetValueAtTime,
  linearRampToValueAtTime: mockLinearRamp,
})

const mockGain = { gain: makeAudioParam() }
const mockPanner = { pan: makeAudioParam() }
const mockSource = {
  buffer: null as AudioBuffer | null,
  loop: false,
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
    ...overrides
  }
}

describe('AudioPlayer.setPan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Inject an active node directly so we can test without playing
    const gain = { gain: makeAudioParam() }
    const panner = { pan: makeAudioParam() }
    ;(audioPlayer as any).active.set('a1', {
      source: { onended: null, stop: vi.fn() },
      gain,
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
    expect(mockSetValueAtTime).toHaveBeenCalledWith(-0.5, 0)
  })

  it('ramps pan when durationMs > 0', () => {
    audioPlayer.setPan('a1', 1, 500)
    expect(mockLinearRamp).toHaveBeenCalledWith(1, 0.5)
  })

  it('does nothing when cueId is not active', () => {
    audioPlayer.setPan('nonexistent', 0.5)
    expect(mockSetValueAtTime).not.toHaveBeenCalled()
    expect(mockLinearRamp).not.toHaveBeenCalled()
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
