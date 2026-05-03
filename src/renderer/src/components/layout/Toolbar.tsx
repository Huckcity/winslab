import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useWorkspace } from '../../hooks/useWorkspace'
import type { CueType } from '../../types/cue'
import './Toolbar.css'

const CUE_TYPES: { type: CueType; label: string }[] = [
  { type: 'audio', label: 'Audio' },
  { type: 'midi', label: 'MIDI' },
  { type: 'osc', label: 'OSC' },
  { type: 'wait', label: 'Wait' },
  { type: 'fade', label: 'Fade' },
  { type: 'stop', label: 'Stop' },
  { type: 'group', label: 'Group' },
  { type: 'network', label: 'Network' },
  { type: 'script', label: 'Script' },
]

export function Toolbar() {
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
  const { workspaceName, workspacePath, isDirty, newWorkspace, openWorkspace, save, saveAs, setWorkspaceName } =
    useWorkspace()

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Load recent files when menu opens
  useEffect(() => {
    if (fileMenuOpen) {
      window.winslab.workspace.recent().then(setRecentFiles)
    }
  }, [fileMenuOpen])

  // Close menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fileMenuOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 's' && e.shiftKey) { e.preventDefault(); saveAs() }
      else if (e.key === 's') { e.preventDefault(); save() }
      else if (e.key === 'o') { e.preventDefault(); openWorkspace() }
      else if (e.key === 'n') { e.preventDefault(); newWorkspace() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save, saveAs, openWorkspace, newWorkspace])

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
        <div className="file-menu-wrapper" ref={menuRef}>
          <button
            className="toolbar-brand"
            onClick={() => setFileMenuOpen(v => !v)}
            title="File menu"
          >
            WinsLab ▾
          </button>
          {fileMenuOpen && (
            <div className="file-menu">
              <button onClick={() => handleMenuAction(newWorkspace)}>
                New <kbd>⌘N</kbd>
              </button>
              <button onClick={() => handleMenuAction(openWorkspace)}>
                Open… <kbd>⌘O</kbd>
              </button>
              <div className="file-menu-separator" />
              <button onClick={() => handleMenuAction(save)}>
                Save <kbd>⌘S</kbd>
              </button>
              <button onClick={() => handleMenuAction(saveAs)}>
                Save As… <kbd>⇧⌘S</kbd>
              </button>
              {recentFiles.length > 0 && (
                <>
                  <div className="file-menu-separator" />
                  <div className="file-menu-section">Recent</div>
                  {recentFiles.map(p => (
                    <button
                      key={p}
                      className="file-menu-recent"
                      onClick={() => handleMenuAction(() =>
                        window.winslab.workspace.openPath(p).then(r =>
                          useStore.getState().loadWorkspace(r.workspace.cues, r.workspace.name, r.path)
                        )
                      )}
                      title={p}
                    >
                      {p.split('/').pop()}
                    </button>
                  ))}
                </>
              )}
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

      <div className="toolbar-actions">
        <span className="toolbar-label">Add Cue:</span>
        {CUE_TYPES.map(({ type, label }) => (
          <button
            key={type}
            className="toolbar-cue-btn"
            onClick={() => handleAddCue(type)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
