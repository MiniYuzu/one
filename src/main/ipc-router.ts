// src/main/ipc-router.ts
import { ipcMain, utilityProcess, MessageChannelMain, safeStorage, app, clipboard } from 'electron'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'

let engineProcess: Electron.UtilityProcess | null = null
let enginePort: Electron.MessagePortMain | null = null

export function setupIpcRouter(mainWindow: BrowserWindow): void {
  // Main API handlers
  ipcMain.handle('main:getAppPath', (_, name: 'userData' | 'temp' | 'desktop') => {
    return app.getPath(name)
  })

  ipcMain.handle('main:getEncryptedKey', async (_, service: string) => {
    try {
      const { default: Store } = await import('electron-store')
      const store = new Store({ name: 'secrets' })
      const encryptedBase64 = store.get(service, '') as string
      if (!encryptedBase64) return null
      const decrypted = safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'))
      return decrypted
    } catch {
      return null
    }
  })

  ipcMain.handle('main:setEncryptedKey', async (_, service: string, key: string) => {
    const encrypted = safeStorage.encryptString(key)
    const { default: Store } = await import('electron-store')
    const store = new Store({ name: 'secrets' })
    store.set(service, encrypted.toString('base64'))
  })

  ipcMain.on('main:copyText', (_, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.on('main:minimizeWindow', () => mainWindow.minimize())
  ipcMain.on('main:maximizeWindow', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('main:closeWindow', () => mainWindow.close())
}

export function spawnEngine(mainWindow: BrowserWindow): Electron.UtilityProcess {
  const enginePath = path.join(__dirname, 'engine.cjs')
  engineProcess = utilityProcess.fork(enginePath, [], {
    serviceName: 'one-engine',
    stdio: 'pipe',
    env: {
      ...process.env,
      ONE_CONFIG_PATH: path.join(app.getPath('userData'), 'config.json'),
    },
  })

  // Forward engine stdout/stderr to main process console
  engineProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[Engine] ${data}`)
  })
  engineProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[Engine] ${data}`)
  })

  const { port1, port2 } = new MessageChannelMain()
  enginePort = port1

  // Forward port2 to renderer
  // Race-condition guard: the window may already have finished loading
  // before spawnEngine() is called (common in dev/HMR).
  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.postMessage('engine:port', null, [port2])
    })
  } else {
    mainWindow.webContents.postMessage('engine:port', null, [port2])
  }

  // Forward renderer messages to engine
  port1.on('message', (event) => {
    engineProcess?.postMessage(event.data)
  })
  port1.start()

  // Forward engine messages to renderer + sync apiKey on ready
  engineProcess.on('message', async (msg: unknown) => {
    port1.postMessage(msg)
    const typed = msg as { type?: string }
    if (typed.type === 'engine:ready') {
      try {
        const { default: Store } = await import('electron-store')
        const store = new Store({ name: 'secrets' })
        const encryptedBase64 = store.get('llm', '') as string
        if (encryptedBase64) {
          const decrypted = safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'))
          engineProcess?.postMessage({
            id: randomUUID(),
            type: 'config:update',
            payload: { apiKey: decrypted },
          })
        }
      } catch {
        // ignore missing key or decryption failure
      }
    }
  })

  engineProcess.on('exit', (code) => {
    console.error(`Engine exited with code ${code}`)
    // Notify renderer
    port1.postMessage({
      id: randomUUID(),
      type: 'engine:crashed',
      payload: { code },
    })
    // Respawn after 2s
    setTimeout(() => spawnEngine(mainWindow), 2000)
  })

  return engineProcess
}

export function getEngineProcess(): Electron.UtilityProcess | null {
  return engineProcess
}
