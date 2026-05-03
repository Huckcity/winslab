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

    const nextCue = cues[targetIdx + 1] ?? null

    // If this cue will auto-fire nextCue, skip selection past it so the next
    // manual Go lands on the cue after the auto-fired one
    const selectionTarget = cue.advance && cue.advance !== 'none'
      ? (cues[targetIdx + 2] ?? null)
      : nextCue
    setSelected(selectionTarget?.id ?? null)

    // Cancel timers if the cue is already mid-run (prevents stacking)
    // AudioPlayer.play() handles the audio-only case internally
    if (this.hasActiveTimers(cue.id)) this.stop(cue.id)

    this.fireCue(cue, () => {
      if (cue.advance === 'on-end' && nextCue) {
        setTimeout(() => this.goById(nextCue.id), cue.postWait)
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
        setTimeout(() => this.goById(nextCue.id), cue.postWait)
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
    }
    const t = setTimeout(() => {
      if (cue.stopTargetWhenDone) this.stop(cue.targetCueId)
      onDone()
    }, cue.duration)
    this.timers.set(cue.id, t)
  }

  private executeGroup(cue: GroupCue, onDone: () => void): void {
    const allCues = this.deps!.getCues()
    const children = cue.childIds
      .map(id => allCues.find(c => c.id === id))
      .filter((c): c is Cue => c !== undefined && c.isArmed)

    if (children.length === 0) { onDone(); return }

    if (cue.mode === 'random') {
      this.fireCue(children[Math.floor(Math.random() * children.length)], onDone)
    } else {
      // sequence and playlist both run children in order
      this.runSequence(children, 0, onDone)
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

  private hasActiveTimers(cueId: string): boolean {
    return this.timers.has(cueId + ':pre') ||
           this.timers.has(cueId + ':post') ||
           this.timers.has(cueId)
  }

  stop(cueId?: string): void {
    const { setRunning, clearAllRunning } = this.deps!
    if (cueId) {
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
