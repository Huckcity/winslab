import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import type { MidiCue, MidiMessageKind } from '../../types/cue'

interface Props { cue: MidiCue }

export function MidiInspector({ cue }: Props) {
  const update = useStore(s => s.updateCue)
  const set = (patch: Partial<MidiCue>) => update(cue.id, patch as any)

  const [ports, setPorts] = useState<string[]>([])

  useEffect(() => {
    window.winslab.midi.listPorts().then(setPorts)
  }, [])

  const addMsg = () => {
    const msg: MidiMessageKind = { kind: 'noteOn', channel: 1, note: 60, velocity: 127 }
    set({ messages: [...cue.messages, msg] })
  }

  const removeMsg = (i: number) => {
    set({ messages: cue.messages.filter((_, idx) => idx !== i) })
  }

  const updateMsg = (i: number, patch: Partial<MidiMessageKind>) => {
    const messages = cue.messages.map((m, idx) =>
      idx === i ? { ...m, ...patch } as MidiMessageKind : m
    )
    set({ messages })
  }

  return (
    <div>
      <div className="field-row">
        <label>MIDI Port</label>
        {ports.length > 0 ? (
          <select value={cue.portName} onChange={e => set({ portName: e.target.value })}>
            <option value="">— select port —</option>
            {ports.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <input
            value={cue.portName}
            placeholder="No MIDI ports found"
            onChange={e => set({ portName: e.target.value })}
          />
        )}
        <button
          onClick={() => window.winslab.midi.listPorts().then(setPorts)}
          title="Refresh ports"
          style={{ marginLeft: 4, padding: '0 6px', height: 26, background: '#2a2a2a',
            border: '1px solid #444', borderRadius: 3, color: '#888', cursor: 'pointer', fontSize: 12 }}
        >↻</button>
      </div>
      <div className="field-section-title">Messages</div>
      {cue.messages.map((msg, i) => (
        <div key={i} style={{ background: '#252525', borderRadius: 4, padding: '8px', marginBottom: 6 }}>
          <div className="field-row">
            <label>Type</label>
            <select value={msg.kind} onChange={e => updateMsg(i, { kind: e.target.value as any })}>
              <option value="noteOn">Note On</option>
              <option value="noteOff">Note Off</option>
              <option value="cc">CC</option>
              <option value="programChange">Program Change</option>
              <option value="sysex">SysEx</option>
            </select>
            <button onClick={() => removeMsg(i)} style={{ marginLeft: 4, padding: '0 6px',
              height: 26, background: '#3a2020', border: '1px solid #5a3030', borderRadius: 3,
              color: '#c0392b', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </div>
          {msg.kind !== 'sysex' && (
            <div className="field-row">
              <label>Channel</label>
              <input type="number" min={1} max={16} value={'channel' in msg ? msg.channel : 1}
                onChange={e => updateMsg(i, { channel: Number(e.target.value) } as any)} />
            </div>
          )}
          {(msg.kind === 'noteOn' || msg.kind === 'noteOff') && (
            <>
              <div className="field-row">
                <label>Note</label>
                <input type="number" min={0} max={127} value={msg.note}
                  onChange={e => updateMsg(i, { note: Number(e.target.value) })} />
              </div>
              <div className="field-row">
                <label>Velocity</label>
                <input type="number" min={0} max={127} value={msg.velocity}
                  onChange={e => updateMsg(i, { velocity: Number(e.target.value) })} />
              </div>
            </>
          )}
          {msg.kind === 'cc' && (
            <>
              <div className="field-row">
                <label>Controller</label>
                <input type="number" min={0} max={127} value={msg.controller}
                  onChange={e => updateMsg(i, { controller: Number(e.target.value) })} />
              </div>
              <div className="field-row">
                <label>Value</label>
                <input type="number" min={0} max={127} value={msg.value}
                  onChange={e => updateMsg(i, { value: Number(e.target.value) })} />
              </div>
            </>
          )}
          {msg.kind === 'programChange' && (
            <div className="field-row">
              <label>Program</label>
              <input type="number" min={0} max={127} value={msg.program}
                onChange={e => updateMsg(i, { program: Number(e.target.value) })} />
            </div>
          )}
          {msg.kind === 'sysex' && (
            <div className="field-row">
              <label>Bytes</label>
              <input
                value={(msg.data ?? []).join(' ')}
                placeholder="F0 41 10 42 12 ... F7"
                onChange={e => {
                  const data = e.target.value.split(/\s+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n))
                  updateMsg(i, { data })
                }}
              />
            </div>
          )}
        </div>
      ))}
      <button onClick={addMsg} style={{ width: '100%', height: 28, background: '#252525',
        border: '1px dashed #444', borderRadius: 3, color: '#888', cursor: 'pointer', fontSize: 12 }}>
        + Add Message
      </button>
    </div>
  )
}
