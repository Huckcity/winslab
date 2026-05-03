import { app, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Workspace } from '../../renderer/src/types/workspace'

const RECENT_KEY = 'recentWorkspaces'
const MAX_RECENT = 10

// Simple JSON persistence for recent files (avoids adding electron-store dep complexity)
function recentFilePath(): string {
  return join(app.getPath('userData'), 'recent.json')
}

async function readRecent(): Promise<string[]> {
  try {
    const raw = await readFile(recentFilePath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeRecent(paths: string[]): Promise<void> {
  await writeFile(recentFilePath(), JSON.stringify(paths), 'utf-8')
}

async function addToRecent(filePath: string): Promise<void> {
  const recent = await readRecent()
  const updated = [filePath, ...recent.filter(p => p !== filePath)].slice(0, MAX_RECENT)
  await writeRecent(updated)
}

export async function getRecentFiles(): Promise<string[]> {
  return readRecent()
}

export async function openWorkspace(
  win: BrowserWindow
): Promise<{ path: string; workspace: Workspace } | null> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Workspace',
    filters: [{ name: 'WinsLab Workspace', extensions: ['wlab'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null

  const filePath = result.filePaths[0]
  const raw = await readFile(filePath, 'utf-8')
  const workspace: Workspace = JSON.parse(raw)
  await addToRecent(filePath)
  return { path: filePath, workspace }
}

export async function openWorkspaceFromPath(
  filePath: string
): Promise<{ path: string; workspace: Workspace }> {
  const raw = await readFile(filePath, 'utf-8')
  const workspace: Workspace = JSON.parse(raw)
  await addToRecent(filePath)
  return { path: filePath, workspace }
}

export async function saveWorkspace(
  win: BrowserWindow,
  workspace: Workspace,
  existingPath: string | null
): Promise<string | null> {
  let filePath = existingPath

  if (!filePath) {
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Workspace',
      defaultPath: `${workspace.name || 'Untitled'}.wlab`,
      filters: [{ name: 'WinsLab Workspace', extensions: ['wlab'] }]
    })
    if (result.canceled || !result.filePath) return null
    filePath = result.filePath
  }

  await writeFile(filePath, JSON.stringify(workspace, null, 2), 'utf-8')
  await addToRecent(filePath)
  return filePath
}

export async function saveWorkspaceAs(
  win: BrowserWindow,
  workspace: Workspace
): Promise<string | null> {
  return saveWorkspace(win, workspace, null)
}

export function blankWorkspace(name = 'Untitled'): Workspace {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    audioSettings: { outputDeviceId: 'default', sampleRate: 48000, bufferSize: 256 },
    midiSettings: { outputPortName: '', inputPortName: '' },
    cues: []
  }
}
