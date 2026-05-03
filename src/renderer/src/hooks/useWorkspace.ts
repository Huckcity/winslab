import { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import type { Workspace } from '../types/workspace'

function buildWorkspace(name: string, cues: Workspace['cues']): Workspace {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    audioSettings: { outputDeviceId: 'default', sampleRate: 48000, bufferSize: 256 },
    midiSettings: { outputPortName: '', inputPortName: '' },
    cues
  }
}

export function useWorkspace() {
  const { workspaceName, workspacePath, isDirty, cues, loadWorkspace, saveSucceeded, setWorkspaceName } = useStore()

  // Keep window title in sync
  useEffect(() => {
    const title = `${workspaceName}${isDirty ? ' ●' : ''} — WinsLab`
    document.title = title
    window.winslab.workspace.setTitle(title)
  }, [workspaceName, isDirty])

  const guardDirty = useCallback(async (): Promise<boolean> => {
    if (!isDirty) return true
    const response = await window.winslab.workspace.confirmClose(workspaceName)
    if (response === 2) return false   // Cancel
    if (response === 0) {              // Save
      const ws = buildWorkspace(workspaceName, cues)
      const savedPath = await window.winslab.workspace.save(ws, workspacePath)
      if (!savedPath) return false     // User cancelled save dialog
      saveSucceeded(savedPath, workspaceName)
    }
    return true
  }, [isDirty, workspaceName, workspacePath, cues, saveSucceeded])

  // When the main process intercepts the OS close button, run the dirty check.
  useEffect(() => {
    const off = window.winslab.app.onCloseRequested(async () => {
      const canClose = await guardDirty()
      if (canClose) window.winslab.app.confirmClose()
    })
    return off
  }, [guardDirty])

  const newWorkspace = useCallback(async () => {
    if (!await guardDirty()) return
    loadWorkspace([], 'Untitled', null)
  }, [guardDirty, loadWorkspace])

  const openWorkspace = useCallback(async () => {
    if (!await guardDirty()) return
    const result = await window.winslab.workspace.open()
    if (!result) return
    const name = result.workspace.name || 'Untitled'
    loadWorkspace(result.workspace.cues, name, result.path)
  }, [guardDirty, loadWorkspace])

  const openRecent = useCallback(async (filePath: string) => {
    if (!await guardDirty()) return
    try {
      const result = await window.winslab.workspace.openPath(filePath)
      const name = result.workspace.name || 'Untitled'
      loadWorkspace(result.workspace.cues, name, result.path)
    } catch {
      alert(`Could not open file: ${filePath}`)
    }
  }, [guardDirty, loadWorkspace])

  const save = useCallback(async (): Promise<boolean> => {
    const ws = buildWorkspace(workspaceName, cues)
    const savedPath = await window.winslab.workspace.save(ws, workspacePath)
    if (!savedPath) return false
    saveSucceeded(savedPath, workspaceName)
    return true
  }, [workspaceName, workspacePath, cues, saveSucceeded])

  const saveAs = useCallback(async (): Promise<boolean> => {
    const ws = buildWorkspace(workspaceName, cues)
    const savedPath = await window.winslab.workspace.saveAs(ws)
    if (!savedPath) return false
    saveSucceeded(savedPath, workspaceName)
    return true
  }, [workspaceName, cues, saveSucceeded])

  return { workspaceName, workspacePath, isDirty, newWorkspace, openWorkspace, openRecent, save, saveAs, setWorkspaceName }
}
