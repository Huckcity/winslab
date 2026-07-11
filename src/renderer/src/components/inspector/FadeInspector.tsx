import { useStore } from '../../store'
import type { FadeCue, FadeCurve } from '../../types/cue'

interface Props { cue: FadeCue }

export function FadeInspector({ cue }: Props) {
  const update = useStore(s => s.updateCue)
  const cues = useStore(s => s.cues)
  const set = (patch: Partial<FadeCue>) => update(cue.id, patch as any)

  const otherCues = cues.filter(c => c.id !== cue.id)

  return (
    <div>
      <div className="field-row">
        <label>Target cue</label>
        <select value={cue.targetCueId} onChange={e => set({ targetCueId: e.target.value })}>
          <option value="">— select —</option>
          {otherCues.map(c => {
            const displayName = c.name.length > 20 ? c.name.slice(0, 17) + '...' : c.name
            return <option key={c.id} value={c.id}>{c.number} {displayName}</option>
          })}
        </select>
      </div>
      <div className="field-row">
        <label>Property</label>
        <select value={cue.fadeProperty} onChange={e => set({ fadeProperty: e.target.value as any })}>
          <option value="volume">Volume</option>
          <option value="pan">Pan</option>
          <option value="opacity">Opacity</option>
        </select>
      </div>
      <div className="field-row">
        <label>Target value</label>
        <input type="number" min={0} max={1} step={0.01} value={cue.targetValue}
          onChange={e => set({ targetValue: Number(e.target.value) })} />
      </div>
      <div className="field-row">
        <label>Duration (s)</label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={cue.duration / 1000}
          onChange={e => {
            const s = parseFloat(e.target.value)
            if (!isNaN(s) && s >= 0) set({ duration: Math.round(s * 1000) })
          }}
        />
      </div>
      <div className="field-row">
        <label>Curve</label>
        <select value={cue.curve} onChange={e => set({ curve: e.target.value as FadeCurve })}>
          <option value="linear">Linear</option>
          <option value="sCurve">S-Curve</option>
          <option value="logarithmic">Logarithmic</option>
        </select>
      </div>
      <div className="field-row">
        <label>Stop target when done</label>
        <input type="checkbox" checked={cue.stopTargetWhenDone}
          onChange={e => set({ stopTargetWhenDone: e.target.checked })} />
      </div>
    </div>
  )
}
