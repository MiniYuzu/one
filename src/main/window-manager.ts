// src/main/window-manager.ts
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'

let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width * 0.85),
    height: Math.min(800, height * 0.85),
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Load renderer URL (HMR in dev, file:// in production)
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (process.env.NODE_ENV === 'development') {
      mainWindow?.webContents.openDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
