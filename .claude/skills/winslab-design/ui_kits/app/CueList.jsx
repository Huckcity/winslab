// Winslab UI Kit — CueList + CueRow components
// Exported to window.WinslabCueList

const { useState, useRef, useCallback } = React;

const COLOR_MAP = {
  none: 'transparent', red: '#c0392b', orange: '#e67e22', yellow: '#f1c40f',
  green: '#27ae60', blue: '#2980b9', purple: '#8e44ad', pink: '#e91e8c',
};

const TYPE_ICON = {
  audio: '♪', midi: 'M', osc: 'O', wait: '⏱', fade: '↘',
  stop: '■', group: '▤', network: '⊕', script: '{ }',
};

function formatDuration(ms) {
  if (!ms || ms <= 0) return '–';
  const s = ms / 1000;
  const min = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${min}:${sec}`;
}

function CueRow({ cue, isSelected, runState, onClick, onNameCommit }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const isPlaying = runState?.state === 'playing';
  const isPrewait = runState?.state === 'pre-wait';

  const rowBg = isSelected
    ? '#1e2d3d'
    : isPlaying ? '#1a2a1a'
    : isPrewait ? '#2a2a1a'
    : 'transparent';

  const startEdit = (e) => {
    if (!isSelected) return;
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = (e) => {
    if (e.key && e.key !== 'Enter') return;
    const val = inputRef.current?.value.trim();
    if (val !== undefined) onNameCommit(cue.id, val);
    setEditing(false);
  };

  return (
    <div style={{ ...cueRowStyles.row, background: rowBg }}
      onClick={onClick}
      onDoubleClick={startEdit}>
      <span style={cueRowStyles.num}>
        <span style={cueRowStyles.icon}>{TYPE_ICON[cue.type] || '?'}</span>
        <span style={{ color: '#888', fontSize: 11 }}>{cue.number}</span>
      </span>
      <span style={{ ...cueRowStyles.colorBar, background: COLOR_MAP[cue.colorLabel] || 'transparent' }} />
      <span style={cueRowStyles.name}>
        {editing ? (
          <input ref={inputRef} defaultValue={cue.name}
            onBlur={commitEdit} onKeyDown={commitEdit}
            onClick={e => e.stopPropagation()}
            style={cueRowStyles.nameEdit} />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cue.name || <em style={{ color: '#555', fontStyle: 'normal' }}>untitled</em>}
          </span>
        )}
        {isPrewait && <span style={cueRowStyles.pill}>pre-wait</span>}
        {isPlaying && <span style={{ ...cueRowStyles.pill, background: '#2a3a1a', color: '#7aaa5a' }}>playing</span>}
      </span>
      <span style={cueRowStyles.dur}>{formatDuration(cue.duration)}</span>
      <span style={cueRowStyles.timing}>{cue.preWait > 0 ? formatDuration(cue.preWait) : '–'}</span>
      <span style={cueRowStyles.timing}>{cue.postWait > 0 ? formatDuration(cue.postWait) : '–'}</span>
      <span style={cueRowStyles.adv}>{cue.advance !== 'none' ? cue.advance : ''}</span>
      {isPlaying && (
        <div style={cueRowStyles.progressTrack}>
          <div style={{ ...cueRowStyles.progressFill, width: `${(runState.progress || 0.4) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function CueList({ store }) {
  const { cues, selectedId, running, select, removeCue, duplicateCue, moveCue, updateCue, addAudioCue } = store;
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleRowDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-cue-index', String(index));
    setDragIndex(index);
  };
  const handleRowDragOver = (e, index) => {
    if (!e.dataTransfer.types.includes('application/x-cue-index')) return;
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const from = parseInt(e.dataTransfer.getData('application/x-cue-index'), 10);
    if (isNaN(from) || dropIndex === null) return;
    const to = from < dropIndex ? dropIndex - 1 : dropIndex;
    setDragIndex(null); setDropIndex(null);
    if (from !== to) moveCue(from, to);
  };

  return (
    <div style={cueListStyles.container} tabIndex={0}
      onKeyDown={e => {
        const idx = cues.findIndex(c => c.id === selectedId);
        if (e.key === 'ArrowDown' && idx < cues.length - 1) select(cues[idx + 1].id);
        else if (e.key === 'ArrowUp' && idx > 0) select(cues[idx - 1].id);
        else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) removeCue(selectedId);
        else if (e.key === 'd' && (e.metaKey || e.ctrlKey) && selectedId) duplicateCue(selectedId);
      }}
      onDragEnter={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setIsDragOver(true); }}
      onDragOver={e => { e.preventDefault(); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        setIsDragOver(false);
        if (e.dataTransfer.types.includes('application/x-cue-index')) { handleDrop(e); return; }
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          const names = Array.from(e.dataTransfer.files).map(f => f.name).join(', ');
          addAudioCue(`Dropped: ${names}`, selectedId);
        }
      }}>

      {/* Header */}
      <div style={cueListStyles.header}>
        <span style={{ width: 52 }}>#</span>
        <span style={{ width: 6, margin: '0 10px' }}></span>
        <span style={{ flex: 1 }}>Name</span>
        <span style={{ width: 72, textAlign: 'right' }}>Duration</span>
        <span style={{ width: 60, textAlign: 'right' }}>Pre-W</span>
        <span style={{ width: 60, textAlign: 'right' }}>Post-W</span>
        <span style={{ width: 60, textAlign: 'center' }}>Advance</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {cues.map((cue, index) => (
          <div key={cue.id} style={{ opacity: dragIndex === index ? 0.35 : 1, position: 'relative' }}
            draggable
            onDragStart={e => handleRowDragStart(e, index)}
            onDragOver={e => handleRowDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}>
            {dropIndex === index && dragIndex !== null && dropIndex !== dragIndex && dropIndex !== dragIndex + 1 && (
              <div style={cueListStyles.dropIndicator} />
            )}
            <CueRow
              cue={cue}
              isSelected={cue.id === selectedId}
              runState={running[cue.id] || null}
              onClick={() => select(cue.id)}
              onNameCommit={(id, name) => updateCue(id, { name })}
            />
          </div>
        ))}
        {dropIndex === cues.length && dragIndex !== null && (
          <div style={cueListStyles.dropIndicator} />
        )}
        {cues.length === 0 && !isDragOver && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555', fontSize: 13 }}>
            No cues. Add cues using the toolbar above, or drag audio files here.
          </div>
        )}
      </div>

      {isDragOver && (
        <div style={cueListStyles.dropHint}>Drop audio files to create cues</div>
      )}
    </div>
  );
}

