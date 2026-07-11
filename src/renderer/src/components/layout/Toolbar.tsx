import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useWorkspace } from '../../hooks/useWorkspace'
import type { CueType } from '../../types/cue'
import './Toolbar.css'

const PRIMARY_CUES: { type: CueType; icon: string; label: string }[] = [
  { type: 'audio', icon: '♪', label: 'Audio' },
  { type: 'group', icon: '▤', label: 'Group' },
  { type: 'fade',  icon: '↘', label: 'Fade'  },
  { type: 'wait',  icon: '⏱', label: 'Wait'  },
  { type: 'stop',  icon: '■', label: 'Stop'  },
]

const MORE_CUES: { type: CueType; icon: string; label: string }[] = [
  { type: 'midi',    icon: 'M',    label: 'MIDI'    },
  { type: 'osc',     icon: 'O',    label: 'OSC'     },
  { type: 'network', icon: '⊕',   label: 'Network' },
  { type: 'script',  icon: '{ }', label: 'Script'  },
]

interface Props {
  onOpenSettings: () => void
}

export function Toolbar({ onOpenSettings }: Props) {
  const addCue = useStore(s => s.addCue)
  const selectedId = useStore(s => s.selectedId)

  const handleAddCue = (type: CueType) => {
    addCue(type, selectedId ?? undefined)
    if (type === 'fade' && selectedId) {
      const { cues, selectedId: newId, updateCue } = useStore.getState()
      const target = cues.find(c => c.id === selectedId)
      if (newId && target) {
        updateCue(newId, { name: `Fade ${target.name}`, targetCueId: target.id })
      }
    }
  }

  const { workspaceName, workspacePath, isDirty, newWorkspace, openWorkspace, openRecent, save, saveAs, setWorkspaceName } =
    useWorkspace()

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (fileMenuOpen) {
      window.winslab.workspace.recent().then(setRecentFiles)
    }
  }, [fileMenuOpen])

  useEffect(() => {
    if (!fileMenuOpen && !moreMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) setFileMenuOpen(false)
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fileMenuOpen, moreMenuOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 's' && e.shiftKey) { e.preventDefault(); saveAs() }
      else if (e.key === 's') { e.preventDefault(); save() }
      else if (e.key === 'o') { e.preventDefault(); openWorkspace() }
      else if (e.key === 'n') { e.preventDefault(); newWorkspace() }
      else if (e.key === ',') { e.preventDefault(); onOpenSettings() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save, saveAs, openWorkspace, newWorkspace, onOpenSettings])

  const handleMenuAction = async (action: () => void | Promise<void>) => {
    setFileMenuOpen(false)
    await action()
  }

  const commitName = () => {
    const val = nameRef.current?.value.trim()
    if (val) setWorkspaceName(val)
    setEditingName(false)
  }

  const baseName = workspacePath
    ? workspacePath.split('/').pop()?.replace('.wlab', '') ?? workspaceName
    : workspaceName

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="file-menu-wrapper" ref={fileMenuRef}>
          <button className="toolbar-brand" onClick={() => setFileMenuOpen(v => !v)} title="File menu">
            WinsLab ▾
          </button>
          {fileMenuOpen && (
            <div className="file-menu">
              <button onClick={() => handleMenuAction(newWorkspace)}>
                <span>New</span><kbd>⌘N</kbd>
              </button>
              <button onClick={() => handleMenuAction(openWorkspace)}>
                <span>Open…</span><kbd>⌘O</kbd>
              </button>
              <div className="file-menu-separator" />
              <button onClick={() => handleMenuAction(save)}>
                <span>Save</span><kbd>⌘S</kbd>
              </button>
              <button onClick={() => handleMenuAction(saveAs)}>
                <span>Save As…</span><kbd>⇧⌘S</kbd>
              </button>
              {recentFiles.length > 0 && (
                <>
                  <div className="file-menu-separator" />
                  <div className="file-menu-section">Recent</div>
                  {recentFiles.map(p => (
                    <button
                      key={p}
                      className="file-menu-recent"
                      onClick={() => handleMenuAction(() => openRecent(p))}
                      title={p}
                    >
                      <span>{p.split('/').pop()}</span>
                    </button>
                  ))}
                </>
              )}
              <div className="file-menu-separator" />
              <button onClick={() => handleMenuAction(onOpenSettings)}>
                <span>Settings…</span><kbd>⌘,</kbd>
              </button>
            </div>
          )}
        </div>

        <div className="workspace-name">
          {editingName ? (
            <input
              ref={nameRef}
              className="workspace-name-input"
              defaultValue={workspaceName}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus
            />
          ) : (
            <span
              className="workspace-name-text"
              onDoubleClick={() => setEditingName(true)}
              title="Double-click to rename"
            >
              {baseName}{isDirty ? <span className="dirty-dot"> ●</span> : ''}
            </span>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-actions">
        {PRIMARY_CUES.map(({ type, icon, label }) => (
          <button key={type} className="toolbar-cue-btn" onClick={() => handleAddCue(type)}>
            {icon} {label}
          </button>
        ))}

        <div ref={moreMenuRef} style={{ position: 'relative' }}>
          <button className="toolbar-more-btn" onClick={() => setMoreMenuOpen(v => !v)}>
            More ▾
          </button>
          {moreMenuOpen && (
            <div className="toolbar-more-menu">
              {MORE_CUES.map(({ type, icon, label }) => (
                <button
                  key={type}
                  className="toolbar-more-menu-item"
                  onClick={() => { handleAddCue(type); setMoreMenuOpen(false) }}
                >
                  <span className="toolbar-more-menu-icon">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
