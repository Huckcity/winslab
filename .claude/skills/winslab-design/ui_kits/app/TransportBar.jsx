// Winslab UI Kit — TransportBar component
// Exported to window.WinslabTransportBar

function TransportBar({ store }) {
  const { cues, selectedId, running, go, stop, panic } = store;
  const selectedCue = cues.find(c => c.id === selectedId);
  const runningCount = Object.keys(running).length;

  return (
    <div style={transportStyles.bar}>
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 10,
          background: runningCount > 0 ? '#1e4a1e' : '#2a2a2a',
          color: runningCount > 0 ? '#5aaa5a' : '#666',
        }}>
          {runningCount > 0 ? `${runningCount} running` : 'idle'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={{ ...transportStyles.btn, background: '#444', color: '#ccc' }}
          onClick={stop}
          onMouseEnter={e => e.currentTarget.style.background = '#555'}
          onMouseLeave={e => e.currentTarget.style.background = '#444'}>
          ■ STOP
        </button>
        <button style={{ ...transportStyles.btn, background: '#2d7a2d', color: '#fff', minWidth: 90 }}
          onClick={go}
          onMouseEnter={e => e.currentTarget.style.background = '#39a039'}
          onMouseLeave={e => e.currentTarget.style.background = '#2d7a2d'}>
          ▶ GO
        </button>
        <button style={{ ...transportStyles.btn, background: '#7a2d2d', color: '#fff' }}
          onClick={panic}
          onMouseEnter={e => e.currentTarget.style.background = '#a03939'}
          onMouseLeave={e => e.currentTarget.style.background = '#7a2d2d'}>
          ✕ PANIC
        </button>
      </div>

      <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: '#888' }}>
        {selectedCue && (
          <span><strong style={{ color: '#ccc' }}>{selectedCue.number}</strong> {selectedCue.name}</span>
        )}
      </div>
    </div>
  );
}

const transportStyles = {
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 52, padding: '0 16px', background: '#1a1a1a', borderTop: '1px solid #333', flexShrink: 0,
  },
  btn: {
    height: 36, padding: '0 20px', border: 'none', borderRadius: 4,
    fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.1s',
  },
};

Object.assign(window, { WinslabTransportBar: TransportBar });
