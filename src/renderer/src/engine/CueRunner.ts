import type { Cue, AudioCue, MidiCue, OscCue, WaitCue, FadeCue, StopCue, GroupCue } from '../types/cue'
import { audioPlayer } from './AudioPlayer'
import type { RunningCue } from '../store'

type SetRunning = (id: string, state: RunningCue | null) => void
type ClearAllRunning = () => void
type GetCues = () => Cue[]
type GetSelected = () => string | null
type SetSelected = (id: string | null) => void

interface RunnerDeps {
  getCues: GetCues
  getSelected: GetSelected
  setSelected: SetSelected
  setRunning: SetRunning
  clearAllRunning: ClearAllRunning
  syncCueDuration: (id: string, durationMs: number) => void
}

export class CueRunner {
  private deps: RunnerDeps | null = null
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private groupStartOffsets = new Map<string, number>()

  init(deps: RunnerDeps): void {
    this.deps = deps
  }

  go(): void {
    const { getCues, getSelected, setSelected } = this.deps!
    const cues = getCues()
    const selectedId = getSelected()

    const targetIdx = selectedId ? cues.findIndex(c => c.id === selectedId) : 0
    if (targetIdx < 0) return

    const cue = cues[targetIdx]
    if (!cue || !cue.isArmed) return

    // When the fired cue is a group, skip over its children to find the next
    // cue that should receive selection focus after GO
    const nextCue = (() => {
      if (cue.type === 'group') {
        let i = targetIdx + 1
        while (i < cues.length && cues[i].parentId === cue.id) i++
        return cues[i] ?? null
      }
      return cues[targetIdx + 1] ?? null
    })()

    // If this cue will auto-fire nextCue, skip selection past it
    const selectionTarget = cue.advance && cue.advance !== 'none'
      ? (() => {
          if (!nextCue) return null
          const nextIdx = cues.findIndex(c => c.id === nextCue.id)
          if (nextCue.type === 'group') {
            let i = nextIdx + 1
            while (i < cues.length && cues[i].parentId === nextCue.id) i++
            return cues[i] ?? null
          }
          return cues[nextIdx + 1] ?? null
        })()
      : nextCue
    setSelected(selectionTarget?.id ?? null)

    // Cancel timers if the cue is already mid-run (prevents stacking)
    // AudioPlayer.play() handles the audio-only case internally
    if (this.hasActiveTimers(cue.id)) this.stop(cue.id)

    this.fireCue(cue, () => {
      if (cue.advance === 'on-end' && nextCue) {
        this.goById(nextCue.id)
      }
    })

    if (cue.advance === 'on-start' && nextCue) {
      this.goById(nextCue.id)
    }
  }

  goById(id: string): void {
    const { getCues } = this.deps!
    const cues = getCues()
    const cue = cues.find(c => c.id === id)
    if (!cue || !cue.isArmed) return
    const idx = cues.findIndex(c => c.id === id)
    const nextCue = cues[idx + 1] ?? null
    this.fireCue(cue, () => {
      if (cue.advance === 'on-end' && nextCue) {
        this.goById(nextCue.id)
      }
    })
  }

  private fireCue(cue: Cue, onDone: () => void): void {
    const { setRunning } = this.deps!

    const run = (state: Omit<RunningCue, 'cueId'>) =>
      setRunning(cue.id, { cueId: cue.id, ...state })

    const execute = (): void => {
      run({ state: 'playing', startedAt: Date.now(), progress: 0 })
      this.execute(cue, () => {
        run({ state: 'post-wait', startedAt: Date.now(), progress: 1 })
        const t = setTimeout(() => {
          setRunning(cue.id, null)
          onDone()
        }, cue.postWait)
        this.timers.set(cue.id + ':post', t)
      })
    }

    if (cue.preWait > 0) {
      run({ state: 'pre-wait', startedAt: Date.now(), progress: 0 })
      const t = setTimeout(execute, cue.preWait)
      this.timers.set(cue.id + ':pre', t)
    } else {
      execute()
    }
  }

  private execute(cue: Cue, onDone: () => void): void {
    switch (cue.type) {
      case 'audio':
        this.executeAudio(cue as AudioCue, onDone)
        break
      case 'midi':
        this.executeMidi(cue as MidiCue, onDone)
        break
      case 'osc':
        this.executeOsc(cue as OscCue, onDone)
        break
      case 'wait':
        this.executeWait(cue as WaitCue, onDone)
        break
      case 'fade':
        this.executeFade(cue as FadeCue, onDone)
        break
      case 'stop':
        this.executeStop(cue as StopCue, onDone)
        break
      case 'group':
        this.executeGroup(cue as GroupCue, onDone)
        break
      case 'network':
        fetch(cue.url, {
          method: cue.method,
          headers: cue.headers,
          body: cue.method !== 'GET' ? cue.body : undefined
        }).finally(onDone)
        break
      case 'script':
        try { new Function(cue.script)() } catch (e) { console.error('Script cue error:', e) }
        onDone()
        break
    }
  }

