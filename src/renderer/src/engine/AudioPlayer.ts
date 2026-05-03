import type { AudioCue } from '../types/cue'

export interface AudioProgress {
  elapsedMs: number
  durationMs: number
  fraction: number  // 0–1
}

interface ActiveNode {
  source: AudioBufferSourceNode
  gain: GainNode
  panner: StereoPannerNode
  startContextTime: number  // AudioContext.currentTime when source.start() was called
  startOffset: number       // offset into file in seconds (cue.startTime / 1000)
  bufferDuration: number    // total file duration in seconds
  cue: AudioCue
  onEnd: (() => void) | undefined
}

class AudioPlayer {
  private ctx: AudioContext | null = null
  private cache = new Map<string, AudioBuffer>()
  private active = new Map<string, ActiveNode>()

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  async load(filePath: string): Promise<AudioBuffer> {
    if (this.cache.has(filePath)) return this.cache.get(filePath)!
    const buffer = await window.winslab.audio.readFile(filePath)
    const decoded = await this.getCtx().decodeAudioData(buffer)
    if (this.cache.size > 100) {
      const first = this.cache.keys().next().value
      if (first) this.cache.delete(first)
    }
    this.cache.set(filePath, decoded)
    return decoded
  }

  getBuffer(filePath: string): AudioBuffer | null {
    return this.cache.get(filePath) ?? null
  }

  async play(cue: AudioCue, onEnd?: () => void, onDurationKnown?: (durationMs: number) => void): Promise<void> {
    if (!cue.filePath) { onEnd?.(); return }
    if (this.active.has(cue.id)) this.stop(cue.id)
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    const buffer = await this.load(cue.filePath)
    onDurationKnown?.(Math.round(buffer.duration * 1000))
    const output = cue.outputs[0] ?? { volume: 1, pan: 0 }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(cue.fadeInDuration > 0 ? 0 : output.volume, ctx.currentTime)
    if (cue.fadeInDuration > 0) {
      gain.gain.linearRampToValueAtTime(output.volume, ctx.currentTime + cue.fadeInDuration / 1000)
    }

    const panner = ctx.createStereoPanner()
    panner.pan.setValueAtTime(output.pan, ctx.currentTime)

    source.connect(gain).connect(panner).connect(ctx.destination)

    const startOffset = cue.startTime / 1000
    const playDuration = cue.endTime != null ? (cue.endTime - cue.startTime) / 1000 : undefined
    if (cue.loopCount !== 0) source.loop = true

    const startContextTime = ctx.currentTime
    source.start(0, startOffset, playDuration)

    const node: ActiveNode = {
      source, gain, panner,
      startContextTime,
      startOffset,
      bufferDuration: buffer.duration,
      cue,
      onEnd
    }

    source.onended = () => {
      this.active.delete(cue.id)
      onEnd?.()
    }

    this.active.set(cue.id, node)
  }

  async seek(cueId: string, timeSeconds: number): Promise<void> {
    const node = this.active.get(cueId)
    if (!node || !this.ctx) return
    const { cue, onEnd } = node

    // Detach the onended callback so it doesn't fire as a natural end
    node.source.onended = null
    try { node.source.stop() } catch { /* already stopped */ }
    this.active.delete(cueId)

    const clampedTime = Math.max(0, Math.min(timeSeconds, node.bufferDuration))
    await this.play({ ...cue, startTime: clampedTime * 1000 }, onEnd)
  }

  getProgress(cueId: string): AudioProgress | null {
    const node = this.active.get(cueId)
    if (!node || !this.ctx) return null
    const elapsed = (this.ctx.currentTime - node.startContextTime) + node.startOffset
    const duration = node.bufferDuration
    return {
      elapsedMs: elapsed * 1000,
      durationMs: duration * 1000,
      fraction: Math.min(elapsed / duration, 1)
    }
  }

  stop(cueId: string, fadeMs = 0): void {
    const node = this.active.get(cueId)
    if (!node) return
    const ctx = this.getCtx()
    node.source.onended = null  // prevent spurious onEnd callbacks
    if (fadeMs > 0) {
      node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000)
      setTimeout(() => { try { node.source.stop() } catch { /* ok */ } }, fadeMs)
    } else {
      try { node.source.stop() } catch { /* ok */ }
    }
    this.active.delete(cueId)
  }

  stopAll(fadeMs = 0): void {
    for (const id of [...this.active.keys()]) this.stop(id, fadeMs)
  }

  setVolume(cueId: string, volume: number, durationMs = 0): void {
    const node = this.active.get(cueId)
    if (!node) return
    const ctx = this.getCtx()
    if (durationMs > 0) {
      node.gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + durationMs / 1000)
    } else {
      node.gain.gain.setValueAtTime(volume, ctx.currentTime)
    }
  }

  isPlaying(cueId: string): boolean {
    return this.active.has(cueId)
  }
}

export const audioPlayer = new AudioPlayer()
