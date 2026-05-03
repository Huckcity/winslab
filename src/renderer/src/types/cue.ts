export type CueColor = 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink'
export type CueType = 'audio' | 'midi' | 'osc' | 'wait' | 'fade' | 'stop' | 'group' | 'network' | 'script'

export interface CueBase {
  id: string
  number: string
  name: string
  colorLabel: CueColor
  parentId: string | null
  preWait: number
  postWait: number
  timelineOffset: number
  duration: number
  advance: 'none' | 'on-start' | 'on-end'
  isArmed: boolean
  notes: string
}

export interface AudioOutput {
  deviceId: string
  channelPair: [number, number]
  volume: number
  pan: number
}

export interface AudioCue extends CueBase {
  type: 'audio'
  filePath: string
  startTime: number
  endTime: number | null
  fadeInDuration: number
  fadeOutDuration: number
  outputs: AudioOutput[]
  loopCount: number
}

export type MidiMessageKind =
  | { kind: 'noteOn'; channel: number; note: number; velocity: number }
  | { kind: 'noteOff'; channel: number; note: number; velocity: number }
  | { kind: 'cc'; channel: number; controller: number; value: number }
  | { kind: 'programChange'; channel: number; program: number }
  | { kind: 'sysex'; data: number[] }

export interface MidiCue extends CueBase {
  type: 'midi'
  portName: string
  messages: MidiMessageKind[]
}

export type OscArgType = 'i' | 'f' | 's' | 'T' | 'F'
export interface OscArg {
  type: OscArgType
  value: number | string | boolean
}

export interface OscCue extends CueBase {
  type: 'osc'
  host: string
  port: number
  address: string
  args: OscArg[]
}

export interface WaitCue extends CueBase {
  type: 'wait'
}

export type FadeCurve = 'linear' | 'sCurve' | 'logarithmic'

export interface FadeCue extends CueBase {
  type: 'fade'
  targetCueId: string
  fadeProperty: 'volume' | 'pan' | 'opacity'
  targetValue: number
  curve: FadeCurve
  stopTargetWhenDone: boolean
}

export interface StopCue extends CueBase {
  type: 'stop'
  targetCueId: string | 'all'
  fadeOut: boolean
  fadeOutDuration: number
}

export type GroupMode = 'playlist' | 'random' | 'sequence' | 'timeline'

export interface GroupCue extends CueBase {
  type: 'group'
  mode: GroupMode
}

export interface NetworkCue extends CueBase {
  type: 'network'
  method: 'GET' | 'POST' | 'PUT'
  url: string
  body: string
  headers: Record<string, string>
}

export interface ScriptCue extends CueBase {
  type: 'script'
  language: 'javascript'
  script: string
}

export type Cue =
  | AudioCue
  | MidiCue
  | OscCue
  | WaitCue
  | FadeCue
  | StopCue
  | GroupCue
  | NetworkCue
  | ScriptCue
