import { useRef, useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../../store'
import { CueRow } from './CueRow'
import './CueList.css'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.wave', '.aiff', '.aif', '.flac', '.ogg', '.m4a', '.aac', '.opus', '.wma'])

function isAudioFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return AUDIO_EXTENSIONS.has(ext)
}

function nameFromPath(filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? filePath
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx > 0 ? filename.slice(0, dotIdx) : filename
}

export function CueList() {
  const cues = useStore(s => s.cues)
  const selectedId = useStore(s => s.selectedId)
  const running = useStore(s => s.running)
  const select = useStore(s => s.select)
  const removeCue = useStore(s => s.removeCue)
  const duplicateCue = useStore(s => s.duplicateCue)
  const moveCue = useStore(s => s.moveCue)
  const addAudioCuesFromFiles = useStore(s => s.addAudioCuesFromFiles)

  // File-drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  // Cue-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: cues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5
  })

  // ── File-drop handlers (outer container only) ─────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)

    const audioFiles = Array.from(e.dataTransfer.files)
      .filter(f => isAudioFile(f.name))
      .map(f => {
        const filePath = window.winslab.getPathForFile(f)
        return { filePath, name: nameFromPath(filePath) }
      })

    if (audioFiles.length > 0) {
      addAudioCuesFromFiles(audioFiles, selectedId ?? undefined)
    }
  }, [addAudioCuesFromFiles, selectedId])

  // ── Cue-reorder handlers ──────────────────────────────────────────────────

  const handleRowDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-cue-index', String(index))
    setDragIndex(index)
  }, [])

  const handleRowDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!e.dataTransfer.types.includes('application/x-cue-index')) return
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const newDrop = e.clientY < rect.top + rect.height / 2 ? index : index + 1
    setDropIndex(newDrop)
  }, [])

  // Fallback: dragging below all rows inside the scroll container
  const handleScrollDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-cue-index')) return
    e.preventDefault()
    e.stopPropagation()
    setDropIndex(cues.length)
  }, [cues.length])

  const handleReorderDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const fromStr = e.dataTransfer.getData('application/x-cue-index')
    if (!fromStr || dropIndex === null) return
    const from = parseInt(fromStr, 10)
    const to = from < dropIndex ? dropIndex - 1 : dropIndex
    setDragIndex(null)
    setDropIndex(null)
    if (from !== to) moveCue(from, to)
  }, [dropIndex, moveCue])

  const handleRowDragEnd = useCallback(() => {
    setDragIndex(null)
    setDropIndex(null)
  }, [])

  // ── Keyboard ──────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const idx = cues.findIndex(c => c.id === selectedId)
    if (e.key === 'ArrowDown' && idx < cues.length - 1) {
      select(cues[idx + 1].id)
    } else if (e.key === 'ArrowUp' && idx > 0) {
      select(cues[idx - 1].id)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedId) removeCue(selectedId)
    } else if (e.key === 'd' && e.metaKey) {
      if (selectedId) duplicateCue(selectedId)
    }
  }, [cues, selectedId, select, removeCue, duplicateCue])

  // Drop indicator position: suppress when adjacent to the dragging row (no-op move)
  const showDropIndicator = dropIndex !== null &&
    dragIndex !== null &&
    dropIndex !== dragIndex &&
    dropIndex !== dragIndex + 1

  const dropIndicatorTop = (() => {
    if (!showDropIndicator || dropIndex === null) return null
    const items = virtualizer.getVirtualItems()
    if (dropIndex < cues.length) {
      return items.find(i => i.index === dropIndex)?.start ?? null
    }
    const last = items[items.length - 1]
    return last ? last.start + last.size : null
  })()

  return (
    <div
      className="cue-list-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
      data-drag-over={isDragOver}
    >
      <div className="cue-list-header">
        <span className="col-num">#</span>
        <span className="col-color"></span>
        <span className="col-name">Name</span>
        <span className="col-dur">Duration</span>
        <span className="col-pre">Pre-W</span>
        <span className="col-post">Post-W</span>
        <span className="col-adv">Advance</span>
      </div>
      <div
        ref={parentRef}
        className="cue-list-scroll"
        onDragOver={handleScrollDragOver}
        onDrop={handleReorderDrop}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(item => {
            const cue = cues[item.index]
            return (
              <div
                key={cue.id}
                className="cue-virtual-row"
                style={{ position: 'absolute', top: item.start, width: '100%', height: item.size }}
                draggable
                data-dragging={dragIndex === item.index || undefined}
                onDragStart={e => handleRowDragStart(e, item.index)}
                onDragOver={e => handleRowDragOver(e, item.index)}
                onDrop={handleReorderDrop}
                onDragEnd={handleRowDragEnd}
              >
                <CueRow
                  cue={cue}
                  isSelected={cue.id === selectedId}
                  runState={running.get(cue.id) ?? null}
                  onClick={() => select(cue.id)}
                />
              </div>
            )
          })}
          {dropIndicatorTop !== null && (
            <div className="cue-drop-indicator" style={{ top: dropIndicatorTop }} />
          )}
        </div>
      </div>
      {cues.length === 0 && !isDragOver && (
        <div className="cue-list-empty">
          No cues. Add cues using the toolbar above, or drag audio files here.
        </div>
      )}
      {isDragOver && (
        <div className="cue-list-drop-hint">
          Drop audio files to create cues
        </div>
      )}
    </div>
  )
}
