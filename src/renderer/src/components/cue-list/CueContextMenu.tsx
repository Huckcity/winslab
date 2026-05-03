import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import type { Cue } from '../../types/cue'
import { useStore } from '../../store'
import './CueContextMenu.css'

interface Props {
  x: number
  y: number
  cue: Cue
  onClose: () => void
  onRename: () => void
}

const MENU_WIDTH = 160
const MENU_HEIGHT = 130

export function CueContextMenu({ x, y, cue, onClose, onRename }: Props) {
  const removeCue = useStore(s => s.removeCue)
  const duplicateCue = useStore(s => s.duplicateCue)
  const updateCue = useStore(s => s.updateCue)
  const menuRef = useRef<HTMLDivElement>(null)

  const clampedX = Math.min(x, window.innerWidth - MENU_WIDTH - 4)
  const clampedY = Math.min(y, window.innerHeight - MENU_HEIGHT - 4)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [onClose])

  const handleRename = () => { onRename(); onClose() }
  const handleDuplicate = () => { duplicateCue(cue.id); onClose() }
  const handleDelete = () => { removeCue(cue.id); onClose() }
  const handleArmToggle = () => { updateCue(cue.id, { isArmed: !cue.isArmed }); onClose() }

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="cue-context-menu"
      style={{ left: clampedX, top: clampedY }}
      onContextMenu={e => e.preventDefault()}
    >
      <button className="cue-context-menu-item" onClick={handleRename}>
        <span className="cue-context-menu-icon">✎</span>
        Rename
      </button>
      <button className="cue-context-menu-item" onClick={handleDuplicate}>
        <span className="cue-context-menu-icon">⧉</span>
        Duplicate
        <kbd>⌘D</kbd>
      </button>
      <button className="cue-context-menu-item cue-context-menu-item--danger" onClick={handleDelete}>
        <span className="cue-context-menu-icon">✕</span>
        Delete
      </button>
      <div className="cue-context-menu-separator" />
      <button className="cue-context-menu-item" onClick={handleArmToggle}>
        <span className="cue-context-menu-icon">{cue.isArmed ? '○' : '●'}</span>
        {cue.isArmed ? 'Disarm' : 'Arm'}
      </button>
    </div>,
    document.body
  )
}
