// src/preload/types.d.ts
import type { MainAPI, EngineAPI } from '../shared/ipc-types.js'

declare global {
  interface Window {
    mainAPI: MainAPI
    engineAPI: EngineAPI
  }
}

export {}
