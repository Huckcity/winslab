import { useRef, useCallback, useState, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../../store'
import type { GroupCue } from '../../types/cue'
import { CueRow } from './CueRow'
import { CueContextMenu } from './CueContextMenu'
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

// One entry in the virtualizer's flat render list.
interface RenderItem {
  cue: ReturnType<typeof useStore.getState>['cues'][number]
  depth: 0 | 1
  flatIndex: number     // index in cues[]
  collapsed?: boolean   // only set for group rows
}

// Given a drop position between renderItems[dropAt-1] and renderItems[dropAt],
// return the parentId the dropped cue should receive.
function dropParentId(items: RenderItem[], dropAt: number): string | null {
  // Either neighbor is a visible child → stay in that group
  if (dropAt < items.length && items[dropAt].depth === 1) {
    return items[dropAt].cue.parentId
  }
  if (dropAt > 0 && items[dropAt - 1].depth === 1) {
    return items[dropAt - 1].cue.parentId
  }
  // Dropping at the bottom half of a group header (empty or collapsed group):
  // the previous item is a group AND the next item is not also a group header.
  // The two-adjacent-groups edge case falls back to null (top-level between them).
  if (
    dropAt > 0 &&
    items[dropAt - 1].cue.type === 'group' &&
    (dropAt >= items.length || items[dropAt].cue.type !== 'group')
  ) {
    return items[dropAt - 1].cue.id
  }
  return null
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

  // Collapse state is local UI state — not persisted to workspace
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set())

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; cueId: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const openCtxMenu = useCallback((e: React.MouseEvent, cueId: string) => {
    e.preventDefault()
    select(cueId)
    setCtxMenu({ x: e.clientX, y: e.clientY, cueId })
  }, [select])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedGroupIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // ── Render list ───────────────────────────────────────────────────────────

  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = []
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i]
      if (cue.parentId !== null) {
        // Skip children of collapsed groups
        if (collapsedGroupIds.has(cue.parentId)) continue
        items.push({ cue, depth: 1, flatIndex: i })
      } else {
        const isGroup = cue.type === 'group'
        items.push({
          cue,
          depth: 0,
          flatIndex: i,
          ...(isGroup ? { collapsed: collapsedGroupIds.has(cue.id) } : {})
        })
      }
    }
    return items
  }, [cues, collapsedGroupIds])

  // ── File-drop state ───────────────────────────────────────────────────────

  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  // ── Cue-reorder drag state ────────────────────────────────────────────────

  const [dragRenderIndex, setDragRenderIndex] = useState<number | null>(null)
  const [dropRenderIndex, setDropRenderIndex] = useState<number | null>(null)

  // Hover-expand: auto-expand a collapsed group when dragged over for 700ms
  const hoverGroupIdRef = useRef<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverGroupIdRef.current = null
  }, [])

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: renderItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5
  })

  // ── File-drop handlers ────────────────────────────────────────────────────

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

  const handleRowDragStart = useCallback((e: React.DragEvent, renderIndex: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-cue-render-index', String(renderIndex))
    setDragRenderIndex(renderIndex)
    clearHoverTimer()
  }, [clearHoverTimer])

  const handleRowDragOver = useCallback((e: React.DragEvent, renderIndex: number) => {
    if (!e.dataTransfer.types.includes('application/x-cue-render-index')) return
    e.preventDefault()
    e.stopPropagation()

    const item = renderItems[renderIndex]

    // Hover-expand: if this is a collapsed group, start/maintain the timer
    if (item?.cue.type === 'group' && item.collapsed) {
      if (hoverGroupIdRef.current !== item.cue.id) {
        clearHoverTimer()
        hoverGroupIdRef.current = item.cue.id
        hoverTimerRef.current = setTimeout(() => {
          setCollapsedGroupIds(prev => {
            const next = new Set(prev)
            next.delete(item.cue.id)
            return next
          })
          hoverGroupIdRef.current = null
          hoverTimerRef.current = null
        }, 700)
      }
    } else {
      clearHoverTimer()
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const newDrop = e.clientY < rect.top + rect.height / 2 ? renderIndex : renderIndex + 1
    setDropRenderIndex(newDrop)
  }, [renderItems, clearHoverTimer])

  const handleScrollDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-cue-render-index')) return
    e.preventDefault()
    e.stopPropagation()
    clearHoverTimer()
    setDropRenderIndex(renderItems.length)
  }, [renderItems.length, clearHoverTimer])

  const handleReorderDrop = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-cue-render-index')) return
    e.preventDefault()
    e.stopPropagation()
    clearHoverTimer()

    const fromStr = e.dataTransfer.getData('application/x-cue-render-index')
    if (!fromStr || dropRenderIndex === null) return

    const fromRender = parseInt(fromStr, 10)
    const fromItem = renderItems[fromRender]
    if (!fromItem) return

    const fromFlat = fromItem.flatIndex
    const targetFlat = dropRenderIndex < renderItems.length
      ? renderItems[dropRenderIndex].flatIndex
      : cues.length
    const newParent = dropParentId(renderItems, dropRenderIndex)

    setDragRenderIndex(null)
    setDropRenderIndex(null)

    // Compute the post-removal insertion index (store's moveCue splices after removing)
    const toFlat = fromFlat < targetFlat ? targetFlat - 1 : targetFlat
    if (fromFlat === toFlat && fromItem.cue.parentId === newParent) return

    moveCue(fromFlat, toFlat, newParent)
  }, [dropRenderIndex, renderItems, cues.length, moveCue, clearHoverTimer])

  const handleRowDragEnd = useCallback(() => {
    clearHoverTimer()
    setDragRenderIndex(null)
    setDropRenderIndex(null)
  }, [clearHoverTimer])

  // ── Keyboard ──────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (ctxMenu) { closeCtxMenu(); return }
    }

    const renderIdx = renderItems.findIndex(item => item.cue.id === selectedId)

    if (e.key === 'ArrowDown' && renderIdx < renderItems.length - 1) {
      select(renderItems[renderIdx + 1].cue.id)
    } else if (e.key === 'ArrowUp' && renderIdx > 0) {
      select(renderItems[renderIdx - 1].cue.id)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedId) removeCue(selectedId)
    } else if (e.key === 'd' && e.metaKey) {
      if (selectedId) duplicateCue(selectedId)
    }
  }, [renderItems, selectedId, select, removeCue, duplicateCue, ctxMenu, closeCtxMenu])

  // ── Drop indicator ────────────────────────────────────────────────────────

  const showDropIndicator = dropRenderIndex !== null &&
    dragRenderIndex !== null &&
    dropRenderIndex !== dragRenderIndex &&
    dropRenderIndex !== dragRenderIndex + 1

  const dropIndicatorTop = (() => {
    if (!showDropIndicator || dropRenderIndex === null) return null
    const items = virtualizer.getVirtualItems()
    if (dropRenderIndex < renderItems.length) {
      return items.find(i => i.index === dropRenderIndex)?.start ?? null
    }
    const last = items[items.length - 1]
    return last ? last.start + last.size : null
  })()

  // Left indent for the drop indicator when dropping inside a group
  const dropIndent = (() => {
    if (dropRenderIndex === null) return 0
    const parent = dropParentId(renderItems, dropRenderIndex)
    return parent ? 28 : 0
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
        onScroll={() => ctxMenu && closeCtxMenu()}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(item => {
            const entry = renderItems[item.index]
            const { cue, depth, collapsed } = entry
            return (
              <div
                key={cue.id}
                className="cue-virtual-row"
                style={{ position: 'absolute', top: item.start, width: '100%', height: item.size }}
                draggable
                data-dragging={dragRenderIndex === item.index || undefined}
                onDragStart={e => handleRowDragStart(e, item.index)}
                onDragOver={e => handleRowDragOver(e, item.index)}
                onDrop={handleReorderDrop}
                onDragEnd={handleRowDragEnd}
              >
                <CueRow
                  cue={cue}
                  depth={depth}
                  isSelected={cue.id === selectedId}
                  runState={running.get(cue.id) ?? null}
                  collapsed={collapsed}
                  onToggleCollapse={cue.type === 'group' ? () => toggleCollapse(cue.id) : undefined}
                  onClick={() => select(cue.id)}
                  onContextMenu={openCtxMenu}
                  renamingId={renamingId}
                />
              </div>
            )
          })}
          {dropIndicatorTop !== null && (
            <div
              className="cue-drop-indicator"
              style={{ top: dropIndicatorTop, left: dropIndent }}
            />
          )}
        </div>
      </div>
      {renderItems.length === 0 && !isDragOver && (
        <div className="cue-list-empty">
          No cues. Add cues using the toolbar above, or drag audio files here.
        </div>
      )}
      {isDragOver && (
        <div className="cue-list-drop-hint">
          Drop audio files to create cues
        </div>
      )}
      {ctxMenu && (() => {
        const ctxCue = cues.find(c => c.id === ctxMenu.cueId)
        return ctxCue ? (
          <CueContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            cue={ctxCue}
            onClose={closeCtxMenu}
            onRename={() => {
              setRenamingId(ctxMenu.cueId)
              setTimeout(() => setRenamingId(null), 100)
            }}
          />
        ) : null
      })()}
    </div>
  )
}
