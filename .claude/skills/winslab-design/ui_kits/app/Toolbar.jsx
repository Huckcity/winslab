// Winslab UI Kit — Toolbar component (updated)
// Primary cues: Audio, Group, Fade, Wait, Stop
// Secondary (More ▾): MIDI, OSC, Network, Script
// Exported to window.WinslabToolbar

const { useState, useEffect, useRef } = React;

const PRIMARY_CUES = [
  { type: 'audio',  icon: '♪', label: 'Audio' },
  { type: 'group',  icon: '▤', label: 'Group' },
  { type: 'fade',   icon: '↘', label: 'Fade'  },
  { type: 'wait',   icon: '⏱', label: 'Wait'  },
  { type: 'stop',   icon: '■', label: 'Stop'  },
];

const MORE_CUES = [
  { type: 'midi',    icon: 'M',    label: 'MIDI'    },
  { type: 'osc',     icon: 'O',    label: 'OSC'     },
  { type: 'network', icon: '⊕',   label: 'Network' },
  { type: 'script',  icon: '{ }', label: 'Script'  },
];

function Toolbar({ store }) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen]   = useState(false);
  const [editingName,  setEditingName]    = useState(false);
  const fileMenuRef = useRef(null);
  const moreMenuRef = useRef(null);
  const nameRef     = useRef(null);
  const { workspaceName, isDirty, setWorkspaceName, addCue, selectedId } = store;

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target)) setFileMenuOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commitName = () => {
    const val = nameRef.current?.value.trim();
    if (val) setWorkspaceName(val);
    setEditingName(false);
  };

  const handleAddCue = (type) => {
    addCue(type, selectedId);
    setMoreMenuOpen(false);
  };

  return (
    <div style={tbStyles.root}>
      {/* Left: brand + workspace name */}
      <div style={tbStyles.left}>
        <div ref={fileMenuRef} style={{ position: 'relative' }}>
          <button style={tbStyles.brand} onClick={() => setFileMenuOpen(v => !v)}>
            WinsLab ▾
          </button>
          {fileMenuOpen && (
            <div style={tbStyles.menu}>
              {[['New','⌘N'],['Open…','⌘O']].map(([label, kbd]) => (
                <button key={label} style={tbStyles.menuItem}
                  onClick={() => { setFileMenuOpen(false); }}>
                  <span>{label}</span><kbd style={tbStyles.kbd}>{kbd}</kbd>
                </button>
              ))}
              <div style={tbStyles.sep} />
              {[['Save','⌘S'],['Save As…','⇧⌘S']].map(([label, kbd]) => (
                <button key={label} style={tbStyles.menuItem}
                  onClick={() => { setFileMenuOpen(false); }}>
                  <span>{label}</span><kbd style={tbStyles.kbd}>{kbd}</kbd>
                </button>
              ))}
            </div>
          )}
        </div>

        {editingName ? (
          <input ref={nameRef} defaultValue={workspaceName} autoFocus
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
            style={tbStyles.nameInput} />
        ) : (
          <span onDoubleClick={() => setEditingName(true)} title="Double-click to rename"
            style={tbStyles.nameText}>
            {workspaceName}
            {isDirty && <span style={{ color: '#e0a020' }}> ●</span>}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={tbStyles.divider} />

      {/* Right: cue buttons */}
      <div style={tbStyles.cueGroup}>
        {PRIMARY_CUES.map(({ type, icon, label }) => (
          <button key={type} style={tbStyles.cueBtn}
            onClick={() => handleAddCue(type)}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.borderColor = '#4a4a4a'; e.currentTarget.style.color = '#e0e0e0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#272727'; e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#b0b0b0'; }}>
            {icon} {label}
          </button>
        ))}

        <div ref={moreMenuRef} style={{ position: 'relative' }}>
          <button style={tbStyles.moreBtn}
            onClick={() => setMoreMenuOpen(v => !v)}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#bbb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#272727'; e.currentTarget.style.color = '#777'; }}>
            More ▾
          </button>
          {moreMenuOpen && (
            <div style={tbStyles.moreMenu}>
              {MORE_CUES.map(({ type, icon, label }) => (
                <button key={type} style={tbStyles.moreItem}
                  onClick={() => handleAddCue(type)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#383838'; e.currentTarget.style.color = '#eee'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#bbb'; }}>
                  <span style={{ fontSize: 13, color: '#666', width: 16, textAlign: 'center' }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const tbStyles = {
  root: {
    display: 'flex', alignItems: 'center', height: 44, padding: '0 12px',
    background: '#1e1e1e', borderBottom: '1px solid #333', gap: 12, flexShrink: 0,
  },
  left: { display: 'flex', alignItems: 'center', gap: 8 },
  brand: {
    fontSize: 14, fontWeight: 700, color: '#e0a020', letterSpacing: '0.05em',
    textTransform: 'uppercase', background: 'transparent', border: 'none',
    cursor: 'pointer', padding: '4px 8px', borderRadius: 3, fontFamily: 'inherit',
  },
  menu: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 200,
    background: '#2a2a2a', border: '1px solid #444', borderRadius: 5,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '4px 0', zIndex: 1000,
  },
  menuItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '6px 14px', background: 'transparent', border: 'none',
    color: '#ccc', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  kbd: { fontSize: 10, color: '#777', fontFamily: 'inherit' },
  sep: { height: 1, background: '#3a3a3a', margin: '4px 0' },
  nameText: { fontSize: 13, color: '#aaa', cursor: 'default', padding: '2px 4px', borderRadius: 3 },
  nameInput: {
    fontSize: 13, background: '#111', border: '1px solid #4a9eff', borderRadius: 3,
    color: '#ddd', padding: '2px 6px', outline: 'none', width: 180, fontFamily: 'inherit',
  },
  divider: { width: 1, height: 20, background: '#333', flexShrink: 0 },
  cueGroup: { display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  cueBtn: {
    height: 28, padding: '0 11px', fontSize: 12,
    border: '1px solid #3a3a3a', borderRadius: 4,
    background: '#272727', color: '#b0b0b0',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.08s',
  },
  moreBtn: {
    height: 28, padding: '0 10px', fontSize: 12,
    border: '1px solid #3a3a3a', borderRadius: 4,
    background: '#272727', color: '#777',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  moreMenu: {
    position: 'absolute', top: 'calc(100% + 5px)', right: 0,
    background: '#2a2a2a', border: '1px solid #444', borderRadius: 5,
    boxShadow: '0 8px 24px rgba(0,0,0,0.55)', padding: '4px 0',
    minWidth: 130, zIndex: 100,
  },
  moreItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '6px 14px',
    background: 'transparent', border: 'none',
    color: '#bbb', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
  },
};

Object.assign(window, { WinslabToolbar: Toolbar });