  private executeAudio(cue: AudioCue, onDone: () => void): void {
    const { syncCueDuration } = this.deps!
    audioPlayer.play(cue, onDone, durationMs => syncCueDuration(cue.id, durationMs))
      .catch(err => {
        console.error('Audio playback failed:', err)
        onDone()
      })
  }

  private executeMidi(cue: MidiCue, onDone: () => void): void {
    window.winslab.midi.send({ portName: cue.portName, messages: cue.messages })
      .finally(onDone)
  }

  private executeOsc(cue: OscCue, onDone: () => void): void {
    window.winslab.osc.send({ host: cue.host, port: cue.port, address: cue.address, args: cue.args })
      .finally(onDone)
  }

  private executeWait(cue: WaitCue, onDone: () => void): void {
    const t = setTimeout(onDone, cue.duration)
    this.timers.set(cue.id, t)
  }

  private executeFade(cue: FadeCue, onDone: () => void): void {
    if (cue.fadeProperty === 'volume') {
      audioPlayer.setVolume(cue.targetCueId, cue.targetValue, cue.duration)
    } else if (cue.fadeProperty === 'pan') {
      audioPlayer.setPan(cue.targetCueId, cue.targetValue, cue.duration)
    }
    const t = setTimeout(() => {
      if (cue.stopTargetWhenDone) this.stop(cue.targetCueId)
      onDone()
    }, cue.duration)
    this.timers.set(cue.id, t)
  }

  private executeGroup(cue: GroupCue, onDone: () => void): void {
    const allCues = this.deps!.getCues()
    const children = allCues.filter(c => c.parentId === cue.id && c.isArmed)

    if (children.length === 0) { onDone(); return }

    if (cue.mode === 'timeline') {
      const startOffset = this.groupStartOffsets.get(cue.id) ?? 0
      this.groupStartOffsets.delete(cue.id)
      this.executeGroupTimeline(cue, children, onDone, startOffset)
    } else if (cue.mode === 'random') {
      this.fireCue(children[Math.floor(Math.random() * children.length)], onDone)
    } else {
      // sequence and playlist both run children in order
      this.runSequence(children, 0, onDone)
    }
  }

  private executeGroupTimeline(cue: GroupCue, children: Cue[], onDone: () => void, startOffset: number): void {
    const { setRunning } = this.deps!

    // Correct startedAt so the playhead reflects the seek position
    setRunning(cue.id, { cueId: cue.id, state: 'playing', startedAt: Date.now() - startOffset, progress: 0 })

    type Item =
      | { kind: 'schedule'; child: Cue; delay: number }
      | { kind: 'seek';     child: Cue; seekOffsetMs: number }

    const items: Item[] = []
    for (const child of children) {
      if (child.timelineOffset >= startOffset) {
        items.push({ kind: 'schedule', child, delay: child.timelineOffset - startOffset })
      } else {
        const seekOffsetMs = startOffset - child.timelineOffset
        // Skip if we know the cue has already finished
        if (child.duration > 0 && seekOffsetMs >= child.duration) continue
        // Fire-and-forget types have already happened — don't replay
        if (child.type === 'midi' || child.type === 'osc' ||
            child.type === 'network' || child.type === 'script' || child.type === 'stop') continue
        items.push({ kind: 'seek', child, seekOffsetMs })
      }
    }

    if (items.length === 0) { onDone(); return }
    let remaining = items.length

    for (const item of items) {
      if (item.kind === 'schedule') {
        const { child, delay } = item
        const t = setTimeout(() => {
          this.timers.delete(child.id + ':timeline')
          this.fireCue(child, () => { remaining--; if (remaining === 0) onDone() })
        }, delay)
        this.timers.set(child.id + ':timeline', t)
      } else {
        const { child, seekOffsetMs } = item
        this.fireCueFromOffset(child, seekOffsetMs, () => { remaining--; if (remaining === 0) onDone() })
      }
    }
  }

