import type { Cue } from './cue'

export interface AudioSettings {
  outputDeviceId: string
  sampleRate: number
  bufferSize: number
}

export interface MidiSettings {
  outputPortName: string
  inputPortName: string
}

export interface Workspace {
  version: 1
  id: string
  name: string
  createdAt: string
  audioSettings: AudioSettings
  midiSettings: MidiSettings
  cues: Cue[]
}
