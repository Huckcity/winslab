import { useStore } from '../../store'
import type { Cue, CueColor } from '../../types/cue'

const COLORS: CueColor[] = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']
const COLOR_HEX: Record<CueColor, string> = {
  none: '#444', red: '#c0392b', orange: '#e67e22', yellow: '#f1c40f',
  green: '#27ae60', blue: '#2980b9', purple: '#8e44ad', pink: '#e91e8c'
}

interface Props { cue: Cue }

export function BasicTab({ cue }: Props) {
  const update = useStore(s => s.updateCue)
  const set = (patch: Partial<Cue>) => update(cue.id, patch)

  return (
    <div>
      <div className="field-row">
        <label>Number</label>
        <input value={cue.number} onChange={e => set({ number: e.target.value })} />
      </div>
      <div className="field-row">
        <label>Name</label>
        <input value={cue.name} onChange={e => set({ name: e.target.value })} />
      </div>
      <div className="field-row">
        <label>Color</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {COLORS.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => set({ colorLabel: c })}
              style={{
                width: 18, height: 18, borderRadius: 3,
                background: COLOR_HEX[c],
                border: cue.colorLabel === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      </div>
      <div className="field-section-title">Timing</div>
      <div className="field-row">
        <label>Pre-wait (s)</label>
        <input type="number" min={0} step={0.1} value={cue.preWait / 1000}
          onChange={e => {
            const s = parseFloat(e.target.value)
            if (!isNaN(s) && s >= 0) set({ preWait: Math.round(s * 1000) })
          }} />
      </div>
      <div className="field-row">
        <label>Post-wait (s)</label>
        <input type="number" min={0} step={0.1} value={cue.postWait / 1000}
          onChange={e => {
            const s = parseFloat(e.target.value)
            if (!isNaN(s) && s >= 0) set({ postWait: Math.round(s * 1000) })
          }} />
      </div>
      <div className="field-row">
        <label>Advance</label>
        <select value={cue.advance ?? 'none'} onChange={e => set({ advance: e.target.value as Cue['advance'] })}>
          <option value="none">None</option>
          <option value="on-start">On start</option>
          <option value="on-end">On end</option>
        </select>
      </div>
      <div className="field-row">
        <label>Armed</label>
        <input type="checkbox" checked={cue.isArmed}
          onChange={e => set({ isArmed: e.target.checked })} />
      </div>
      <div className="field-section-title">Notes</div>
      <div className="field-row">
        <label></label>
        <textarea value={cue.notes} onChange={e => set({ notes: e.target.value })} rows={3} />
      </div>
    </div>
  )
}
