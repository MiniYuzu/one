// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { EngineRequest, EngineEvent, MainAPI, EngineAPI } from '../shared/ipc-types.js'

const mainAPI: MainAPI = {
  getAppPath: (name) => ipcRenderer.invoke('main:getAppPath', name),
  getEncryptedKey: (service) => ipcRenderer.invoke('main:getEncryptedKey', service),
  setEncryptedKey: (service, key) => ipcRenderer.invoke('main:setEncryptedKey', service, key),
  minimizeWindow: () => ipcRenderer.send('main:minimizeWindow'),
  maximizeWindow: () => ipcRenderer.send('main:maximizeWindow'),
  closeWindow: () => ipcRenderer.send('main:closeWindow'),
  copyText: (text) => ipcRenderer.send('main:copyText', text),
}

let enginePort: MessagePort | null = null
const engineListeners = new Set<(evt: EngineEvent) => void>()

const engineAPI: EngineAPI = {
  postMessage: (req: EngineRequest) => {
    if (enginePort) {
      enginePort.postMessage(req)
    }
  },
  onMessage: (handler) => {
    engineListeners.add(handler)
    return () => {
      engineListeners.delete(handler)
    }
  },
}

// Listen for port transfer from main process
ipcRenderer.on('engine:port', (event) => {
  const port = event.ports[0] as MessagePort
  if (!port) return
  enginePort = port
  port.start()
  port.onmessage = (msgEvent) => {
    const evt = msgEvent.data as EngineEvent
    engineListeners.forEach((fn) => fn(evt))
  }
})

contextBridge.exposeInMainWorld('mainAPI', mainAPI)
contextBridge.exposeInMainWorld('engineAPI', engineAPI)
