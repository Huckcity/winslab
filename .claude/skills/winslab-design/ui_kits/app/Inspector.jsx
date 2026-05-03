// Winslab UI Kit — Inspector panel (all cue type inspectors)
// Exported to window.WinslabInspector

const { useState } = React;

const TYPE_TABS = {
  audio:   ['Basics', 'Audio', 'Timing'],
  midi:    ['Basics', 'MIDI'],
  osc:     ['Basics', 'OSC'],
  wait:    ['Basics', 'Wait'],
  fade:    ['Basics', 'Fade'],
  stop:    ['Basics'],
  group:   ['Basics', 'Group'],
  network: ['Basics', 'Network'],
  script:  ['Basics', 'Script'],
};

const COLORS = ['none','red','orange','yellow','green','blue','purple','pink'];
const COLOR_HEX = {
  none:'#444',red:'#c0392b',orange:'#e67e22',yellow:'#f1c40f',
  green:'#27ae60',blue:'#2980b9',purple:'#8e44ad',pink:'#e91e8c',
};

/* ─── Shared form primitives ─────────────────────────────── */
function FieldRow({ label, children }) {
  return (
    <div style={inspStyles.fieldRow}>
      <label style={inspStyles.label}>{label}</label>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return <div style={inspStyles.sectionTitle}>{children}</div>;
}
function TextInput({ value, onChange, placeholder, readOnly }) {
  return (
    <input value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
      readOnly={readOnly} style={inspStyles.input} />
  );
}
function NumberInput({ value, onChange, min, max, step }) {
  return (
    <input type="number" value={value} min={min} max={max} step={step || 1}
      onChange={e => onChange?.(Number(e.target.value))} style={inspStyles.input} />
  );
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange?.(e.target.value)} style={inspStyles.input}>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

/* ─── Basics tab ─────────────────────────────────────────── */
function BasicTab({ cue, update }) {
  return (
    <div>
      <FieldRow label="Number"><TextInput value={cue.number} onChange={v => update({ number: v })} /></FieldRow>
      <FieldRow label="Name"><TextInput value={cue.name} onChange={v => update({ name: v })} /></FieldRow>
      <FieldRow label="Color">
        <div style={{ display: 'flex', gap: 4 }}>
          {COLORS.map(c => (
            <button key={c} title={c} onClick={() => update({ colorLabel: c })} style={{
              width: 18, height: 18, borderRadius: 3, background: COLOR_HEX[c],
              border: cue.colorLabel === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer',
            }} />
          ))}
        </div>
      </FieldRow>
      <SectionTitle>Timing</SectionTitle>
      <FieldRow label="Pre-wait (s)">
        <NumberInput value={(cue.preWait / 1000).toFixed(1)} min={0} step={0.1}
          onChange={v => update({ preWait: Math.round(v * 1000) })} />
      </FieldRow>
      <FieldRow label="Post-wait (s)">
        <NumberInput value={(cue.postWait / 1000).toFixed(1)} min={0} step={0.1}
          onChange={v => update({ postWait: Math.round(v * 1000) })} />
      </FieldRow>
      <FieldRow label="Advance">
        <Select value={cue.advance} onChange={v => update({ advance: v })}
          options={[['none','None'],['on-start','On start'],['on-end','On end']]} />
      </FieldRow>
      <FieldRow label="Armed">
        <input type="checkbox" checked={cue.isArmed} onChange={e => update({ isArmed: e.target.checked })}
          style={{ width: 14, height: 14, accentColor: '#4a9eff' }} />
      </FieldRow>
      <SectionTitle>Notes</SectionTitle>
      <FieldRow label="">
        <textarea value={cue.notes} onChange={e => update({ notes: e.target.value })}
          style={{ ...inspStyles.input, height: 'auto', minHeight: 60, resize: 'vertical' }} />
      </FieldRow>
    </div>
  );
}

/* ─── Audio tab ──────────────────────────────────────────── */
function AudioTab({ cue, update }) {
  const output = cue.outputs?.[0] || { volume: 1, pan: 0 };
  return (
    <div>
      <FieldRow label="File">
        <input value={cue.filePath || ''} readOnly placeholder="No file selected"
          style={{ ...inspStyles.input, cursor: 'pointer', flex: 1 }} />
        <button style={inspStyles.smallBtn}>Browse</button>
      </FieldRow>
      <SectionTitle>Output</SectionTitle>
      <FieldRow label="Volume">
        <input type="range" min={0} max={1} step={0.01} value={output.volume}
          onChange={e => update({ outputs: [{ ...output, volume: +e.target.value }] })}
          style={{ flex: 1, accentColor: '#4a9eff' }} />
        <span style={{ width: 36, textAlign: 'right', fontSize: 11, color: '#888' }}>
          {Math.round(output.volume * 100)}%
        </span>
      </FieldRow>
      <FieldRow label="Pan">
        <input type="range" min={-1} max={1} step={0.01} value={output.pan}
          onChange={e => update({ outputs: [{ ...output, pan: +e.target.value }] })}
          style={{ flex: 1, accentColor: '#4a9eff' }} />
        <span style={{ width: 36, textAlign: 'right', fontSize: 11, color: '#888' }}>
          {output.pan > 0 ? `R${Math.round(output.pan * 100)}` : output.pan < 0 ? `L${Math.round(-output.pan * 100)}` : 'C'}
        </span>
      </FieldRow>
    </div>
  );
}

/* ─── Timing tab (audio) ─────────────────────────────────── */
function TimingTab({ cue, update }) {
  return (
    <div>
      <FieldRow label="Start (ms)"><NumberInput value={cue.startTime || 0} min={0} onChange={v => update({ startTime: v })} /></FieldRow>
      <FieldRow label="End (ms)"><input type="number" min={0} value={cue.endTime ?? ''} placeholder="play to end"
        onChange={e => update({ endTime: e.target.value ? +e.target.value : null })} style={inspStyles.input} /></FieldRow>
      <FieldRow label="Fade in (ms)"><NumberInput value={cue.fadeInDuration || 0} min={0} onChange={v => update({ fadeInDuration: v })} /></FieldRow>
      <FieldRow label="Fade out (ms)"><NumberInput value={cue.fadeOutDuration || 0} min={0} onChange={v => update({ fadeOutDuration: v })} /></FieldRow>
      <FieldRow label="Loop count">
        <NumberInput value={cue.loopCount ?? 0} min={-1} onChange={v => update({ loopCount: v })} />
        <span style={{ fontSize: 11, color: '#666' }}>-1 = ∞</span>
      </FieldRow>
    </div>
  );
}

/* ─── MIDI tab ───────────────────────────────────────────── */
function MidiTab({ cue, update }) {
  const addMsg = () => update({ messages: [...(cue.messages || []), { kind: 'noteOn', channel: 1, note: 60, velocity: 127 }] });
  const removeMsg = (i) => update({ messages: cue.messages.filter((_, idx) => idx !== i) });
  return (
    <div>
      <FieldRow label="MIDI Port"><TextInput value={cue.portName || ''} placeholder="No ports found" onChange={v => update({ portName: v })} /></FieldRow>
      <SectionTitle>Messages</SectionTitle>
      {(cue.messages || []).map((msg, i) => (
        <div key={i} style={{ background: '#252525', borderRadius: 4, padding: 8, marginBottom: 6 }}>
          <FieldRow label="Type">
            <Select value={msg.kind} onChange={v => { const msgs = [...cue.messages]; msgs[i] = { ...msgs[i], kind: v }; update({ messages: msgs }); }}
              options={[['noteOn','Note On'],['noteOff','Note Off'],['cc','CC'],['programChange','Program Change'],['sysex','SysEx']]} />
            <button onClick={() => removeMsg(i)} style={{ ...inspStyles.smallBtn, color: '#c0392b', background: '#3a2020', border: '1px solid #5a3030' }}>✕</button>
          </FieldRow>
        </div>
      ))}
      <button onClick={addMsg} style={{ width: '100%', height: 28, background: '#252525', border: '1px dashed #444', borderRadius: 3, color: '#888', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>+ Add Message</button>
    </div>
  );
}

/* ─── OSC tab ────────────────────────────────────────────── */
function OscTab({ cue, update }) {
  return (
    <div>
      <FieldRow label="Host"><TextInput value={cue.host || ''} onChange={v => update({ host: v })} /></FieldRow>
      <FieldRow label="Port"><NumberInput value={cue.port || 8000} min={1} max={65535} onChange={v => update({ port: v })} /></FieldRow>
      <FieldRow label="Address"><TextInput value={cue.address || '/cue'} onChange={v => update({ address: v })} /></FieldRow>
      <SectionTitle>Arguments</SectionTitle>
      {(cue.args || []).map((arg, i) => (
        <FieldRow key={i} label={`Arg ${i + 1}`}>
          <span style={{ fontSize: 11, color: '#888' }}>({arg.type}) {String(arg.value)}</span>
        </FieldRow>
      ))}
      <button style={{ width: '100%', height: 28, background: '#252525', border: '1px dashed #444', borderRadius: 3, color: '#888', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
        onClick={() => update({ args: [...(cue.args || []), { type: 'f', value: 0 }] })}>+ Add Argument</button>
    </div>
  );
}

/* ─── Fade tab ───────────────────────────────────────────── */
function FadeTab({ cue, update }) {
  return (
    <div>
      <FieldRow label="Property">
        <Select value={cue.fadeProperty || 'volume'} onChange={v => update({ fadeProperty: v })}
          options={[['volume','Volume'],['pan','Pan']]} />
      </FieldRow>
      <FieldRow label="Target value"><NumberInput value={cue.targetValue ?? 1} min={0} max={1} step={0.01} onChange={v => update({ targetValue: v })} /></FieldRow>
      <FieldRow label="Curve">
        <Select value={cue.curve || 'linear'} onChange={v => update({ curve: v })}
          options={[['linear','Linear'],['sCurve','S-Curve'],['logarithmic','Logarithmic']]} />
      </FieldRow>
    </div>
  );
}

/* ─── Group tab ──────────────────────────────────────────── */
function GroupTab({ cue, update, allCues }) {
  return (
    <div>
      <FieldRow label="Mode">
        <Select value={cue.mode || 'playlist'} onChange={v => update({ mode: v })}
          options={[['playlist','Playlist'],['random','Random'],['sequence','Sequence']]} />
      </FieldRow>
      <SectionTitle>Children ({(cue.childIds || []).length})</SectionTitle>
      {(cue.childIds || []).map(id => {
        const child = allCues.find(c => c.id === id);
        if (!child) return null;
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', background: '#252525', borderRadius: 3, marginBottom: 3, fontSize: 12 }}>
            <span style={{ color: '#888', width: 28, fontSize: 11 }}>{child.number}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</span>
          </div>
        );
      })}
      {(cue.childIds || []).length === 0 && <div style={{ color: '#555', fontSize: 12, padding: '8px 0' }}>No children assigned.</div>}
    </div>
  );
}

/* ─── Wait tab ───────────────────────────────────────────── */
function WaitTab({ cue, update }) {
  return (
    <div>
      <div style={{ padding: '16px 0', color: '#888', fontSize: 12 }}>
        Wait cues use the pre/post-wait settings from the Basics tab.
      </div>
    </div>
  );
}

/* ─── Main Inspector ─────────────────────────────────────── */
function Inspector({ store }) {
  const [activeTab, setActiveTab] = useState('Basics');
  const { cues, selectedId, updateCue } = store;
  const cue = cues.find(c => c.id === selectedId) || null;

  if (!cue) {
    return (
      <div style={{ ...inspStyles.root, justifyContent: 'center', alignItems: 'center', color: '#555', fontSize: 13 }}>
        Select a cue to inspect it.
      </div>
    );
  }

  const tabs = TYPE_TABS[cue.type] || ['Basics'];
  const tab = tabs.includes(activeTab) ? activeTab : tabs[0];
  const update = (patch) => updateCue(cue.id, patch);

  function TabContent() {
    if (tab === 'Basics') return <BasicTab cue={cue} update={update} />;
    if (tab === 'Audio') return <AudioTab cue={cue} update={update} />;
    if (tab === 'Timing') return <TimingTab cue={cue} update={update} />;
    if (tab === 'MIDI') return <MidiTab cue={cue} update={update} />;
    if (tab === 'OSC') return <OscTab cue={cue} update={update} />;
    if (tab === 'Fade') return <FadeTab cue={cue} update={update} />;
    if (tab === 'Group') return <GroupTab cue={cue} update={update} allCues={cues} />;
    if (tab === 'Wait') return <WaitTab cue={cue} update={update} />;
    return <div style={{ color: '#555', padding: 20, fontSize: 12, textAlign: 'center' }}>No settings for this tab.</div>;
  }

  return (
    <div style={inspStyles.root}>
      <div style={inspStyles.tabs}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ ...inspStyles.tab, ...(t === tab ? inspStyles.tabActive : {}) }}>
            {t}
          </button>
        ))}
      </div>
      <div style={inspStyles.body}>
        <TabContent />
      </div>
    </div>
  );
}

const inspStyles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderLeft: '1px solid #333' },
  tabs: { display: 'flex', borderBottom: '1px solid #333', flexShrink: 0 },
  tab: {
    padding: '8px 14px', background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent', color: '#666', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  tabActive: { color: '#ddd', borderBottomColor: '#4a9eff' },
  body: { flex: 1, overflowY: 'auto', padding: 12 },
  fieldRow: { display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 },
  label: { width: 90, flexShrink: 0, fontSize: 11, color: '#888', textAlign: 'right' },
  input: {
    flex: 1, background: '#2a2a2a', border: '1px solid #444', borderRadius: 3,
    color: '#ddd', fontSize: 12, padding: '4px 7px', height: 26, outline: 'none', fontFamily: 'inherit',
  },
  sectionTitle: {
    fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase',
    letterSpacing: '0.08em', margin: '16px 0 8px',
  },
  smallBtn: {
    marginLeft: 4, padding: '0 8px', height: 26, background: '#333',
    border: '1px solid #555', borderRadius: 3, color: '#ccc', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
  },
};

Object.assign(window, { WinslabInspector: Inspector });
