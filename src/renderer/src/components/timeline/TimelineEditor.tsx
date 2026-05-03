import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '../../store'
import type { GroupCue, Cue } from '../../types/cue'
import './TimelineEditor.css'

const RULER_H = 22
const ROW_H = 28
const ROW_GAP = 2
const LABEL_W = 104
const MIN_BLOCK_W = 8
const ZOOM_LEVELS = [5, 10, 25, 50, 100, 200, 400, 800]
const DEFAULT_ZOOM = 100

const TICK_CANDIDATES_MS = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000]

const CUE_LABEL_COLORS: Record<string, string> = {
  red:    '#c0392b',
  orange: '#e67e22',
  yellow: '#b8960a',
  green:  '#27ae60',
  blue:   '#2980b9',
  purple: '#8e44ad',
  pink:   '#e91e8c',
}

const CUE_TYPE_COLORS: Record<string, string> = {
  audio:   '#1e5c8a',
  midi:    '#5a2870',
  osc:     '#186040',
  wait:    '#3a3a3a',
  fade:    '#7a1060',
  stop:    '#7a2020',
  group:   '#7a4a10',
  network: '#686010',
  script:  '#184870',
}

function blockColor(cue: Cue): string {
  if (cue.colorLabel !== 'none' && CUE_LABEL_COLORS[cue.colorLabel]) {
    return CUE_LABEL_COLORS[cue.colorLabel]
  }
  return CUE_TYPE_COLORS[cue.type] ?? '#3a3a3a'
}

function fmtTime(ms: number): string {
  if (ms === 0) return '0'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) {
    const fixed = s.toFixed(1)
    return fixed.endsWith('.0') ? fixed.slice(0, -2) + 's' : fixed + 's'
  }
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(0).padStart(2, '0')}`
}

function pickTickMs(pxPerMs: number): number {
  return TICK_CANDIDATES_MS.find(t => t * pxPerMs >= 50) ?? 60000
}

interface Props {
  cue: GroupCue
}

export function TimelineEditor({ cue }: Props) {
  const cues = useStore(s => s.cues)
  const running = useStore(s => s.running)
  const updateCue = useStore(s => s.updateCue)
  const select = useStore(s => s.select)
  const selectedId = useStore(s => s.selectedId)

  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const pxPerMs = zoom / 1000

  const children = cues.filter(c => c.parentId === cue.id)

  const contentEndMs = Math.max(
    5000,
    ...children.map(c => c.timelineOffset + Math.max(c.duration, 200))
  )
  const trackW = Math.ceil(contentEndMs * pxPerMs) + 120

  // Playhead
  const [playheadMs, setPlayheadMs] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const groupRunState = running.get(cue.id)

  useEffect(() => {
    if (!groupRunState || groupRunState.state !== 'playing') {
      setPlayheadMs(null)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      return
    }
    const { startedAt } = groupRunState
    const tick = () => {
      setPlayheadMs(Date.now() - startedAt)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [groupRunState])

  // Drag
  const dragRef = useRef<{ cueId: string; startX: number; startOffset: number } | null>(null)

  const onBlockPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, child: Cue) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { cueId: child.id, startX: e.clientX, startOffset: child.timelineOffset }
    select(child.id)
    e.preventDefault()
  }, [select])

  const onBlockPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const newOffset = Math.max(0, Math.round(dragRef.current.startOffset + dx / pxPerMs))
    updateCue(dragRef.current.cueId, { timelineOffset: newOffset })
  }, [pxPerMs, updateCue])

  const onBlockPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null
  }, [])

  const zoomIn = () => {
    const idx = ZOOM_LEVELS.findIndex(l => l >= zoom)
    setZoom(ZOOM_LEVELS[Math.min(idx + 1, ZOOM_LEVELS.length - 1)])
  }
  const zoomOut = () => {
    const idx = ZOOM_LEVELS.findIndex(l => l >= zoom)
    setZoom(ZOOM_LEVELS[Math.max(idx - 1, 0)])
  }

  const tickMs = pickTickMs(pxPerMs)
  const ticks: number[] = []
  for (let t = 0; t <= contentEndMs + tickMs; t += tickMs) ticks.push(t)

  const selectedChild = children.find(c => c.id === selectedId)
  const totalH = RULER_H + children.length * (ROW_H + ROW_GAP)

  return (
    <div className="timeline-panel">
      <div className="timeline-header">
        <span className="tl-title">{cue.name || 'Timeline'}</span>
        {selectedChild && (
          <span className="tl-selection-info">
            {selectedChild.name || selectedChild.type}
            {' — '}
            {fmtTime(selectedChild.timelineOffset)}
          </span>
        )}
        <div className="tl-zoom-controls">
          <button className="tl-zoom-btn" onClick={zoomOut} disabled={zoom <= ZOOM_LEVELS[0]}>−</button>
          <span className="tl-zoom-label">{zoom}px/s</span>
          <button className="tl-zoom-btn" onClick={zoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>+</button>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="tl-empty">Add cues to this group to arrange them on the timeline.</div>
      ) : (
        <div className="tl-body">
          <div className="tl-labels-col">
            <div className="tl-corner" style={{ height: RULER_H }} />
            {children.map(child => (
              <div
                key={child.id}
                className="tl-row-label"
                data-selected={child.id === selectedId}
                style={{ height: ROW_H, marginBottom: ROW_GAP }}
                onClick={() => select(child.id)}
              >
                {child.name || child.type}
              </div>
            ))}
          </div>

          <div className="tl-tracks-outer">
            <div className="tl-tracks-inner" style={{ width: trackW, minHeight: totalH }}>
              <div className="tl-ruler" style={{ height: RULER_H }}>
                {ticks.map(t => (
                  <div key={t} className="tl-tick" style={{ left: t * pxPerMs }}>
                    <span className="tl-tick-label">{fmtTime(t)}</span>
                  </div>
                ))}
              </div>

              {children.map(child => {
                const blockW = Math.max(MIN_BLOCK_W, child.duration * pxPerMs)
                return (
                  <div
                    key={child.id}
                    className="tl-row"
                    style={{ height: ROW_H, marginBottom: ROW_GAP }}
                  >
                    <div
                      className="tl-block"
                      data-selected={child.id === selectedId}
                      style={{
                        left: child.timelineOffset * pxPerMs,
                        width: blockW,
                        background: blockColor(child),
                      }}
                      onPointerDown={e => onBlockPointerDown(e, child)}
                      onPointerMove={onBlockPointerMove}
                      onPointerUp={onBlockPointerUp}
                    >
                      {blockW >= 24 && (
                        <span className="tl-block-label">{child.name || child.type}</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {playheadMs !== null && (
                <div
                  className="tl-playhead"
                  style={{ left: playheadMs * pxPerMs, height: totalH - RULER_H, top: RULER_H }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
