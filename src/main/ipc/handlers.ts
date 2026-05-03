import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { MidiEngine } from '../midi/MidiEngine'
import { OscEngine } from '../osc/OscEngine'
import {
  openWorkspace,
  openWorkspaceFromPath,
  saveWorkspace,
  saveWorkspaceAs,
  getRecentFiles
} from '../workspace/WorkspaceManager'
import type { Workspace } from '../../renderer/src/types/workspace'

const midi = new MidiEngine()
const osc = new OscEngine()

function getWin(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender)!
}

export function registerIpcHandlers(): void {
  // Audio
  ipcMain.handle('audio:readFile', async (_, filePath: string) => {
    const buf = await readFile(filePath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })

  ipcMain.handle('audio:pickFile', async (event) => {
    const result = await dialog.showOpenDialog(getWin(event), {
      title: 'Select Audio File',
      filters: [
        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aiff'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // MIDI
  ipcMain.handle('midi:listPorts', () => midi.listOutputPorts())

  ipcMain.handle('midi:send', async (_, cmd: { portName: string; messages: any[] }) => {
    midi.send(cmd.portName, cmd.messages)
  })

  // OSC
  ipcMain.handle('osc:send', async (_, cmd: { host: string; port: number; address: string; args: any[] }) => {
    osc.send(cmd.host, cmd.port, cmd.address, cmd.args)
  })

  ipcMain.handle('osc:startListener', async (_, port: number) => {
    osc.startListener(port)
  })

  // Workspace
  ipcMain.handle('workspace:open', async (event) => {
    return openWorkspace(getWin(event))
  })

  ipcMain.handle('workspace:openPath', async (_, filePath: string) => {
    return openWorkspaceFromPath(filePath)
  })

  ipcMain.handle('workspace:save', async (event, workspace: Workspace, existingPath: string | null) => {
    return saveWorkspace(getWin(event), workspace, existingPath)
  })

  ipcMain.handle('workspace:saveAs', async (event, workspace: Workspace) => {
    return saveWorkspaceAs(getWin(event), workspace)
  })

  ipcMain.handle('workspace:recent', async () => {
    return getRecentFiles()
  })

  ipcMain.handle('workspace:setTitle', async (event, title: string) => {
    getWin(event).setTitle(title)
  })

  ipcMain.handle('workspace:confirmClose', async (event, workspaceName: string) => {
    const result = await dialog.showMessageBox(getWin(event), {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Do you want to save changes to "${workspaceName}"?`,
      detail: 'Your changes will be lost if you don\'t save them.'
    })
    return result.response // 0=save, 1=don't save, 2=cancel
  })
}