  private fireCueFromOffset(cue: Cue, seekOffsetMs: number, onDone: () => void): void {
    const { setRunning, syncCueDuration } = this.deps!

    if (cue.type === 'audio') {
      const audioCue = cue as AudioCue
      setRunning(cue.id, { cueId: cue.id, state: 'playing', startedAt: Date.now() - seekOffsetMs, progress: 0 })
      audioPlayer.play(
        { ...audioCue, startTime: audioCue.startTime + seekOffsetMs },
        () => { setRunning(cue.id, null); onDone() },
        durationMs => syncCueDuration(cue.id, durationMs)
      ).catch(() => { setRunning(cue.id, null); onDone() })
    } else if (cue.type === 'wait') {
      const remainingMs = Math.max(0, (cue as WaitCue).duration - seekOffsetMs)
      setRunning(cue.id, { cueId: cue.id, state: 'playing', startedAt: Date.now() - seekOffsetMs, progress: 0 })
      const t = setTimeout(() => { setRunning(cue.id, null); onDone() }, remainingMs)
      this.timers.set(cue.id, t)
    } else {
      onDone()
    }
  }

  private runSequence(cues: Cue[], index: number, onDone: () => void): void {
    if (index >= cues.length) { onDone(); return }
    this.fireCue(cues[index], () => this.runSequence(cues, index + 1, onDone))
  }

  private executeStop(cue: StopCue, onDone: () => void): void {
    if (cue.targetCueId === 'all') {
      audioPlayer.stopAll(cue.fadeOut ? cue.fadeOutDuration : 0)
    } else {
      audioPlayer.stop(cue.targetCueId, cue.fadeOut ? cue.fadeOutDuration : 0)
    }
    onDone()
  }

  getGroupStartOffset(groupId: string): number {
    return this.groupStartOffsets.get(groupId) ?? 0
  }

  clearGroupStartOffset(groupId: string): void {
    this.groupStartOffsets.delete(groupId)
  }

  seekTimeline(groupId: string, seekMs: number): void {
    this.groupStartOffsets.set(groupId, seekMs)
    const cues = this.deps!.getCues()
    const group = cues.find(c => c.id === groupId)
    if (!group || group.type !== 'group' || (group as GroupCue).mode !== 'timeline') return

    const children = cues.filter(c => c.parentId === groupId)
    const wasPlaying = children.some(c =>
      this.timers.has(c.id + ':timeline') ||
      this.timers.has(c.id + ':pre') ||
      this.timers.has(c.id) ||
      this.timers.has(c.id + ':post') ||
      audioPlayer.isPlaying(c.id)
    )
    if (wasPlaying) {
      this.stop(groupId)
      const { setRunning } = this.deps!
      const groupCue = group as GroupCue
      // groupStartOffsets already has seekMs — execute() → executeGroup() will read + consume it
      this.execute(groupCue, () => {
        setRunning(groupId, { cueId: groupId, state: 'post-wait', startedAt: Date.now(), progress: 1 })
        const t = setTimeout(() => { setRunning(groupId, null) }, groupCue.postWait)
        this.timers.set(groupId + ':post', t)
      })
    }
  }

  private hasActiveTimers(cueId: string): boolean {
    return this.timers.has(cueId + ':pre') ||
           this.timers.has(cueId + ':post') ||
           this.timers.has(cueId) ||
           this.timers.has(cueId + ':timeline')
  }

  stop(cueId?: string): void {
    const { setRunning, clearAllRunning } = this.deps!
    if (cueId) {
      // For timeline groups, cancel all pending child offset timers and stop active children
      const cues = this.deps!.getCues()
      const cue = cues.find(c => c.id === cueId)
      if (cue?.type === 'group' && cue.mode === 'timeline') {
        for (const child of cues.filter(c => c.parentId === cueId)) {
          clearTimeout(this.timers.get(child.id + ':timeline'))
          this.timers.delete(child.id + ':timeline')
          clearTimeout(this.timers.get(child.id + ':pre'))
          clearTimeout(this.timers.get(child.id + ':post'))
          clearTimeout(this.timers.get(child.id))
          audioPlayer.stop(child.id)
          setRunning(child.id, null)
        }
      }
      clearTimeout(this.timers.get(cueId + ':pre'))
      clearTimeout(this.timers.get(cueId + ':post'))
      clearTimeout(this.timers.get(cueId))
      audioPlayer.stop(cueId)
      setRunning(cueId, null)
    } else {
      for (const key of this.timers.keys()) clearTimeout(this.timers.get(key))
      this.timers.clear()
      audioPlayer.stopAll()
      clearAllRunning()
    }
  }

  panic(): void {
    this.stop()
    audioPlayer.stopAll(200)
  }
}

export const cueRunner = new CueRunner()
