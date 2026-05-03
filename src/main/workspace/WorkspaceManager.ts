import { app, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Workspace } from '../../renderer/src/types/workspace'
import type { Cue } from '../../renderer/src/types/cue'

function migrateCue(cue: Cue & Record<string, unknown>): Cue {
  if (cue.advance === undefined) cue.advance = 'none'
  if (cue.preWait === undefined) cue.preWait = 0
  if (cue.postWait === undefined) cue.postWait = 0
  if (cue.timelineOffset === undefined) cue.timelineOffset = 0
  if (cue.colorLabel === undefined) cue.colorLabel = 'none'
  if (cue.isArmed === undefined) cue.isArmed = true
  if (cue.notes === undefined) cue.notes = ''
  if (cue.parentId === undefined) cue.parentId = null
  delete cue.autoContinue
  delete cue.autoFollow
  return cue
}

function migrateWorkspace(workspace: Workspace): Workspace {
  // Pass 1: normalize all cues
  const cues = workspace.cues.map(c => migrateCue(c as Cue & Record<string, unknown>))

  // Pass 2: convert legacy childIds → parentId
  // Groups that still have childIds haven't been converted yet
  const needsConversion = cues.filter(
    c => c.type === 'group' && Array.isArray((c as Record<string, unknown>).childIds)
  )

  for (const group of needsConversion) {
    const childIds: string[] = (group as Record<string, unknown>).childIds as string[]
    // Mark children with this parentId
    for (const cue of cues) {
      if (childIds.includes(cue.id)) cue.parentId = group.id
    }
    // Reorder: pull children out and re-insert immediately after the group
    const groupIdx = cues.findIndex(c => c.id === group.id)
    const children = childIds
      .map(id => cues.find(c => c.id === id))
      .filter((c): c is Cue => c !== undefined)
    // Remove children from wherever they sit
    for (const child of children) {
      const i = cues.indexOf(child)
      if (i > -1) cues.splice(i, 1)
    }
    // Re-insert after group (group index may have shifted)
    const newGroupIdx = cues.findIndex(c => c.id === group.id)
    cues.splice(newGroupIdx + 1, 0, ...children)
    // Remove the now-obsolete childIds field
    delete (group as Record<string, unknown>).childIds
  }

  workspace.cues = cues
  return workspace
}

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
  const workspace: Workspace = migrateWorkspace(JSON.parse(raw))
  await addToRecent(filePath)
  return { path: filePath, workspace }
}

export async function openWorkspaceFromPath(
  filePath: string
): Promise<{ path: string; workspace: Workspace }> {
  const raw = await readFile(filePath, 'utf-8')
  const workspace: Workspace = migrateWorkspace(JSON.parse(raw))
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
