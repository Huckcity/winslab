import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'WinsLab',
      submenu: [
        {
          label: `About WinsLab`,
          click: () => {
            app.showAboutPanel()
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'WinsLab',
    backgroundColor: '#181818',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Intercept close and ask the renderer to run the dirty check.
  // The renderer calls app:confirm-close when it's safe to proceed.
  let allowClose = false
  win.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    win.webContents.send('app:close-requested')
  })

  ipcMain.removeHandler('app:confirm-close')
  ipcMain.handle('app:confirm-close', () => {
    allowClose = true
    win.close()
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.on('console-message', (_, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.winslab')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  
  // Set up about panel with current version
  app.setAboutPanelOptions({
    applicationName: 'WinsLab',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026'
  })
  
  createMenu()
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