const cueRowStyles = {
  row: {
    display: 'flex', alignItems: 'center', height: 32, padding: '0 8px',
    borderBottom: '1px solid #222', cursor: 'pointer', fontSize: 12, color: '#bbb',
    userSelect: 'none', position: 'relative',
  },
  num: { width: 52, flexShrink: 0, color: '#888', fontSize: 11, display: 'flex', alignItems: 'center' },
  icon: { display: 'inline-block', width: 18, fontSize: 14, color: '#777', marginRight: 4, textAlign: 'center', lineHeight: 1 },
  colorBar: { width: 6, height: 20, borderRadius: 2, flexShrink: 0, marginRight: 10 },
  name: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  nameEdit: {
    flex: 1, background: '#0d1f33', border: '1px solid #4a9eff', borderRadius: 2,
    color: '#ddd', fontSize: 12, padding: '1px 4px', outline: 'none', height: 22, fontFamily: 'inherit',
  },
  pill: { fontSize: 10, padding: '3px 8px', borderRadius: 8, background: '#2a2a1a', color: '#aaa', flexShrink: 0 },
  dur: { width: 72, flexShrink: 0, textAlign: 'right', color: '#666', fontVariantNumeric: 'tabular-nums' },
  timing: { width: 60, flexShrink: 0, textAlign: 'right', color: '#666', fontVariantNumeric: 'tabular-nums' },
  adv: { width: 60, flexShrink: 0, textAlign: 'center', color: '#4a8a4a', fontSize: 10 },
  progressTrack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(74,158,255,0.15)' },
  progressFill: { height: '100%', background: '#4a9eff' },
};

const cueListStyles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', outline: 'none', position: 'relative' },
  header: {
    display: 'flex', alignItems: 'center', height: 26, padding: '0 8px',
    background: '#1a1a1a', borderBottom: '1px solid #333',
    fontSize: 10, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em',
    flexShrink: 0,
  },
  dropIndicator: { position: 'absolute', left: 0, right: 0, height: 2, background: '#4a9eff', boxShadow: '0 0 6px rgba(74,158,255,0.6)', zIndex: 10, pointerEvents: 'none' },
  dropHint: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#4a9eff', pointerEvents: 'none' },
};

Object.assign(window, { WinslabCueList: CueList, WinslabCueRow: CueRow, formatDuration });
