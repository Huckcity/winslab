import type {
  AudioCue, MidiCue, OscCue, WaitCue, FadeCue, StopCue, GroupCue, NetworkCue, ScriptCue, Cue, CueType
} from '../types/cue'

let _counter = 1
function nextNumber(): string {
  return String(_counter++)
}

function base(name: string): Omit<Cue, 'type'> {
  return {
    id: crypto.randomUUID(),
    number: nextNumber(),
    name,
    colorLabel: 'none',
    parentId: null,
    preWait: 0,
    postWait: 0,
    timelineOffset: 0,
    duration: 0,
    advance: 'none',
    isArmed: true,
    notes: ''
  }
}

export function createCue(type: CueType): Cue {
  switch (type) {
    case 'audio':
      return {
        ...base('Audio Cue'),
        type: 'audio',
        filePath: '',
        startTime: 0,
        endTime: null,
        fadeInDuration: 0,
        fadeOutDuration: 0,
        outputs: [{ deviceId: 'default', channelPair: [1, 2], volume: 1, pan: 0 }],
        loopCount: 0,
        playbackRate: 1.0,
        trim: 1.0
      } satisfies AudioCue
    case 'midi':
      return {
        ...base('MIDI Cue'),
        type: 'midi',
        portName: '',
        messages: []
      } satisfies MidiCue
    case 'osc':
      return {
        ...base('OSC Cue'),
        type: 'osc',
        host: '127.0.0.1',
        port: 53000,
        address: '/cue/1/start',
        args: []
      } satisfies OscCue
    case 'wait':
      return {
        ...base('Wait'),
        type: 'wait',
        duration: 2000
      } satisfies WaitCue
    case 'fade':
      return {
        ...base('Fade Cue'),
        type: 'fade',
        targetCueId: '',
        fadeProperty: 'volume',
        targetValue: 0,
        curve: 'linear',
        stopTargetWhenDone: true,
        duration: 3000
      } satisfies FadeCue
    case 'stop':
      return {
        ...base('Stop Cue'),
        type: 'stop',
        targetCueId: 'all',
        fadeOut: false,
        fadeOutDuration: 500
      } satisfies StopCue
    case 'group':
      return {
        ...base('Group'),
        type: 'group',
        mode: 'sequence',
      } satisfies GroupCue
    case 'network':
      return {
        ...base('Network Cue'),
        type: 'network',
        method: 'GET',
        url: 'http://',
        body: '',
        headers: {},
        timeout: 5000
      } satisfies NetworkCue
    case 'script':
      return {
        ...base('Script Cue'),
        type: 'script',
        language: 'javascript',
        script: ''
      } satisfies ScriptCue
  }
}

export function formatDuration(ms: number): string {
  if (ms === 0) return '–'
  const s = ms / 1000
  const min = Math.floor(s / 60)
  const sec = s % 60
  if (min > 0) return `${min}:${sec.toFixed(1).padStart(4, '0')}`
  return `${sec.toFixed(1)}s`
}
