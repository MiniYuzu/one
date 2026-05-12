// src/main/main.ts
import { app } from 'electron'
import { createMainWindow, getMainWindow } from './window-manager.js'
import { setupIpcRouter, spawnEngine } from './ipc-router.js'

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

app.whenReady().then(() => {
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
