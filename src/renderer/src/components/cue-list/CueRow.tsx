import { useState, useRef, useEffect } from 'react'
import type { Cue, CueColor } from '../../types/cue'
import type { RunningCue } from '../../store'
import { useStore } from '../../store'
import { formatDuration } from '../../utils/cueDefaults'
import { audioPlayer } from '../../engine/AudioPlayer'
import './CueRow.css'

const COLOR_MAP: Record<CueColor, string> = {
  none:   'var(--cue-color-none)',
  red:    'var(--cue-color-red)',
  orange: 'var(--cue-color-orange)',
  yellow: 'var(--cue-color-yellow)',
  green:  'var(--cue-color-green)',
  blue:   'var(--cue-color-blue)',
  purple: 'var(--cue-color-purple)',
  pink:   'var(--cue-color-pink)',
}

const TYPE_ICON: Record<string, string> = {
  audio: '♪',
  midi: 'M',
  osc: 'O',
  wait: '⏱',
  fade: '↘',
  stop: '■',
  group: '▤',
  network: '⊕',
  script: '{ }'
}

interface Props {
  cue: Cue
  depth: number
  isSelected: boolean
  runState: RunningCue | null
  collapsed?: boolean
  onToggleCollapse?: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  renamingId: string | null
}

export function CueRow({ cue, depth, isSelected, runState, collapsed, onToggleCollapse, onClick, onContextMenu, renamingId }: Props) {
  const updateCue = useStore(s => s.updateCue)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef<number>(0)
  const progressFillRef = useRef<HTMLDivElement>(null)

  const isAudioPlaying = cue.type === 'audio' && runState?.state === 'playing'

  useEffect(() => {
    if (!isAudioPlaying) {
      if (progressFillRef.current) progressFillRef.current.style.width = '0%'
      return
    }
    const tick = () => {
      const prog = audioPlayer.getProgress(cue.id)
      if (progressFillRef.current) {
        progressFillRef.current.style.width = `${(prog?.fraction ?? 0) * 100}%`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isAudioPlaying, cue.id])

  const startEdit = (e: React.MouseEvent) => {
    if (!isSelected) return
    e.stopPropagation()
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitEdit = (e: React.FocusEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    const val = inputRef.current?.value.trim()
    if (val !== undefined) updateCue(cue.id, { name: val })
    setEditing(false)
  }

  useEffect(() => {
    if (renamingId === cue.id) {
      setEditing(true)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [renamingId, cue.id])

  const isGroup = cue.type === 'group'
  const isRunning = runState !== null

  return (
    <div
      className="cue-row"
      data-selected={isSelected}
      data-running={isRunning}
      data-state={runState?.state}
      data-depth={depth}
      onClick={onClick}
      onDoubleClick={startEdit}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, cue.id) }}
    >
      <span className="col-num">
        {isGroup ? (
          <button
            className="group-toggle"
            onClick={e => { e.stopPropagation(); onToggleCollapse?.() }}
            title={collapsed ? 'Expand group' : 'Collapse group'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="cue-type-icon" title={cue.type}>{TYPE_ICON[cue.type]}</span>
        )}
        {cue.number}
      </span>
      <span
        className="col-color"
        style={{ background: COLOR_MAP[cue.colorLabel] }}
      />
      <span className="col-name">
        {isGroup && (
          <span className="cue-type-icon" title="group">{TYPE_ICON.group}</span>
        )}
        {editing ? (
          <input
            ref={inputRef}
            className="name-edit"
            defaultValue={cue.name}
            onBlur={commitEdit}
            onKeyDown={commitEdit}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="name-text">{cue.name || <em>untitled</em>}</span>
        )}
        {isRunning && runState?.state === 'pre-wait' && (
          <span className="state-pill">pre-wait</span>
        )}
        {isRunning && runState?.state === 'post-wait' && (
          <span className="state-pill">post-wait</span>
        )}
      </span>
      <span className="col-dur">{formatDuration(cue.duration)}</span>
      <span className="col-pre">{cue.preWait > 0 ? formatDuration(cue.preWait) : '–'}</span>
      <span className="col-post">{cue.postWait > 0 ? formatDuration(cue.postWait) : '–'}</span>
      <span className="col-adv">{cue.advance !== 'none' ? cue.advance : ''}</span>

      {isAudioPlaying && (
        <div className="cue-progress-bar">
          <div ref={progressFillRef} className="cue-progress-fill" style={{ width: '0%' }} />
        </div>
      )}
    </div>
  )
}
