// src/main/main.ts
import { app, Menu } from 'electron'
import { createMainWindow, getMainWindow } from './window-manager.js'
import { setupIpcRouter, spawnEngine } from './ipc-router.js'

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

app.whenReady().then(() => {
  if (process.env.NODE_ENV === 'development') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }

  const mainWindow = createMainWindow()
  setupIpcRouter(mainWindow)
  spawnEngine(mainWindow)

  app.on('activate', () => {
    if (getMainWindow() === null) {
      const win = createMainWindow()
      setupIpcRouter(win)
      spawnEngine(win)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('second-instance', () => {
  const win = getMainWindow()
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})
