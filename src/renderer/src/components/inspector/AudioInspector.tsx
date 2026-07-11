import { useState } from 'react'
import { useStore } from '../../store'
import type { AudioCue } from '../../types/cue'
import { audioPlayer } from '../../engine/AudioPlayer'

interface Props { cue: AudioCue; tab: string }

export function AudioInspector({ cue, tab }: Props) {
  const update = useStore(s => s.updateCue)
  const set = (patch: Partial<AudioCue>) => update(cue.id, patch as any)

  const output = cue.outputs[0] ?? { volume: 1, pan: 0 }

  const setOutput = (patch: Partial<typeof output>) => {
    const outputs = [...cue.outputs]
    outputs[0] = { ...output, ...patch }
    set({ outputs })
    if ('volume' in patch) audioPlayer.setVolume(cue.id, patch.volume!)
    if ('pan' in patch) audioPlayer.setPan(cue.id, patch.pan!)
  }

  const [loading, setLoading] = useState(false)

  const pickFile = async () => {
    const path = await window.winslab.audio.pickFile()
    if (!path) return
    set({ filePath: path })
    setLoading(true)
    try {
      const arrayBuffer = await window.winslab.audio.readFile(path)
      const ctx = new AudioContext()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      ctx.close()
      set({ filePath: path, duration: Math.round(decoded.duration * 1000) })
    } catch (e) {
      console.warn('Could not decode audio for duration:', e)
    } finally {
      setLoading(false)
    }
  }

  if (tab === 'Timing') {
    const toSeconds = (ms: number) => Math.round(ms / 100) / 10  // 1 decimal
    const fromSeconds = (s: number) => Math.round(s * 1000)
    return (
      <div>
        <div className="field-row">
          <label>Start time (s)</label>
          <input type="number" min={0} step={0.1} value={toSeconds(cue.startTime)}
            onChange={e => set({ startTime: fromSeconds(Number(e.target.value)) })} />
        </div>
        <div className="field-row">
          <label>End time (s)</label>
          <input type="number" min={0} step={0.1} value={cue.endTime != null ? toSeconds(cue.endTime) : ''}
            placeholder="play to end"
            onChange={e => set({ endTime: e.target.value ? fromSeconds(Number(e.target.value)) : null })} />
        </div>
        <div className="field-row">
          <label>Fade in (s)</label>
          <input type="number" min={0} step={0.1} value={toSeconds(cue.fadeInDuration)}
            onChange={e => set({ fadeInDuration: fromSeconds(Number(e.target.value)) })} />
        </div>
        <div className="field-row">
          <label>Fade out (s)</label>
          <input type="number" min={0} step={0.1} value={toSeconds(cue.fadeOutDuration)}
            onChange={e => set({ fadeOutDuration: fromSeconds(Number(e.target.value)) })} />
        </div>
        <div className="field-row">
          <label>Loop count</label>
          <input type="number" min={-1} value={cue.loopCount}
            onChange={e => set({ loopCount: Number(e.target.value) })} />
          <span className="inspector-hint" style={{ marginTop: 0 }}>-1 = infinite</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="field-row">
        <label>File</label>
        <input value={cue.filePath} readOnly
          placeholder={loading ? 'Detecting duration…' : 'No file selected'}
          style={{ flex: 1, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
          onClick={pickFile} />
        <button onClick={pickFile} disabled={loading} className="inspector-btn">Browse</button>
      </div>
      <div className="field-section-title">Output</div>
      <div className="field-row">
        <label>Volume</label>
        <input type="range" min={0} max={1} step={0.01} value={output.volume}
          onChange={e => setOutput({ volume: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent-blue)' }} />
        <span className="inspector-readout">{Math.round(output.volume * 100)}%</span>
      </div>
      <div className="field-row">
        <label>Pan</label>
        <input type="range" min={-1} max={1} step={0.01} value={output.pan}
          onChange={e => setOutput({ pan: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent-blue)' }} />
        <span className="inspector-readout">
          {output.pan > 0 ? `R${Math.round(output.pan * 100)}` :
           output.pan < 0 ? `L${Math.round(-output.pan * 100)}` : 'C'}
        </span>
      </div>
    </div>
  )
}
