import { describe, it, expect } from 'vitest'
import { createCue, formatDuration } from './cueDefaults'
import type { CueType } from '../types/cue'

describe('createCue', () => {
  const types: CueType[] = ['audio', 'midi', 'osc', 'wait', 'fade', 'stop', 'group', 'network', 'script']

  it.each(types)('creates a %s cue with correct type', (type) => {
    expect(createCue(type).type).toBe(type)
  })

  it.each(types)('creates a %s cue with a unique UUID id', (type) => {
    const a = createCue(type)
    const b = createCue(type)
    expect(a.id).not.toBe(b.id)
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it.each(types)('%s cue is armed by default', (type) => {
    expect(createCue(type).isArmed).toBe(true)
  })

  it.each(types)('%s cue has zero pre/post-wait by default', (type) => {
    const cue = createCue(type)
    expect(cue.preWait).toBe(0)
    expect(cue.postWait).toBe(0)
  })

  it('audio cue has a default output', () => {
    const cue = createCue('audio')
    if (cue.type !== 'audio') throw new Error('wrong type')
    expect(cue.outputs).toHaveLength(1)
    expect(cue.outputs[0].volume).toBe(1)
    expect(cue.outputs[0].pan).toBe(0)
    expect(cue.playbackRate).toBe(1.0)
    expect(cue.trim).toBe(1.0)
  })

  it('osc cue defaults to localhost port 53000', () => {
    const cue = createCue('osc')
    if (cue.type !== 'osc') throw new Error('wrong type')
    expect(cue.host).toBe('127.0.0.1')
    expect(cue.port).toBe(53000)
  })

  it('wait cue has non-zero default duration', () => {
    const cue = createCue('wait')
    if (cue.type !== 'wait') throw new Error('wrong type')
    expect(cue.duration).toBeGreaterThan(0)
  })

  it('fade cue defaults to 3 second duration', () => {
    const cue = createCue('fade')
    if (cue.type !== 'fade') throw new Error('wrong type')
    expect(cue.duration).toBe(3000)
  })

  it('group cue defaults to sequence mode with no parent', () => {
    const cue = createCue('group')
    if (cue.type !== 'group') throw new Error('wrong type')
    expect(cue.mode).toBe('sequence')
    expect(cue.parentId).toBeNull()
  })

  it.each(['audio', 'midi', 'osc', 'wait', 'fade', 'stop', 'group', 'network', 'script'] as CueType[])(
    '%s cue has parentId null by default', (type) => {
      expect(createCue(type).parentId).toBeNull()
    }
  )
})

describe('formatDuration', () => {
  it('returns em dash for zero', () => {
    expect(formatDuration(0)).toBe('–')
  })

  it('formats sub-minute durations as seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(500)).toBe('0.5s')
    expect(formatDuration(30000)).toBe('30.0s')
  })

  it('formats minute+ durations with m:ss.s', () => {
    expect(formatDuration(60000)).toBe('1:00.0')
    expect(formatDuration(90500)).toBe('1:30.5')
    expect(formatDuration(125000)).toBe('2:05.0')
  })
})
