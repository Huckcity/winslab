// Winslab UI Kit — WaveformPanel component (simulated waveform)
// Exported to window.WinslabWaveformPanel

const { useEffect, useRef, useState } = React;

function WaveformPanel({ store }) {
  const { cues, selectedId, running } = store;
  const cue = cues.find(c => c.id === selectedId);
  const audioCue = cue?.type === 'audio' ? cue : null;
  const runState = audioCue ? running[audioCue.id] : null;
  const isPlaying = runState?.state === 'playing';

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [playFraction, setPlayFraction] = useState(0);
  const [hoverFraction, setHoverFraction] = useState(null);
  const rafRef = useRef(null);

  // Simulate playhead movement
  useEffect(() => {
    if (!isPlaying) { setPlayFraction(0); return; }
    let start = null;
    const duration = audioCue?.duration || 10000;
    const tick = (ts) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / duration;
      setPlayFraction(Math.min(elapsed, 1));
      if (elapsed < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, audioCue?.id]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !audioCue) return;
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    const playedX = Math.floor(playFraction * w);
    // Synthetic waveform using multiple sine waves seeded by cue id
    const seed = audioCue.id.charCodeAt(0) * 13 + audioCue.id.charCodeAt(1) * 7;
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const amp =
        Math.sin(t * (60 + seed % 40)) * 0.3 +
        Math.sin(t * (23 + seed % 20) + 1) * 0.45 +
        Math.sin(t * (7 + seed % 10) + 2.5) * 0.25;
      const yMid = h / 2;
      const barH = Math.max(2, Math.abs(amp) * yMid * 0.85);
      ctx.fillStyle = x <= playedX ? '#4a9eff' : '#2a6099';
      ctx.fillRect(x, yMid - barH / 2, 1, barH);
    }

    // Playhead
    if (playFraction > 0 && playFraction < 1) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(playedX, 0); ctx.lineTo(playedX, h); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(playedX - 5, 0); ctx.lineTo(playedX + 5, 0); ctx.lineTo(playedX, 8); ctx.fill();
    }
  }, [audioCue, playFraction]);

  if (!audioCue) return null;

  const totalDuration = audioCue.duration / 1000 || 60;
  const playTime = playFraction * totalDuration;
  const hoverTime = hoverFraction != null ? hoverFraction * totalDuration : null;

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1).padStart(4, '0');
    return `${min}:${sec}`;
  };

  return (
    <div style={waveStyles.panel}>
      <div style={waveStyles.header}>
        <span style={waveStyles.filename}>
          {audioCue.filePath ? audioCue.filePath.split(/[\\/]/).pop() : 'No file selected'}
        </span>
        <div style={waveStyles.times}>
          {isPlaying && <span style={{ color: '#4a9eff', fontWeight: 600 }}>{formatTime(playTime)}</span>}
          {hoverTime != null && !isPlaying && <span style={{ color: '#aaa' }}>{formatTime(hoverTime)}</span>}
          <span style={{ color: '#666' }}>{formatTime(totalDuration)}</span>
        </div>
      </div>
      <div ref={containerRef} style={waveStyles.canvasWrap}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, cursor: 'crosshair', display: 'block' }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoverFraction(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
          }}
          onMouseLeave={() => setHoverFraction(null)} />
      </div>
    </div>
  );
}

const waveStyles = {
  panel: { flexShrink: 0, display: 'flex', flexDirection: 'column', height: 110, background: '#111', borderTop: '1px solid #2a2a2a' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px', height: 24, borderBottom: '1px solid #1e1e1e' },
  filename: { fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 },
  times: { marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
  canvasWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
};

Object.assign(window, { WinslabWaveformPanel: WaveformPanel });
