/// <reference types="vite/client" />

import type { OscArg } from './types/cue'
import type { Workspace } from './types/workspace'

interface WinslabBridge {
  getPathForFile: (file: File) => string
  audio: {
    readFile: (filePath: string) => Promise<ArrayBuffer>
    pickFile: () => Promise<string | null>
  }
  midi: {
    listPorts: () => Promise<string[]>
    send: (cmd: { portName: string; messages: any[] }) => Promise<void>
  }
  osc: {
    send: (cmd: { host: string; port: number; address: string; args: OscArg[] }) => Promise<void>
    startListener: (port: number) => Promise<void>
  }
  workspace: {
    open: () => Promise<{ path: string; workspace: Workspace } | null>
    openPath: (filePath: string) => Promise<{ path: string; workspace: Workspace }>
    save: (workspace: Workspace, existingPath: string | null) => Promise<string | null>
    saveAs: (workspace: Workspace) => Promise<string | null>
    recent: () => Promise<string[]>
    setTitle: (title: string) => Promise<void>
    confirmClose: (workspaceName: string) => Promise<0 | 1 | 2>
  }
}

declare global {
  interface Window {
    winslab: WinslabBridge
  }
}
