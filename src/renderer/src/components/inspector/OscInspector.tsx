import { useStore } from '../../store'
import type { OscCue, OscArg, OscArgType } from '../../types/cue'

interface Props { cue: OscCue }

export function OscInspector({ cue }: Props) {
  const update = useStore(s => s.updateCue)
  const set = (patch: Partial<OscCue>) => update(cue.id, patch as any)

  const addArg = () => {
    const arg: OscArg = { type: 'f', value: 0 }
    set({ args: [...cue.args, arg] })
  }

  const removeArg = (i: number) => set({ args: cue.args.filter((_, idx) => idx !== i) })

  const updateArg = (i: number, patch: Partial<OscArg>) => {
    const args = cue.args.map((a, idx) => idx === i ? { ...a, ...patch } : a)
    set({ args })
  }

  return (
    <div>
      <div className="field-row">
        <label>Host</label>
        <input value={cue.host} onChange={e => set({ host: e.target.value })} />
      </div>
      <div className="field-row">
        <label>Port</label>
        <input type="number" min={1} max={65535} value={cue.port}
          onChange={e => set({ port: Number(e.target.value) })} />
      </div>
      <div className="field-row">
        <label>Address</label>
        <input value={cue.address} onChange={e => set({ address: e.target.value })} />
      </div>
      <div className="field-section-title">Arguments</div>
      {cue.args.map((arg, i) => (
        <div key={i} className="field-row">
          <label>Arg {i + 1}</label>
          <select value={arg.type}
            onChange={e => updateArg(i, { type: e.target.value as OscArgType, value: arg.type !== e.target.value ? 0 : arg.value })}
            style={{ width: 50, flex: 'none' }}>
            <option value="i">int</option>
            <option value="f">float</option>
            <option value="s">string</option>
            <option value="T">true</option>
            <option value="F">false</option>
          </select>
          {(arg.type === 'i' || arg.type === 'f') && (
            <input type="number" value={arg.value as number}
              onChange={e => updateArg(i, { value: Number(e.target.value) })} />
          )}
          {arg.type === 's' && (
            <input value={arg.value as string}
              onChange={e => updateArg(i, { value: e.target.value })} />
          )}
          {(arg.type === 'T' || arg.type === 'F') && (
            <span className="inspector-hint" style={{ flex: 1, marginTop: 0 }}>
              {arg.type === 'T' ? 'true' : 'false'}
            </span>
          )}
          <button onClick={() => removeArg(i)} className="inspector-btn-icon">✕</button>
        </div>
      ))}
      <button onClick={addArg} className="inspector-add-btn">+ Add Argument</button>
    </div>
  )
}
