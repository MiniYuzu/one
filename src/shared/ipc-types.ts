// src/shared/ipc-types.ts

export interface EngineRequest {
  id: string
  type:
    | 'chat:send'
    | 'chat:cancel'
    | 'chat:retry'
    | 'config:update'
    | 'health:check'
  payload: unknown
}

export interface EngineEvent {
  id: string
  type:
    | 'chat:chunk'
    | 'chat:end'
    | 'chat:error'
    | 'state:sync'
    | 'offline:changed'
    | 'engine:ready'
    | 'engine:crashed'
  payload: unknown
}

export interface ChatSendPayload {
  content: string
  model?: string
}

export interface ChatChunkPayload {
  text: string
  messageId: string
}

export interface ChatEndPayload {
  messageId: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface ChatErrorPayload {
  code: string
  message: string
}

export interface OfflineChangedPayload {
  offline: boolean
}

export interface ConfigUpdatePayload {
  baseUrl?: string
  apiKey?: string
  model?: string
  theme?: 'light' | 'dark' | 'system'
}

export interface AppConfig {
  baseUrl: string
  model: string
  theme: 'light' | 'dark' | 'system'
}

// Renderer <-> Main (contextBridge)
export interface MainAPI {
  getAppPath: (name: 'userData' | 'temp' | 'desktop') => Promise<string>
  getEncryptedKey: (service: string) => Promise<string | null>
  setEncryptedKey: (service: string, key: string) => Promise<void>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

// Renderer <-> Engine (MessagePort via preload)
export interface EngineAPI {
  postMessage: (req: EngineRequest) => void
  onMessage: (handler: (evt: EngineEvent) => void) => () => void
}

declare global {
  interface Window {
    mainAPI: MainAPI
    engineAPI: EngineAPI
  }
}
