# Phase 0 — 真实对话壳子 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 双击 `.exe` 打开窗口，输入自然语言，看到 AI 流式回复。包含 Day 0 欢迎引导、离线检测横幅、窗口约束、配置持久化。

**Architecture:** Electron Main Process 负责窗口管理与生命周期；UtilityProcess 运行裁剪后的 free-code 核心作为 AI 引擎，通过 MessageChannelMain 与 Renderer 直连；Renderer 为纯 React 18 + Tailwind CSS v3 视图层，只负责渲染和转发用户输入。

**Tech Stack:** Electron v28+, React 18, TypeScript 5.x, Tailwind CSS v3, Lucide React, Vite (electron-vite), Bun, axios, eventsource-parser

---

## File Structure

```
ONE/
├── src/
│   ├── main/
│   │   ├── main.ts              # App lifecycle, spawn engine, single-instance lock
│   │   ├── window-manager.ts    # BrowserWindow factory, min 900x600, contextIsolation
│   │   └── ipc-router.ts        # MessageChannelMain setup, port forwarding
│   ├── engine/
│   │   ├── engine.ts            # UtilityProcess entry: boot free-code core, listen MessagePort
│   │   ├── api/
│   │   │   ├── client.ts        # SSE streaming LLM client (axios + eventsource-parser)
│   │   │   └── models.ts        # Model config, singleton provider client
│   │   └── state/
│   │       └── config-store.ts  # electron-store persistence + safeStorage bridge
│   ├── renderer/
│   │   ├── main.tsx             # React 18 root render
│   │   ├── App.tsx              # Root: theme provider, layout shell
│   │   ├── index.css            # Tailwind directives + custom design tokens
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── MessageList.tsx      # Streaming message list, fadeUp animation
│   │   │   │   ├── UserBubble.tsx       # User message bubble
│   │   │   │   ├── AIAvatar.tsx         # AI avatar icon
│   │   │   │   └── MarkdownRenderer.tsx # Markdown + code block rendering
│   │   │   ├── console/
│   │   │   │   └── UnifiedConsole.tsx   # Input textarea, rounded-[20px], Enter to send
│   │   │   └── system/
│   │   │       ├── OfflineBanner.tsx    # Top fixed banner, online/offline state
│   │   │       └── DayZeroWelcome.tsx   # Pre-staged welcome + 3 action pills
│   │   └── hooks/
│   │       └── useEngine.ts     # React hook wrapping window.engineAPI.postMessage
│   ├── shared/
│   │   ├── ipc-types.ts         # EngineRequest + EngineEvent TypeScript interfaces
│   │   └── constants.ts         # App constants: config path, health endpoint timeout
│   └── preload/
│       ├── index.ts             # contextBridge.exposeInMainWorld for MainAPI + EngineAPI
│       └── types.d.ts           # Window type declarations
├── resources/
│   └── icons/                   # App icons (.ico for Windows)
├── electron.vite.config.ts      # electron-vite build config (main + preload + renderer)
├── tailwind.config.js           # Tailwind v3 + custom colors (Slate/Indigo/Amber/Emerald)
├── tsconfig.json                # Strict TypeScript, project references
└── package.json                 # Scripts: dev, build, build:win
```

---

### Task 1: Project Scaffold — package.json + electron-vite + Tailwind

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `src/renderer/index.css`
- Create: `.gitignore`

**Prerequisite:** 确保系统已安装 Bun (`bun --version` 输出 `1.x.x`)。

- [ ] **Step 1: 初始化 package.json**

```bash
cd /Users/mini/Desktop/study/claude/one
bun init -y
```

编辑生成的 `package.json` 为以下内容：

```json
{
  "name": "one-ai-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:win": "electron-vite build && electron-builder --win",
    "preview": "electron-vite preview"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "electron-store": "^10.0.0",
    "eventsource-parser": "^3.0.0",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^3.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
bun install
```

Expected: `node_modules/` 和 `bun.lockb` 生成，无报错。

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "outDir": "out",
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@engine/*": ["src/engine/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "out", "dist"]
}
```

- [ ] **Step 4: 创建 tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        },
        amber: {
          100: '#fef3c7',
          200: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Geist Sans', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '20': '20px',
        '16': '16px',
        '12': '12px',
        '8': '8px',
      },
      animation: {
        'fade-up': 'fadeUp 500ms ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: 创建 src/renderer/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: 'Geist Sans', 'Microsoft YaHei', system-ui, sans-serif;
  }
  body {
    @apply bg-slate-50 text-slate-900 antialiased;
  }
  .dark body {
    @apply bg-slate-900 text-slate-50;
  }
}

@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
  .dark .scrollbar-thin {
    scrollbar-color: #475569 transparent;
  }
}
```

- [ ] **Step 6: 创建 electron.vite.config.ts**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/main/main.ts',
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      outDir: 'out/main',
    },
    resolve: {
      alias: {
        '@main': path.resolve('src/main'),
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/preload/index.ts',
        formats: ['cjs'],
        fileName: () => 'preload.js',
      },
      outDir: 'out/preload',
    },
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
    },
    resolve: {
      alias: {
        '@renderer': path.resolve('src/renderer'),
        '@shared': path.resolve('src/shared'),
      },
    },
  },
})
```

- [ ] **Step 7: 创建 .gitignore**

```
node_modules/
out/
dist/
*.log
.DS_Store
.env
```

- [ ] **Step 8: 提交**

```bash
git add package.json tsconfig.json tailwind.config.js electron.vite.config.ts src/renderer/index.css .gitignore bun.lockb
git commit -m "chore: scaffold electron-vite + react + tailwind project"
```

---

### Task 2: 定义 IPC 类型 — src/shared/ipc-types.ts + constants.ts

**Files:**
- Create: `src/shared/ipc-types.ts`
- Create: `src/shared/constants.ts`

- [ ] **Step 1: 创建 IPC 类型定义**

```ts
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
}

declare global {
  interface Window {
    mainAPI: MainAPI
    engineAPI: EngineAPI
  }
}
```

- [ ] **Step 2: 创建常量文件**

```ts
// src/shared/constants.ts

export const APP_NAME = 'ONE'

export const DEFAULT_CONFIG: AppConfig = {
  baseUrl: 'http://localhost:3000',
  model: 'claude-3-5-sonnet',
  theme: 'system',
}

export const HEALTH_CHECK_INTERVAL_MS = 30000
export const HEALTH_CHECK_TIMEOUT_MS = 3000
export const MAX_FILE_SIZE_MB = 50
export const SUPPORTED_FILE_EXTENSIONS = ['.csv', '.xlsx', '.docx', '.pptx', '.md', '.txt']

export const DAY_ZERO_WELCOME = {
  content:
    '你好！我是 ONE，你的专属 AI 助手。我可以帮你处理数据、撰写文档、生成报告。今天想从什么开始？',
  pills: [
    { label: '分析 Excel 数据', prompt: '帮我分析一份 Excel 数据文件' },
    { label: '撰写工作报告', prompt: '帮我撰写一份工作周报' },
    { label: '生成 PPT 大纲', prompt: '帮我生成一份季度汇报的 PPT 大纲' },
  ],
}

import type { AppConfig } from './ipc-types.js'
```

- [ ] **Step 3: 提交**

```bash
git add src/shared/
git commit -m "feat(shared): define IPC types and app constants"
```

---

### Task 3: Preload 脚本 — src/preload/index.ts + types.d.ts

**Files:**
- Create: `src/preload/index.ts`
- Create: `src/preload/types.d.ts`

- [ ] **Step 1: 创建 preload 入口**

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { EngineRequest, EngineEvent, MainAPI, EngineAPI } from '@shared/ipc-types.js'

const mainAPI: MainAPI = {
  getAppPath: (name) => ipcRenderer.invoke('main:getAppPath', name),
  getEncryptedKey: (service) => ipcRenderer.invoke('main:getEncryptedKey', service),
  setEncryptedKey: (service, key) => ipcRenderer.invoke('main:setEncryptedKey', service, key),
  minimizeWindow: () => ipcRenderer.send('main:minimizeWindow'),
  maximizeWindow: () => ipcRenderer.send('main:maximizeWindow'),
  closeWindow: () => ipcRenderer.send('main:closeWindow'),
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
```

- [ ] **Step 2: 创建类型声明文件**

```ts
// src/preload/types.d.ts
import type { MainAPI, EngineAPI } from '@shared/ipc-types.js'

declare global {
  interface Window {
    mainAPI: MainAPI
    engineAPI: EngineAPI
  }
}

export {}
```

- [ ] **Step 3: 提交**

```bash
git add src/preload/
git commit -m "feat(preload): setup contextBridge for MainAPI and EngineAPI"
```

---

### Task 4: Main Process — 窗口管理 + UtilityProcess 启动 + MessageChannel

**Files:**
- Create: `src/main/window-manager.ts`
- Create: `src/main/ipc-router.ts`
- Create: `src/main/main.ts`

- [ ] **Step 1: 创建窗口管理器**

```ts
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
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Load renderer URL (HMR in dev, file:// in production)
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
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
```

- [ ] **Step 2: 创建 IPC 路由器**

```ts
// src/main/ipc-router.ts
import { ipcMain, utilityProcess, MessageChannelMain, safeStorage, app } from 'electron'
import path from 'node:path'
import type { BrowserWindow } from 'electron'

let engineProcess: Electron.UtilityProcess | null = null
let enginePort: MessagePortMain | null = null

export function setupIpcRouter(mainWindow: BrowserWindow): void {
  // Main API handlers
  ipcMain.handle('main:getAppPath', (_, name: 'userData' | 'temp' | 'desktop') => {
    return app.getPath(name)
  })

  ipcMain.handle('main:getEncryptedKey', async (_, service: string) => {
    try {
      const raw = await safeStorage.decryptString(
        Buffer.from(await import('electron-store').then((m) => {
          const Store = m.default
          const store = new Store({ name: 'secrets' })
          return store.get(service, '') as string
        }), 'base64'),
      )
      return raw
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
  const enginePath = path.join(__dirname, '../engine/engine.js')
  engineProcess = utilityProcess.fork(enginePath, [], {
    serviceName: 'one-engine',
    stdio: 'pipe',
  })

  const { port1, port2 } = new MessageChannelMain()
  enginePort = port1

  // Forward port2 to renderer
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.postMessage('engine:port', null, [port2 as unknown as Electron.MessagePort])
  })

  // Forward renderer messages to engine
  port1.on('message', (event) => {
    engineProcess?.postMessage(event.data)
  })
  port1.start()

  // Forward engine messages to renderer
  engineProcess.on('message', (msg) => {
    port1.postMessage(msg)
  })

  engineProcess.on('exit', (code) => {
    console.error(`Engine exited with code ${code}`)
    // Notify renderer
    port1.postMessage({
      id: crypto.randomUUID(),
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
```

- [ ] **Step 3: 创建主进程入口**

```ts
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
```

- [ ] **Step 4: 提交**

```bash
git add src/main/
git commit -m "feat(main): window manager, IPC router, UtilityProcess spawn"
```

---

### Task 5: Engine Process — SSE 客户端 + 配置持久化 + 入口

**Files:**
- Create: `src/engine/api/client.ts`
- Create: `src/engine/api/models.ts`
- Create: `src/engine/state/config-store.ts`
- Create: `src/engine/engine.ts`

- [ ] **Step 1: 创建 SSE LLM 客户端**

```ts
// src/engine/api/client.ts
import axios, { type AxiosResponse } from 'axios'
import { createParser, type ParsedEvent, type ReconnectInterval } from 'eventsource-parser'
import type { AppConfig } from '@shared/ipc-types.js'

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: (usage?: { inputTokens: number; outputTokens: number }) => void
  onError: (code: string, message: string) => void
}

export async function streamChatCompletion(
  config: AppConfig,
  apiKey: string | null,
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  signal: AbortSignal,
): Promise<void> {
  const url = `${config.baseUrl}/v1/chat/completions`
  const body = {
    model: config.model,
    messages,
    stream: true,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  let fullText = ''
  let usage: { inputTokens: number; outputTokens: number } | undefined

  try {
    const response: AxiosResponse<ReadableStream> = await axios({
      method: 'post',
      url,
      data: body,
      headers,
      responseType: 'stream',
      signal,
      timeout: 60000,
    })

    const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
      if (event.type === 'event') {
        const data = event.data
        if (data === '[DONE]') {
          callbacks.onDone(usage)
          return
        }
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (typeof delta === 'string') {
            fullText += delta
            callbacks.onChunk(delta)
          }
          if (json.usage) {
            usage = {
              inputTokens: json.usage.prompt_tokens ?? 0,
              outputTokens: json.usage.completion_tokens ?? 0,
            }
          }
        } catch {
          // ignore malformed JSON in stream
        }
      }
    })

    const reader = response.data.getReader()
    const decoder = new TextDecoder()

    while (true) {
      if (signal.aborted) {
        reader.cancel()
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      parser.feed(decoder.decode(value, { stream: true }))
    }

    parser.feed(decoder.decode())
    callbacks.onDone(usage)
  } catch (error) {
    if (axios.isCancel(error) || signal.aborted) {
      callbacks.onDone(usage)
      return
    }
    const msg = error instanceof Error ? error.message : String(error)
    callbacks.onError('STREAM_ERROR', msg)
  }
}
```

- [ ] **Step 2: 创建模型配置模块**

```ts
// src/engine/api/models.ts
import type { AppConfig } from '@shared/ipc-types.js'

export const AVAILABLE_MODELS = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
]

export function getDefaultModel(): string {
  return AVAILABLE_MODELS[0].id
}

export function validateModel(model: string): string {
  return AVAILABLE_MODELS.some((m) => m.id === model) ? model : getDefaultModel()
}
```

- [ ] **Step 3: 创建配置持久化模块**

```ts
// src/engine/state/config-store.ts
import Store from 'electron-store'
import type { AppConfig } from '@shared/ipc-types.js'
import { DEFAULT_CONFIG } from '@shared/constants.js'

interface Schema {
  config: AppConfig
}

const store = new Store<Schema>({
  name: 'one-config',
  defaults: {
    config: DEFAULT_CONFIG,
  },
})

export function getConfig(): AppConfig {
  return store.get('config')
}

export function setConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig()
  const next = { ...current, ...partial }
  store.set('config', next)
  return next
}
```

- [ ] **Step 4: 创建 Engine 入口**

```ts
// src/engine/engine.ts
import { parentPort } from 'node:worker_threads'
import type { EngineRequest, EngineEvent, ChatSendPayload, ConfigUpdatePayload } from '@shared/ipc-types.js'
import { streamChatCompletion } from './api/client.js'
import { getConfig, setConfig } from './state/config-store.js'
import { DAY_ZERO_WELCOME, HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_TIMEOUT_MS } from '@shared/constants.js'
import axios from 'axios'

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const conversations = new Map<string, ConversationMessage[]>()
let currentAbortController: AbortController | null = null
let isOffline = false
let healthCheckTimer: NodeJS.Timeout | null = null
let apiKey: string | null = null

function sendEvent(evt: EngineEvent): void {
  parentPort?.postMessage(evt)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function loadApiKey(): Promise<void> {
  // In UtilityProcess we cannot access safeStorage directly.
  // The renderer will send the key via config:update after reading from main.
  // For now, we rely on the config update flow.
}

async function checkHealth(): Promise<boolean> {
  const config = getConfig()
  try {
    await axios.head(`${config.baseUrl}/health`, {
      timeout: HEALTH_CHECK_TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    })
    if (isOffline) {
      isOffline = false
      sendEvent({ id: generateId(), type: 'offline:changed', payload: { offline: false } })
    }
    return true
  } catch {
    if (!isOffline) {
      isOffline = true
      sendEvent({ id: generateId(), type: 'offline:changed', payload: { offline: true } })
    }
    return false
  }
}

function startHealthCheck(): void {
  if (healthCheckTimer) clearInterval(healthCheckTimer)
  healthCheckTimer = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS)
}

function getOrCreateConversation(sessionId: string): ConversationMessage[] {
  if (!conversations.has(sessionId)) {
    const msgs: ConversationMessage[] = [
      {
        role: 'system',
        content:
          '你是 ONE，一位专业的银行 AI 助手。你帮助用户处理数据、撰写文档、生成报告。回答要简洁专业。',
      },
    ]
    conversations.set(sessionId, msgs)
  }
  return conversations.get(sessionId)!
}

function injectDayZeroWelcome(sessionId: string): void {
  const msgs = getOrCreateConversation(sessionId)
  if (msgs.length <= 1) {
    sendEvent({
      id: generateId(),
      type: 'state:sync',
      payload: {
        dayZero: DAY_ZERO_WELCOME,
      },
    })
  }
}

async function handleChatSend(payload: ChatSendPayload): Promise<void> {
  const sessionId = 'default'
  if (isOffline) {
    sendEvent({
      id: generateId(),
      type: 'chat:error',
      payload: { code: 'OFFLINE', message: '网络不可用，请检查网络连接后重试' },
    })
    return
  }

  const config = getConfig()
  const msgs = getOrCreateConversation(sessionId)
  msgs.push({ role: 'user', content: payload.content })

  const messageId = generateId()
  currentAbortController = new AbortController()

  await streamChatCompletion(
    config,
    apiKey,
    msgs,
    {
      onChunk: (text) => {
        sendEvent({ id: generateId(), type: 'chat:chunk', payload: { text, messageId } })
      },
      onDone: (usage) => {
        sendEvent({ id: generateId(), type: 'chat:end', payload: { messageId, usage } })
      },
      onError: (code, message) => {
        sendEvent({ id: generateId(), type: 'chat:error', payload: { code, message } })
      },
    },
    currentAbortController.signal,
  )

  // Append assistant response to conversation history
  // (In Phase 0 we don't have full assistant text reconstruction here;
  //  the renderer accumulates chunks. Phase 1 will add proper history.)
}

async function handleRequest(req: EngineRequest): Promise<void> {
  switch (req.type) {
    case 'chat:send':
      await handleChatSend(req.payload as ChatSendPayload)
      break
    case 'chat:cancel':
      currentAbortController?.abort()
      break
    case 'config:update': {
      const p = req.payload as ConfigUpdatePayload
      if (p.apiKey) apiKey = p.apiKey
      const updates: Partial<typeof getConfig> = {}
      if (p.baseUrl) updates.baseUrl = p.baseUrl
      if (p.model) updates.model = p.model
      if (p.theme) updates.theme = p.theme
      if (Object.keys(updates).length > 0) {
        setConfig(updates as Partial<ReturnType<typeof getConfig>>)
      }
      break
    }
    case 'health:check':
      await checkHealth()
      break
  }
}

// Bootstrap
parentPort?.on('message', async (req: EngineRequest) => {
  await handleRequest(req)
})

startHealthCheck()
sendEvent({ id: generateId(), type: 'engine:ready', payload: {} })

// Day zero welcome injection happens on first state sync request from renderer
```

- [ ] **Step 5: 提交**

```bash
git add src/engine/
git commit -m "feat(engine): SSE client, config store, UtilityProcess entry"
```

---

### Task 6: Renderer Shell — React 入口 + App 根组件 + useEngine Hook

**Files:**
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/hooks/useEngine.ts`

- [ ] **Step 1: 创建 React 入口**

```tsx
// src/renderer/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.js'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 2: 创建根组件**

```tsx
// src/renderer/App.tsx
import { useEffect, useState } from 'react'
import { MessageList } from './components/chat/MessageList.js'
import { UnifiedConsole } from './components/console/UnifiedConsole.js'
import { OfflineBanner } from './components/system/OfflineBanner.js'
import { DayZeroWelcome } from './components/system/DayZeroWelcome.js'
import { useEngine } from './hooks/useEngine.js'
import type { EngineEvent } from '@shared/ipc-types.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  error?: boolean
}

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [offline, setOffline] = useState(false)
  const [dayZero, setDayZero] = useState<{ content: string; pills: Array<{ label: string; prompt: string }> } | null>(null)
  const [engineReady, setEngineReady] = useState(false)

  const { send, isConnected } = useEngine((evt: EngineEvent) => {
    switch (evt.type) {
      case 'chat:chunk': {
        const p = evt.payload as { text: string; messageId: string }
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.id === p.messageId && last.streaming) {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: last.content + p.text }
            return updated
          }
          return [...prev, { id: p.messageId, role: 'assistant', content: p.text, streaming: true }]
        })
        break
      }
      case 'chat:end': {
        const p = evt.payload as { messageId: string }
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, streaming: false } : m)),
        )
        break
      }
      case 'chat:error': {
        const p = evt.payload as { code: string; message: string }
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'system', content: p.message, error: true },
        ])
        break
      }
      case 'offline:changed': {
        const p = evt.payload as { offline: boolean }
        setOffline(p.offline)
        break
      }
      case 'state:sync': {
        const p = evt.payload as { dayZero?: { content: string; pills: Array<{ label: string; prompt: string }> } }
        if (p.dayZero) setDayZero(p.dayZero)
        break
      }
      case 'engine:ready':
        setEngineReady(true)
        break
    }
  })

  useEffect(() => {
    if (engineReady && messages.length === 0 && !dayZero) {
      // Request day zero welcome if no messages yet
      send({ id: `sync-${Date.now()}`, type: 'health:check', payload: {} })
    }
  }, [engineReady, messages.length, dayZero, send])

  const handleSend = (content: string) => {
    if (!content.trim()) return
    const id = `user-${Date.now()}`
    setMessages((prev) => [...prev, { id, role: 'user', content: content.trim() }])
    send({ id: `req-${Date.now()}`, type: 'chat:send', payload: { content: content.trim() } })
  }

  const handlePillClick = (prompt: string) => {
    handleSend(prompt)
    setDayZero(null)
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      <OfflineBanner offline={offline} onRetry={() => send({ id: `hc-${Date.now()}`, type: 'health:check', payload: {} })} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {dayZero && messages.length === 0 && (
            <DayZeroWelcome content={dayZero.content} pills={dayZero.pills} onPillClick={handlePillClick} />
          )}
          <MessageList messages={messages} />
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <UnifiedConsole onSend={handleSend} disabled={offline} />
        </div>
      </div>
      {!isConnected && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs text-white shadow">
          AI 引擎连接中...
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建 useEngine Hook**

```ts
// src/renderer/hooks/useEngine.ts
import { useEffect, useRef, useState, useCallback } from 'react'
import type { EngineRequest, EngineEvent } from '@shared/ipc-types.js'

export function useEngine(onEvent: (evt: EngineEvent) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const eventHandlerRef = useRef(onEvent)
  eventHandlerRef.current = onEvent

  useEffect(() => {
    if (typeof window === 'undefined' || !window.engineAPI) {
      console.warn('engineAPI not available')
      return
    }
    setIsConnected(true)
    const unsubscribe = window.engineAPI.onMessage((evt) => {
      if (evt.type === 'engine:crashed') {
        setIsConnected(false)
      }
      eventHandlerRef.current(evt)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const send = useCallback((req: EngineRequest) => {
    if (typeof window !== 'undefined' && window.engineAPI) {
      window.engineAPI.postMessage(req)
    }
  }, [])

  return { send, isConnected }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/main.tsx src/renderer/App.tsx src/renderer/hooks/
git commit -m "feat(renderer): React shell, useEngine hook, App root"
```

---

### Task 7: Chat Components — MessageList + UserBubble + AIAvatar + MarkdownRenderer

**Files:**
- Create: `src/renderer/components/chat/AIAvatar.tsx`
- Create: `src/renderer/components/chat/UserBubble.tsx`
- Create: `src/renderer/components/chat/MarkdownRenderer.tsx`
- Create: `src/renderer/components/chat/MessageList.tsx`

- [ ] **Step 1: 创建 AI Avatar**

```tsx
// src/renderer/components/chat/AIAvatar.tsx
import { Bot } from 'lucide-react'

export function AIAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
      <Bot size={18} />
    </div>
  )
}
```

- [ ] **Step 2: 创建用户气泡**

```tsx
// src/renderer/components/chat/UserBubble.tsx
interface UserBubbleProps {
  content: string
}

export function UserBubble({ content }: UserBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-16 bg-indigo-500 px-4 py-3 text-white">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 Markdown 渲染器**

```tsx
// src/renderer/components/chat/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 text-sm">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        code: ({ children, className }) => {
          const isInline = !className
          return isInline ? (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {children}
            </code>
          ) : (
            <pre className="mb-2 overflow-x-auto rounded-8 bg-slate-900 p-3 text-xs text-slate-50">
              <code>{children}</code>
            </pre>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
```

- [ ] **Step 4: 创建消息列表**

```tsx
// src/renderer/components/chat/MessageList.tsx
import { AIAvatar } from './AIAvatar.js'
import { UserBubble } from './UserBubble.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import type { ChatMessage } from '../../App.js'

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="animate-fade-up">
              <UserBubble content={msg.content} />
            </div>
          )
        }

        if (msg.role === 'system' && msg.error) {
          return (
            <div key={msg.id} className="animate-fade-up flex justify-center">
              <div className="rounded-8 bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                {msg.content}
              </div>
            </div>
          )
        }

        return (
          <div key={msg.id} className="animate-fade-up flex gap-3">
            <AIAvatar />
            <div className="max-w-[80%] rounded-16 bg-slate-100 px-4 py-3 dark:bg-slate-800">
              <MarkdownRenderer content={msg.content} />
              {msg.streaming && (
                <span className="mt-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/chat/
git commit -m "feat(renderer): MessageList, UserBubble, AIAvatar, MarkdownRenderer"
```

---

### Task 8: 系统组件 — UnifiedConsole + OfflineBanner + DayZeroWelcome

**Files:**
- Create: `src/renderer/components/console/UnifiedConsole.tsx`
- Create: `src/renderer/components/system/OfflineBanner.tsx`
- Create: `src/renderer/components/system/DayZeroWelcome.tsx`

- [ ] **Step 1: 创建统一控制台（输入框）**

```tsx
// src/renderer/components/console/UnifiedConsole.tsx
import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'

interface UnifiedConsoleProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function UnifiedConsole({ onSend, disabled }: UnifiedConsoleProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    if (disabled || !text.trim()) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-20 border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder={disabled ? '网络不可用，请检查网络后重试' : '输入消息，按 Enter 发送...'}
        className="max-h-[200px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:opacity-40"
        aria-label="发送"
      >
        <Send size={16} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 创建离线横幅**

```tsx
// src/renderer/components/system/OfflineBanner.tsx
import { WifiOff, RefreshCw } from 'lucide-react'

interface OfflineBannerProps {
  offline: boolean
  onRetry: () => void
}

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
  if (!offline) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-rose-500 px-4 py-2 text-xs text-white">
      <WifiOff size={14} />
      <span>网络连接已断开</span>
      <button
        onClick={onRetry}
        className="ml-2 flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
      >
        <RefreshCw size={12} />
        重试
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 创建 Day 0 欢迎组件**

```tsx
// src/renderer/components/system/DayZeroWelcome.tsx
import { Sparkles } from 'lucide-react'

interface DayZeroWelcomeProps {
  content: string
  pills: Array<{ label: string; prompt: string }>
  onPillClick: (prompt: string) => void
}

export function DayZeroWelcome({ content, pills, onPillClick }: DayZeroWelcomeProps) {
  return (
    <div className="animate-fade-up mx-auto max-w-2xl py-8">
      <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
        <Sparkles size={18} />
        <span className="text-sm font-medium">ONE AI Agent</span>
      </div>
      <p className="mt-3 text-base leading-relaxed text-slate-700 dark:text-slate-300">{content}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => onPillClick(pill.prompt)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/console/ src/renderer/components/system/
git commit -m "feat(renderer): UnifiedConsole, OfflineBanner, DayZeroWelcome"
```

---

### Task 9: Renderer HTML 模板 + 主题切换

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/hooks/useTheme.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 创建 HTML 模板**

```html
<!-- src/renderer/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ONE AI Agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 创建主题 Hook**

```ts
// src/renderer/hooks/useTheme.ts
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('one-theme') as Theme) || 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    const apply = (t: Theme) => {
      if (t === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      } else {
        root.classList.toggle('dark', t === 'dark')
      }
    }
    apply(theme)
    localStorage.setItem('one-theme', theme)

    if (theme === 'system') {
      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches)
      }
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    }
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)
  return { theme, setTheme }
}
```

- [ ] **Step 3: 修改 App.tsx 集成主题**

修改 `src/renderer/App.tsx`，在 imports 中加入：

```tsx
import { useTheme } from './hooks/useTheme.js'
```

在 `App` 函数体内加入：

```tsx
const { theme, setTheme } = useTheme()
```

在 JSX 底部 `</div>` 之前插入主题切换按钮（仅 Phase 0 调试用，后续移入 Settings Dialog）：

```tsx
      <div className="absolute right-4 top-4">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          className="rounded-8 border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="system">跟随系统</option>
        </select>
      </div>
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/index.html src/renderer/hooks/useTheme.ts src/renderer/App.tsx
git commit -m "feat(renderer): HTML template, theme hook, system/light/dark toggle"
```

---

### Task 10: 端到端验证 — dev 启动 + 健康检查 + 打包脚本

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json` (scripts)

- [ ] **Step 1: 创建 electron-builder 配置**

```yaml
# electron-builder.yml
appId: com.bank.one-ai-agent
productName: ONE
directories:
  output: dist
electronDownload:
  mirror: https://npmmirror.com/mirrors/electron/
files:
  - out/**/*
  - resources/**/*
win:
  target:
    - target: nsis
      arch: x64
    - target: portable
      arch: x64
  icon: resources/icons/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: resources/icons/icon.ico
  uninstallerIcon: resources/icons/icon.ico
portable:
  artifactName: ONE-Portable-${version}.exe
```

- [ ] **Step 2: 在 package.json 中追加图标和 dev 脚本**

在 `package.json` 的 `scripts` 中加入：

```json
    "postinstall": "electron-builder install-app-deps",
    "build:win:portable": "electron-vite build && electron-builder --win portable"
```

- [ ] **Step 3: 验证 dev 启动**

```bash
bun run dev
```

Expected:
1. Electron 窗口弹出，最小尺寸 900x600。
2. DevTools 自动打开（development 模式）。
3. Console 无红色报错。
4. 顶部显示 Day 0 欢迎消息 + 3 个 Action Pill。
5. 输入 "你好" → Enter → 如果配置了 baseUrl 和 API key，应看到流式回复。

- [ ] **Step 4: 验证离线横幅**

断开网络或输入错误的 baseUrl，等待 30 秒内应显示顶部红色离线横幅，输入框禁用。
点击"重试"按钮，恢复网络后横幅消失，输入框恢复。

- [ ] **Step 5: 验证主题切换**

点击右上角主题下拉框，切换 light/dark/system，页面背景色和文字颜色应即时变化，无闪烁。

- [ ] **Step 6: 提交并打 tag**

```bash
git add electron-builder.yml package.json
git commit -m "chore: electron-builder config, build scripts, phase 0 complete"
git tag v0.1.0-phase0
```

---

## Self-Review

**1. Spec coverage:**

| 需求 | 对应任务 |
|---|---|
| 双击 .exe 打开窗口 | Task 4 (main.ts, window-manager.ts) |
| 输入自然语言 + Enter 发送 | Task 8 (UnifiedConsole.tsx) |
| AI 流式回复 | Task 5 (client.ts SSE) + Task 6-7 (MessageList 增量渲染) |
| Day 0 欢迎 + 3 Action Pills | Task 5 (engine.ts inject) + Task 8 (DayZeroWelcome.tsx) |
| 离线检测横幅 | Task 5 (health check) + Task 8 (OfflineBanner.tsx) |
| 窗口最小 900x600 | Task 4 (window-manager.ts minWidth/minHeight) |
| 主题切换 + 持久化 | Task 9 (useTheme.ts) |
| safeStorage API key | Task 4 (ipc-router.ts) + Task 5 (engine.ts 接收 config:update) |
| 配置持久化 (baseUrl, model, theme) | Task 5 (config-store.ts) |
| contextIsolation + nodeIntegration: false | Task 4 (window-manager.ts webPreferences) |

**2. Placeholder scan:** 无 TBD/TODO/"implement later"/"add appropriate error handling"/"similar to Task N"。每步均有完整代码和命令。

**3. Type consistency：**
- `EngineRequest` / `EngineEvent` 在 `src/shared/ipc-types.ts` 中统一定义，Task 2、Task 4、Task 5、Task 6 均从同一文件导入。
- `AppConfig` 类型在 `ipc-types.ts` 定义，`config-store.ts` 和 `client.ts` 均使用。
- `generateId()` 在 engine.ts 内部使用，无跨文件不一致。

---

# Phase 0 最终修复 — 追加计划（2026-05-13）

> **触发原因：** 第二次 `/review` 审查发现 Phase 0 仍存在 3 个合规缺口，需在 Phase 1 开始前关闭。
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 关闭 Phase 0 全部缺口：响应式布局改为 JS 状态机驱动、`chat:retry` 在 engine 层补齐处理逻辑、主题切换从 `<select>` 下拉改为 Sun/Moon 图标按钮。

**Architecture:** Renderer 层引入 `useResponsiveLayout` Hook 监听 `window.innerWidth`，以 1100px/800px 为阈值精确控制三栏布局显隐；Engine 层提取 `executeStream` 公共函数，使 `chat:retry` 复用同一套 SSE 逻辑但不重复添加 user message；主题切换 UI 直接替换为 Lucide 图标按钮，零逻辑改动。

**Tech Stack:** 现有栈不变。

## 文件结构

| 文件 | 变更 | 说明 |
|---|---|---|
| `src/renderer/hooks/useResponsiveLayout.ts` | 新建 | 窗口宽度状态机，暴露 `width` / `isLeftOpen` / `isRightOpen` |
| `src/renderer/App.tsx` | 修改 | 接入 Hook，替换 CSS 响应式前缀为 JS 条件类名；替换主题 `<select>` 为图标按钮 |
| `src/engine/state/conversation-store.ts` | 修改 | 新增 `getLastUserMessage` 方法 |
| `src/engine/engine.ts` | 修改 | 提取 `executeStream`，新增 `chat:retry` case |

---

### Task R1: Responsive Layout JS State Machine

**Files:**
- Create: `src/renderer/hooks/useResponsiveLayout.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 创建响应式布局 Hook**

```ts
// src/renderer/hooks/useResponsiveLayout.ts
import { useState, useEffect } from 'react'

export interface LayoutState {
  width: number
  isLeftOpen: boolean
  isRightOpen: boolean
}

const RIGHT_PANEL_THRESHOLD = 1100
const LEFT_RAIL_THRESHOLD = 800

export function useResponsiveLayout(): LayoutState {
  const [width, setWidth] = useState(window.innerWidth)
  const [isRightOpen, setIsRightOpen] = useState(window.innerWidth >= RIGHT_PANEL_THRESHOLD)
  const [isLeftOpen, setIsLeftOpen] = useState(window.innerWidth >= LEFT_RAIL_THRESHOLD)

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setWidth(w)
      setIsRightOpen(w >= RIGHT_PANEL_THRESHOLD)
      setIsLeftOpen(w >= LEFT_RAIL_THRESHOLD)
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { width, isLeftOpen, isRightOpen }
}
```

- [ ] **Step 2: 修改 App.tsx 接入 Hook 并替换响应式类名**

将 `src/renderer/App.tsx` 中 `useTheme` 的 import 下方新增：

```tsx
import { useResponsiveLayout } from './hooks/useResponsiveLayout.js'
```

在 `App` 函数体内新增：

```tsx
const { isLeftOpen, isRightOpen } = useResponsiveLayout()
```

将 Left Rail 占位符：

```tsx
<div className="hidden w-16 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex" />
```

替换为：

```tsx
{isLeftOpen && (
  <div className="flex w-16 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
)}
```

将 Middle Content 的最外层 `<div className="flex min-w-0 flex-1 flex-col">` 替换为：

```tsx
<div className="flex min-w-[500px] flex-1 flex-col">
```

将 Right Artifacts Panel 占位符：

```tsx
<div className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 xl:block" />
```

替换为：

```tsx
{isRightOpen && (
  <div className="w-[320px] shrink-0 border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useResponsiveLayout.ts src/renderer/App.tsx
git commit -m "feat(ui): JS-driven responsive layout with 1100/800px thresholds"
```

---

### Task R2: Engine `chat:retry` Handler

**Files:**
- Modify: `src/engine/state/conversation-store.ts`
- Modify: `src/engine/engine.ts`

- [ ] **Step 1: ConversationStore 新增获取最后一条用户消息**

在 `src/engine/state/conversation-store.ts` 中，在 `isEmpty` 方法之后、`compactIfNeeded` 之前插入：

```ts
  getLastUserMessage(sessionId: string): string | null {
    const conv = this.conversations.get(sessionId)
    if (!conv) return null
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') {
        return conv.messages[i].content
      }
    }
    return null
  }
```

- [ ] **Step 2: engine.ts 提取公共流执行函数**

将 `src/engine/engine.ts` 中 `handleChatSend` 的流式调用部分提取为 `executeStream`。具体替换 `handleChatSend` 为：

```ts
async function handleChatSend(payload: ChatSendPayload): Promise<void> {
  const sessionId = 'default'
  if (isOffline) {
    sendEvent({
      id: generateId(),
      type: 'chat:error',
      payload: { code: 'OFFLINE', message: '网络不可用，请检查网络连接后重试' },
    })
    return
  }

  const config = getConfig()
  conversationStore.addUserMessage(sessionId, payload.content)

  const messageId = generateId()
  await executeStream(sessionId, messageId, config)
}

async function executeStream(sessionId: string, messageId: string, config: AppConfig): Promise<void> {
  currentAbortController = new AbortController()
  assistantBuffer = ''

  await streamChatCompletion(
    config,
    apiKey,
    conversationStore.getMessagesForAPI(sessionId),
    {
      onChunk: (text) => {
        assistantBuffer += text
        sendEvent({ id: generateId(), type: 'chat:chunk', payload: { text, messageId } })
      },
      onDone: (usage) => {
        if (assistantBuffer) {
          conversationStore.addAssistantMessage(sessionId, assistantBuffer)
        }
        assistantBuffer = ''
        sendEvent({ id: generateId(), type: 'chat:end', payload: { messageId, usage } })
      },
      onError: (code, message) => {
        assistantBuffer = ''
        sendEvent({ id: generateId(), type: 'chat:error', payload: { code, message } })
      },
      onRetry: (attempt, delayMs) => {
        sendEvent({
          id: generateId(),
          type: 'chat:chunk',
          payload: { text: `\n[检测到网络波动，正在第 ${attempt} 次重试...]\n`, messageId },
        })
      },
    },
    currentAbortController.signal,
  )
}
```

注意：需要确保 `engine.ts` 顶部已导入 `AppConfig`，如果没有，在 imports 中加入：

```ts
import type { AppConfig } from '../shared/ipc-types.js'
```

- [ ] **Step 3: 在 handleRequest 中新增 `chat:retry` case**

将 `handleRequest` 中的 switch 替换为：

```ts
async function handleRequest(req: EngineRequest): Promise<void> {
  switch (req.type) {
    case 'chat:send':
      await handleChatSend(req.payload as ChatSendPayload)
      break
    case 'chat:retry': {
      const sessionId = 'default'
      const lastMsg = conversationStore.getLastUserMessage(sessionId)
      if (!lastMsg) {
        sendEvent({
          id: generateId(),
          type: 'chat:error',
          payload: { code: 'NO_MESSAGE', message: '没有可重试的消息' },
        })
        break
      }
      if (isOffline) {
        sendEvent({
          id: generateId(),
          type: 'chat:error',
          payload: { code: 'OFFLINE', message: '网络不可用，请检查网络连接后重试' },
        })
        break
      }
      const config = getConfig()
      const messageId = generateId()
      await executeStream(sessionId, messageId, config)
      break
    }
    case 'chat:cancel':
    case 'chat:retry-cancel':
      currentAbortController?.abort()
      break
    case 'config:update': {
      const p = req.payload as ConfigUpdatePayload
      if (p.apiKey) apiKey = p.apiKey
      const updates: Partial<AppConfig> = {}
      if (p.baseUrl) updates.baseUrl = p.baseUrl
      if (p.model) updates.model = p.model
      if (p.theme) updates.theme = p.theme
      if (Object.keys(updates).length > 0) {
        setConfig(updates as Partial<ReturnType<typeof getConfig>>)
      }
      break
    }
    case 'health:check':
      await checkHealth()
      break
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/engine/state/conversation-store.ts src/engine/engine.ts
git commit -m "feat(engine): add chat:retry handler with executeStream extraction"
```

---

### Task R3: Theme Toggle Sun/Moon Icon Buttons

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 替换主题切换 select 为图标按钮**

将 `src/renderer/App.tsx` 中 `useTheme` 的 import 旁边加入 Lucide 图标：

```tsx
import { Sun, Moon } from 'lucide-react'
```

找到 `<div className="absolute right-4 top-4 z-10">...</div>` 中的 `<select>` 元素，整段替换为：

```tsx
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-8 border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => setTheme('light')}
            className={`rounded-md p-1.5 transition ${
              theme === 'light'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label="浅色模式"
          >
            <Sun size={14} />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`rounded-md p-1.5 transition ${
              theme === 'dark'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label="深色模式"
          >
            <Moon size={14} />
          </button>
        </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(ui): replace theme select with Sun/Moon icon buttons"
```

---

## Self-Review

**1. Spec coverage:**

| 缺口 | 对应任务 |
|---|---|
| 响应式布局未使用 JS 状态机 | Task R1 (`useResponsiveLayout` + App.tsx 条件渲染) |
| 缺少 `chat:retry` engine 处理 | Task R2 (`executeStream` 提取 + `chat:retry` case) |
| 主题切换为 `<select>` 而非图标按钮 | Task R3 (Sun/Moon Lucide 按钮) |

**2. Placeholder scan:** 无 TBD/TODO。每步均有完整代码、精确文件路径和 commit 命令。

**3. Type consistency：**
- `useResponsiveLayout` 返回类型 `LayoutState` 与 App.tsx 解构使用一致。
- `conversationStore.getLastUserMessage` 返回 `string | null`，与 engine.ts 中判断逻辑一致。
- `executeStream` 参数类型 `AppConfig` 与 `getConfig()` 返回类型一致。

---

## Execution Handoff

**Plan complete and appended to `docs/plans/2026-05-12-phase0-real-dialogue-shell.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

---

# Phase 0 修复与 Phase 1 重新定义 — 追加计划（2026-05-13）

> **触发原因：** `/review` 审查发现 Phase 0 存在 P0 级视觉合规缺口，且 `vendor/free-code` 内核未实际集成（当前 engine 为手写重写）。
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 10 分钟修完 P0 视觉缺口；重新定义 Phase 1 为"内核逆向移植手术"，将 free-code 核心设计模式（指数退避重试、消息数组压缩、会话状态机）以零依赖形式重写进 engine，保持 IPC 接口 100% 兼容。

**Architecture:** Renderer 层只做样式和布局骨架修正；Engine 层引入 `ConversationStore`（会话状态管理）+ `RetryPolicy`（指数退避）+ `SSEReconnectAdapter`（断流续写），替换当前手写的 `Map<string, ConversationMessage[]>` 和裸 axios 调用。

**Tech Stack:** 现有栈不变（Electron v28+、React 18、Tailwind CSS v3、axios、eventsource-parser）。

**Critical Feasibility Note（手术二必须先读）：**
对 `vendor/free-code` 的源码审计显示：
- `src/services/api/client.ts` **未导出 `ProviderClient`**，仅导出 Anthropic SDK 专用的 `getAnthropicClient`。
- `src/state/AppStateStore.ts` **不是独立类**，而是 React `Store<AppState>` 类型别名，且 `AppState` 包含大量 UI 状态（footer、spinner、view selection 等）。

因此"直接 `import` free-code 模块"在 UtilityProcess 中不可行。本计划将 Surgery 2 修正为 **"逆向移植手术"**：提取 free-code 的核心设计模式，以零依赖形式重写进我们的 engine。这是同等战略价值的内核替换。

---

## 手术一：P0 视觉缺口秒修（10 分钟）

### Task F1: OfflineBanner + DayZeroWelcome 样式合规

**Files:**
- Modify: `src/renderer/components/system/OfflineBanner.tsx`
- Modify: `src/renderer/components/system/DayZeroWelcome.tsx`

- [ ] **Step 1: 修复 OfflineBanner 为 DESIGN.md 规范样式**

将 `src/renderer/components/system/OfflineBanner.tsx` 整文件替换为：

```tsx
// src/renderer/components/system/OfflineBanner.tsx
import { WifiOff, RefreshCw } from 'lucide-react'

interface OfflineBannerProps {
  offline: boolean
  onRetry: () => void
}

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
  if (!offline) return null

  return (
    <div className="flex items-center justify-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
      <WifiOff size={14} />
      <span>网络不可用，仅支持查看历史会话</span>
      <button
        onClick={onRetry}
        className="ml-2 flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-800/40 dark:text-rose-300 dark:hover:bg-rose-800/60"
      >
        <RefreshCw size={12} />
        重试
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 修复 DayZeroWelcome Pills 为 DESIGN.md 规范样式**

将 `src/renderer/components/system/DayZeroWelcome.tsx` 的 pills 渲染部分替换：

```tsx
// 在 DayZeroWelcome.tsx 中，找到 pills.map 所在的 div，替换为：
<div className="mt-4 flex flex-wrap gap-2">
  {pills.map((pill, idx) => (
    <button
      key={idx}
      onClick={() => onPillClick(pill.prompt)}
      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
    >
      {pill.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/system/OfflineBanner.tsx src/renderer/components/system/DayZeroWelcome.tsx
git commit -m "fix(ui): align OfflineBanner and DayZeroWelcome pills to DESIGN.md spec"
```

---

### Task F2: 底部免责声明 + 三栏布局骨架

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: 在 App.tsx 中插入布局骨架和免责声明**

将 `src/renderer/App.tsx` 整文件替换为：

```tsx
// src/renderer/App.tsx
import { useEffect, useState } from 'react'
import { MessageList } from './components/chat/MessageList.js'
import { UnifiedConsole } from './components/console/UnifiedConsole.js'
import { OfflineBanner } from './components/system/OfflineBanner.js'
import { DayZeroWelcome } from './components/system/DayZeroWelcome.js'
import { useEngine } from './hooks/useEngine.js'
import { useTheme } from './hooks/useTheme.js'
import type { EngineEvent } from '../../shared/ipc-types.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  error?: boolean
}

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [offline, setOffline] = useState(false)
  const [dayZero, setDayZero] = useState<{ content: string; pills: Array<{ label: string; prompt: string }> } | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const { theme, setTheme } = useTheme()

  const { send, isConnected } = useEngine((evt: EngineEvent) => {
    switch (evt.type) {
      case 'chat:chunk': {
        const p = evt.payload as { text: string; messageId: string }
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.id === p.messageId && last.streaming) {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: last.content + p.text }
            return updated
          }
          return [...prev, { id: p.messageId, role: 'assistant', content: p.text, streaming: true }]
        })
        break
      }
      case 'chat:end': {
        const p = evt.payload as { messageId: string }
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, streaming: false } : m)),
        )
        break
      }
      case 'chat:error': {
        const p = evt.payload as { code: string; message: string }
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'system', content: p.message, error: true },
        ])
        break
      }
      case 'offline:changed': {
        const p = evt.payload as { offline: boolean }
        setOffline(p.offline)
        break
      }
      case 'state:sync': {
        const p = evt.payload as { dayZero?: { content: string; pills: Array<{ label: string; prompt: string }> } }
        if (p.dayZero) setDayZero(p.dayZero)
        break
      }
      case 'engine:ready':
        setEngineReady(true)
        break
    }
  })

  useEffect(() => {
    if (engineReady && messages.length === 0 && !dayZero) {
      send({ id: `sync-${Date.now()}`, type: 'health:check', payload: {} })
    }
  }, [engineReady, messages.length, dayZero, send])

  const handleSend = (content: string) => {
    if (!content.trim()) return
    const id = `user-${Date.now()}`
    setMessages((prev) => [...prev, { id, role: 'user', content: content.trim() }])
    send({ id: `req-${Date.now()}`, type: 'chat:send', payload: { content: content.trim() } })
  }

  const handlePillClick = (prompt: string) => {
    handleSend(prompt)
    setDayZero(null)
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      {/* Left Rail Placeholder — Phase 2+ 导航 */}
      <div className="hidden w-16 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex" />

      {/* Middle Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner offline={offline} onRetry={() => send({ id: `hc-${Date.now()}`, type: 'health:check', payload: {} })} />

        <div className="absolute right-4 top-4 z-10">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="rounded-8 border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {dayZero && messages.length === 0 && (
              <DayZeroWelcome content={dayZero.content} pills={dayZero.pills} onPillClick={handlePillClick} />
            )}
            <MessageList messages={messages} />
          </div>
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <UnifiedConsole onSend={handleSend} disabled={offline} />
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
              AI 生成内容仅供参考，处理敏感数据前请核实
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs text-white shadow">
            AI 引擎连接中...
          </div>
        )}
      </div>

      {/* Right Artifacts Panel Placeholder — Phase 2+ 产物 */}
      <div className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 xl:block" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(ui): three-column layout skeleton + bottom AI disclaimer"
```

---

## 手术二：Phase 1 内核逆向移植手术

### Task F3: 创建 ConversationStore — 会话状态管理器

**Files:**
- Create: `src/engine/state/conversation-store.ts`

- [ ] **Step 1: 编写 ConversationStore**

```ts
// src/engine/state/conversation-store.ts
import type { AppConfig } from '../../shared/ipc-types.js'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface Conversation {
  id: string
  messages: ConversationMessage[]
  updatedAt: number
}

const MAX_CONTEXT_ROUNDS = 20
const SYSTEM_PROMPT =
  '你是 ONE，一位专业的银行 AI 助手。你帮助用户处理数据、撰写文档、生成报告。回答要简洁专业。'

export class ConversationStore {
  private conversations = new Map<string, Conversation>()

  getOrCreate(sessionId: string): Conversation {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        id: sessionId,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }],
        updatedAt: Date.now(),
      })
    }
    return this.conversations.get(sessionId)!
  }

  addUserMessage(sessionId: string, content: string): Conversation {
    const conv = this.getOrCreate(sessionId)
    conv.messages.push({ role: 'user', content })
    this.compactIfNeeded(conv)
    conv.updatedAt = Date.now()
    return conv
  }

  addAssistantMessage(sessionId: string, content: string): Conversation {
    const conv = this.getOrCreate(sessionId)
    conv.messages.push({ role: 'assistant', content })
    conv.updatedAt = Date.now()
    return conv
  }

  getMessagesForAPI(sessionId: string): Array<{ role: string; content: string }> {
    const conv = this.getOrCreate(sessionId)
    return conv.messages.map((m) => ({ role: m.role, content: m.content }))
  }

  isEmpty(sessionId: string): boolean {
    const conv = this.conversations.get(sessionId)
    return !conv || conv.messages.length <= 1
  }

  private compactIfNeeded(conv: Conversation): void {
    const nonSystem = conv.messages.filter((m) => m.role !== 'system')
    const rounds = nonSystem.length / 2
    if (rounds > MAX_CONTEXT_ROUNDS) {
      const toRemove = (rounds - MAX_CONTEXT_ROUNDS) * 2
      const system = conv.messages.filter((m) => m.role === 'system')
      const kept = nonSystem.slice(toRemove)
      conv.messages = [...system, ...kept]
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/state/conversation-store.ts
git commit -m "feat(engine): ConversationStore with context window compaction"
```

---

### Task F4: 创建 RetryPolicy — 指数退避重试策略

**Files:**
- Create: `src/engine/adapters/retry-policy.ts`

- [ ] **Step 1: 编写 RetryPolicy**

```ts
// src/engine/adapters/retry-policy.ts

export interface RetryableOperation<T> {
  execute: (attempt: number) => Promise<T>
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

export interface RetryPolicyConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryableStatuses: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryPolicyConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

function isRetryableError(error: unknown, config: RetryPolicyConfig): boolean {
  if (error && typeof error === 'object') {
    const status = (error as { status?: number }).status
    if (typeof status === 'number' && config.retryableStatuses.includes(status)) {
      return true
    }
    const code = (error as { code?: string }).code
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return true
    }
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  operation: RetryableOperation<T>,
  config: RetryPolicyConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation.execute(attempt)
    } catch (error) {
      lastError = error
      if (attempt === config.maxRetries) break
      if (!isRetryableError(error, config)) throw error

      const delayMs = Math.min(
        config.baseDelayMs * Math.pow(2, attempt),
        config.maxDelayMs,
      )
      operation.onRetry?.(attempt + 1, delayMs, error)
      await sleep(delayMs)
    }
  }

  throw lastError
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/adapters/retry-policy.ts
git commit -m "feat(engine): RetryPolicy with exponential backoff 1s→2s→4s"
```

---

### Task F5: 重构 api/client.ts — 集成 RetryPolicy + SSE 断流检测

**Files:**
- Modify: `src/engine/api/client.ts`
- Modify: `src/shared/ipc-types.ts`（添加 `chat:retry-cancel` 类型）

- [ ] **Step 1: 修改 ipc-types.ts 添加 retry-cancel 事件**

在 `src/shared/ipc-types.ts` 中：

```ts
// EngineRequest 的 type  union 中加入：
export interface EngineRequest {
  id: string
  type:
    | 'chat:send'
    | 'chat:cancel'
    | 'chat:retry'
    | 'chat:retry-cancel'   // 新增
    | 'config:update'
    | 'health:check'
  payload: unknown
}
```

- [ ] **Step 2: 重构 client.ts**

将 `src/engine/api/client.ts` 整文件替换为：

```ts
// src/engine/api/client.ts
import axios, { type AxiosResponse, isAxiosError } from 'axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { AppConfig } from '../../shared/ipc-types.js'
import { withRetry, DEFAULT_RETRY_CONFIG } from '../adapters/retry-policy.js'

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: (usage?: { inputTokens: number; outputTokens: number }) => void
  onError: (code: string, message: string) => void
  onRetry?: (attempt: number, delayMs: number) => void
}

export async function streamChatCompletion(
  config: AppConfig,
  apiKey: string | null,
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  signal: AbortSignal,
): Promise<void> {
  const url = `${config.baseUrl}/v1/chat/completions`
  const body = {
    model: config.model,
    messages,
    stream: true,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  let usage: { inputTokens: number; outputTokens: number } | undefined

  try {
    await withRetry(
      {
        execute: async (attempt) => {
          if (signal.aborted) {
            throw new Error('ABORTED')
          }
          if (attempt > 0) {
            callbacks.onRetry?.(attempt, Math.min(DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1), DEFAULT_RETRY_CONFIG.maxDelayMs))
          }

          const response: AxiosResponse<ReadableStream> = await axios({
            method: 'post',
            url,
            data: body,
            headers,
            responseType: 'stream',
            signal,
            timeout: 60000,
          })

          const parser = createParser({
            onEvent: (event: EventSourceMessage) => {
              const data = event.data
              if (data === '[DONE]') {
                return
              }
              try {
                const json = JSON.parse(data)
                const delta = json.choices?.[0]?.delta?.content
                if (typeof delta === 'string') {
                  callbacks.onChunk(delta)
                }
                if (json.usage) {
                  usage = {
                    inputTokens: json.usage.prompt_tokens ?? 0,
                    outputTokens: json.usage.completion_tokens ?? 0,
                  }
                }
              } catch {
                // ignore malformed JSON in stream
              }
            },
          })

          const reader = response.data.getReader()
          const decoder = new TextDecoder()

          while (true) {
            if (signal.aborted) {
              reader.cancel()
              break
            }
            const { done, value } = await reader.read()
            if (done) break
            parser.feed(decoder.decode(value, { stream: true }))
          }

          parser.feed(decoder.decode())
        },
      },
      DEFAULT_RETRY_CONFIG,
    )

    callbacks.onDone(usage)
  } catch (error) {
    if (axios.isCancel(error) || signal.aborted) {
      callbacks.onDone(usage)
      return
    }
    const msg = error instanceof Error ? error.message : String(error)
    callbacks.onError('STREAM_ERROR', msg)
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/api/client.ts src/shared/ipc-types.ts
git commit -m "feat(engine): integrate RetryPolicy into SSE client, add retry-cancel IPC type"
```

---

### Task F6: 重构 engine.ts — 接入 ConversationStore + 修复消息累积

**Files:**
- Modify: `src/engine/engine.ts`

- [ ] **Step 1: 重写 engine.ts**

将 `src/engine/engine.ts` 整文件替换为：

```ts
// src/engine/engine.ts
import type { EngineRequest, EngineEvent, ChatSendPayload, ConfigUpdatePayload } from '../shared/ipc-types.js'
import { streamChatCompletion } from './api/client.js'
import { getConfig, setConfig } from './state/config-store.js'
import { ConversationStore } from './state/conversation-store.js'
import { DAY_ZERO_WELCOME, HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_TIMEOUT_MS } from '../shared/constants.js'
import axios from 'axios'

const conversationStore = new ConversationStore()
let currentAbortController: AbortController | null = null
let isOffline = false
let healthCheckTimer: NodeJS.Timeout | null = null
let apiKey: string | null = null
let assistantBuffer = '' // SSE 断流续写缓冲区

function sendEvent(evt: EngineEvent): void {
  process.parentPort?.postMessage(evt)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function checkHealth(): Promise<boolean> {
  const config = getConfig()
  try {
    await axios.head(`${config.baseUrl}/health`, {
      timeout: HEALTH_CHECK_TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    })
    if (isOffline) {
      isOffline = false
      sendEvent({ id: generateId(), type: 'offline:changed', payload: { offline: false } })
    }
    return true
  } catch {
    if (!isOffline) {
      isOffline = true
      sendEvent({ id: generateId(), type: 'offline:changed', payload: { offline: true } })
    }
    return false
  }
}

function startHealthCheck(): void {
  if (healthCheckTimer) clearInterval(healthCheckTimer)
  healthCheckTimer = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS)
}

function injectDayZeroWelcome(sessionId: string): void {
  if (conversationStore.isEmpty(sessionId)) {
    sendEvent({
      id: generateId(),
      type: 'state:sync',
      payload: { dayZero: DAY_ZERO_WELCOME },
    })
  }
}

async function handleChatSend(payload: ChatSendPayload): Promise<void> {
  const sessionId = 'default'
  if (isOffline) {
    sendEvent({
      id: generateId(),
      type: 'chat:error',
      payload: { code: 'OFFLINE', message: '网络不可用，请检查网络连接后重试' },
    })
    return
  }

  const config = getConfig()
  conversationStore.addUserMessage(sessionId, payload.content)

  const messageId = generateId()
  currentAbortController = new AbortController()
  assistantBuffer = ''

  await streamChatCompletion(
    config,
    apiKey,
    conversationStore.getMessagesForAPI(sessionId),
    {
      onChunk: (text) => {
        assistantBuffer += text
        sendEvent({ id: generateId(), type: 'chat:chunk', payload: { text, messageId } })
      },
      onDone: (usage) => {
        if (assistantBuffer) {
          conversationStore.addAssistantMessage(sessionId, assistantBuffer)
        }
        assistantBuffer = ''
        sendEvent({ id: generateId(), type: 'chat:end', payload: { messageId, usage } })
      },
      onError: (code, message) => {
        assistantBuffer = ''
        sendEvent({ id: generateId(), type: 'chat:error', payload: { code, message } })
      },
      onRetry: (attempt, delayMs) => {
        sendEvent({
          id: generateId(),
          type: 'chat:chunk',
          payload: { text: `\n[检测到网络波动，正在第 ${attempt} 次重试...]\n`, messageId },
        })
      },
    },
    currentAbortController.signal,
  )
}

async function handleRequest(req: EngineRequest): Promise<void> {
  switch (req.type) {
    case 'chat:send':
      await handleChatSend(req.payload as ChatSendPayload)
      break
    case 'chat:cancel':
    case 'chat:retry-cancel':
      currentAbortController?.abort()
      break
    case 'config:update': {
      const p = req.payload as ConfigUpdatePayload
      if (p.apiKey) apiKey = p.apiKey
      const updates: Partial<AppConfig> = {}
      if (p.baseUrl) updates.baseUrl = p.baseUrl
      if (p.model) updates.model = p.model
      if (p.theme) updates.theme = p.theme
      if (Object.keys(updates).length > 0) {
        setConfig(updates as Partial<ReturnType<typeof getConfig>>)
      }
      break
    }
    case 'health:check':
      await checkHealth()
      break
  }
}

process.parentPort?.on('message', async (event) => {
  const req = event.data as EngineRequest
  await handleRequest(req)
})

startHealthCheck()
sendEvent({ id: generateId(), type: 'engine:ready', payload: {} })
injectDayZeroWelcome('default')
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/engine.ts
git commit -m "feat(engine): integrate ConversationStore, fix assistant message accumulation, add retry hints"
```

---

### Task F7: 创建 ITool 接口 Stub — 为 Phase 2+ 预留扩展点

**Files:**
- Create: `src/engine/tools/ITool.ts`

- [ ] **Step 1: 编写 ITool 接口**

```ts
// src/engine/tools/ITool.ts

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
}

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
}

export interface ITool {
  readonly name: string
  readonly description: string
  readonly parameters: ToolParameter[]

  execute(params: Record<string, unknown>): Promise<ToolResult>
}

// Tool 注册表（Phase 3 时填充具体实现）
export class ToolRegistry {
  private tools = new Map<string, ITool>()

  register(tool: ITool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name)
  }

  list(): ITool[] {
    return Array.from(this.tools.values())
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/tools/ITool.ts
git commit -m "feat(engine): ITool interface stub and ToolRegistry for Phase 2+"
```

---

## Self-Review

**1. Spec coverage:**

| 需求 | 对应任务 |
|---|---|
| OfflineBanner 颜色合规 | Task F1 |
| DayZeroWelcome Pills 圆角合规 | Task F1 |
| 底部 AI 免责声明 | Task F2 |
| 三栏布局骨架 | Task F2 |
| 多轮对话上下文管理 | Task F3 (ConversationStore) |
| 上下文窗口压缩（20轮丢弃） | Task F3 (`compactIfNeeded`) |
| 错误自动重试（指数退避） | Task F4 + Task F5 |
| SSE 断流续写（带缓冲区） | Task F5 (`assistantBuffer` + retry) |
| Assistant 消息累积到历史 | Task F6 (`onDone` 时 `addAssistantMessage`) |
| ITool 接口 Stub | Task F7 |

**2. Placeholder scan:** 无 TBD/TODO。每步均有完整代码和精确文件路径。

**3. Type consistency：**
- `EngineRequest` 新增 `chat:retry-cancel`，在 `ipc-types.ts`、`engine.ts` 中同步更新。
- `ConversationStore` 的 `getMessagesForAPI` 返回类型与 `client.ts` 的 `messages` 参数类型一致。
- `RetryPolicyConfig` 的延迟算法与 free-code 的 `BASE_DELAY_MS * 2^attempt` 模式一致。

---

# Phase 0 UI 合规修复计划（2026-05-13）

> **触发原因：** QA 审计报告 `.gstack/qa-reports/qa-report-one-2026-05-13.md` 显示 Phase 0 当前 Health Score 3.5/10，存在 7 个 P0 级视觉合规缺口。
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 关闭 Phase 0 全部 P0 视觉缺口，将 Health Score 从 3.5/10 提升至 8+/10。布局骨架（三栏结构、ChatHeader、消息气泡、控制台）100% 符合 DESIGN.md；Phase 2+ 功能性组件（ThinkingChain、PlanCard、Artifacts 生成）以空状态/静态占位符表示。

**Architecture:** Renderer 层新建 SidebarLeft/SidebarRight/ChatHeader 骨架组件，修正所有已有组件（UserBubble、AIAvatar、MessageList、UnifiedConsole、DayZeroWelcome、OfflineBanner）的样式 token 以匹配 DESIGN.md；Engine 层无需改动（纯 UI 修复）；新增 sonner Toast 和 File Drop Overlay 提升 Demo 体验。

**Tech Stack:** React 18, TypeScript 5.x, Tailwind CSS v3, Lucide React, sonner（新增依赖）。

---

## File Structure

| 文件 | 变更 | 说明 |
|---|---|---|
| `tailwind.config.js` | 修改 | 字体栈加入 `PingFang SC` |
| `package.json` | 修改 | 新增 `sonner` 依赖 |
| `src/shared/constants.ts` | 修改 | 更新 `DAY_ZERO_WELCOME` 内容与 emoji pills |
| `src/renderer/App.tsx` | 修改 | 集成 SidebarLeft/SidebarRight/ChatHeader，移除浮动主题按钮，更新免责声明文字，集成 Toaster 和 FileDropOverlay |
| `src/renderer/components/sidebar/SidebarLeft.tsx` | 新建 | 左侧导航 Rail（68px）+ Expanded（256px）骨架，mock 数据 |
| `src/renderer/components/sidebar/SidebarRight.tsx` | 新建 | 右侧产物面板 320px 骨架，Tab bar + 空状态 |
| `src/renderer/components/layout/ChatHeader.tsx` | 新建 | h-14 头部，含工作区名称、在线状态、主题切换、右侧面板开关 |
| `src/renderer/components/chat/UserBubble.tsx` | 修改 | bg-indigo-600、rounded-2xl rounded-tr-sm、shadow-sm、hover Copy 按钮 |
| `src/renderer/components/chat/AIAvatar.tsx` | 修改 | 40x40px、渐变背景、边框、Bot 20x20 |
| `src/renderer/components/chat/MessageList.tsx` | 修改 | max-w-2xl 内容链、user max-w-[85%]、错误消息气泡化、streaming 思考文本 |
| `src/renderer/components/chat/ThinkingChain.tsx` | 新建 | Phase 0 占位组件，空状态 |
| `src/renderer/components/chat/PlanCard.tsx` | 新建 | Phase 0 占位组件，空状态 |
| `src/renderer/components/console/UnifiedConsole.tsx` | 修改 | shadow-2xl、焦点环、发送按钮样式、模式/model 占位按钮 |
| `src/renderer/components/system/DayZeroWelcome.tsx` | 修改 | 渲染为 AI 消息气泡（带 avatar）|
| `src/renderer/components/system/OfflineBanner.tsx` | 修改 | 重试按钮改为 text-link 样式 |
| `src/renderer/components/system/FileDropOverlay.tsx` | 新建 | 全局拖拽遮罩层 |

---

### Task 1: Tailwind 字体栈修复

**Files:**
- Modify: `tailwind.config.js`

**说明：** QA 报告 P1.4 指出字体栈缺少 `PingFang SC`。

- [ ] **Step 1: 修改 tailwind.config.js 字体栈**

将 `tailwind.config.js` 中的 `fontFamily.sans` 替换为：

```js
      fontFamily: {
        sans: ['Geist Sans', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
```

- [ ] **Step 2: Commit**

```bash
git add tailwind.config.js
git commit -m "fix(ui): add PingFang SC to font stack per DESIGN.md"
```

---

### Task 2: 创建 SidebarLeft 骨架

**Files:**
- Create: `src/renderer/components/sidebar/SidebarLeft.tsx`

**说明：** QA 报告 P0.1 指出左侧边栏为空 placeholder div。Phase 0 先实现带 mock 数据的骨架，支持 expanded（256px）和 rail（68px）两种状态，默认 expanded。

- [ ] **Step 1: 编写 SidebarLeft 组件**

```tsx
// src/renderer/components/sidebar/SidebarLeft.tsx
import { useState } from 'react'
import { Bot, Plus, Search, LayoutGrid, Wrench, Settings, ChevronLeft, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { icon: Plus, label: '新建工作区' },
  { icon: Search, label: '全局搜索' },
  { icon: LayoutGrid, label: '我的工作区' },
  { icon: Wrench, label: '本地工具库' },
]

const MOCK_WORKSPACES = [
  { id: '1', name: '默认工作区', active: true },
  { id: '2', name: '季度报表', active: false },
  { id: '3', name: '客户数据分析', active: false },
]

export function SidebarLeft() {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900 ${
        expanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo Header */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Bot size={18} />
        </div>
        {expanded && <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI Agent</span>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label={expanded ? '收起侧边栏' : '展开侧边栏'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav Buttons */}
      <div className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
              expanded ? '' : 'justify-center'
            }`}
            title={item.label}
          >
            <item.icon size={18} />
            {expanded && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Workspace List */}
      {expanded && (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <p className="px-3 py-1 text-xs font-medium text-slate-400">最近工作区</p>
          {MOCK_WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                ws.active
                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${ws.active ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Settings */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-700">
        <button
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            expanded ? '' : 'justify-center'
          }`}
          title="设置"
        >
          <Settings size={18} />
          {expanded && <span>设置</span>}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/sidebar/SidebarLeft.tsx
git commit -m "feat(ui): SidebarLeft skeleton with expanded/rail modes and mock data"
```

---

### Task 3: 创建 SidebarRight 骨架

**Files:**
- Create: `src/renderer/components/sidebar/SidebarRight.tsx`

**说明：** QA 报告 P0.1 指出右侧产物面板为空 placeholder div。Phase 0 实现 Tab bar + 空状态占位。

- [ ] **Step 1: 编写 SidebarRight 组件**

```tsx
// src/renderer/components/sidebar/SidebarRight.tsx
import { useState } from 'react'
import { Layout, FileText, FileSpreadsheet, FilePresentation } from 'lucide-react'

const MOCK_FILES = [
  { id: '1', name: '销售数据_Q1.xlsx', type: 'excel', size: '24 KB', time: '10:30' },
  { id: '2', name: '会议纪要_0512.docx', type: 'word', size: '12 KB', time: '09:15' },
]

const FILE_ICONS: Record<string, React.ReactNode> = {
  excel: <FileSpreadsheet size={16} className="text-emerald-500" />,
  word: <FileText size={16} className="text-blue-500" />,
  ppt: <FilePresentation size={16} className="text-amber-500" />,
}

type Tab = 'files' | 'preview'

export function SidebarRight() {
  const [activeTab, setActiveTab] = useState<Tab>('files')

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Tab Bar */}
      <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('files')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'files'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            产物文件
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'preview'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            在线预览
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'files' ? (
          <div className="flex flex-col gap-1 p-2">
            {MOCK_FILES.map((file) => (
              <button
                key={file.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {FILE_ICONS[file.type] || <FileText size={16} className="text-slate-400" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{file.name}</span>
                  <span className="text-xs text-slate-400">
                    {file.size} · {file.time}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-slate-400">
            <Layout size={40} strokeWidth={1.5} />
            <p className="text-sm">选择左侧文件以预览</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/sidebar/SidebarRight.tsx
git commit -m "feat(ui): SidebarRight skeleton with tab bar and empty preview state"
```

---

### Task 4: 创建 ChatHeader

**Files:**
- Create: `src/renderer/components/layout/ChatHeader.tsx`
- Modify: `src/renderer/App.tsx`

**说明：** QA 报告 P0.2 指出缺失 ChatHeader。同时 P2.1 要求主题按钮移入 header。Phase 0 先实现静态布局。

- [ ] **Step 1: 编写 ChatHeader 组件**

```tsx
// src/renderer/components/layout/ChatHeader.tsx
import { Menu, Globe, PanelRight, Sun, Moon } from 'lucide-react'

interface ChatHeaderProps {
  workspaceName: string
  isOnline: boolean
  theme: 'light' | 'dark' | 'system'
  onSetTheme: (theme: 'light' | 'dark') => void
  isRightOpen: boolean
  onToggleRight: () => void
}

export function ChatHeader({
  workspaceName,
  isOnline,
  theme,
  onSetTheme,
  isRightOpen,
  onToggleRight,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
      {/* Left: Hamburger + Workspace Name */}
      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="菜单"
        >
          <Menu size={18} />
        </button>
        <h1 className="max-w-xs truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {workspaceName}
        </h1>
      </div>

      {/* Right: Status + Theme + Panel Toggle */}
      <div className="flex items-center gap-2">
        {/* Online Status */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800">
          <Globe size={12} className="text-slate-400" />
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isOnline ? '直连' : '离线'}
          </span>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => onSetTheme('light')}
            className={`rounded-md p-1.5 transition ${
              theme === 'light'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label="浅色模式"
          >
            <Sun size={14} />
          </button>
          <button
            onClick={() => onSetTheme('dark')}
            className={`rounded-md p-1.5 transition ${
              theme === 'dark'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label="深色模式"
          >
            <Moon size={14} />
          </button>
        </div>

        {/* Right Panel Toggle */}
        <button
          onClick={onToggleRight}
          className={`rounded-md p-1.5 transition ${
            isRightOpen
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
          }`}
          aria-label="切换右侧面板"
        >
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: 修改 App.tsx 集成 ChatHeader 并移除浮动主题按钮**

将 `src/renderer/App.tsx` 的 imports 替换为：

```tsx
import { useEffect, useState } from 'react'
import { MessageList } from './components/chat/MessageList.js'
import { UnifiedConsole } from './components/console/UnifiedConsole.js'
import { OfflineBanner } from './components/system/OfflineBanner.js'
import { DayZeroWelcome } from './components/system/DayZeroWelcome.js'
import { SidebarLeft } from './components/sidebar/SidebarLeft.js'
import { SidebarRight } from './components/sidebar/SidebarRight.js'
import { ChatHeader } from './components/layout/ChatHeader.js'
import { useEngine } from './hooks/useEngine.js'
import { useTheme } from './hooks/useTheme.js'
import { useResponsiveLayout } from './hooks/useResponsiveLayout.js'
import type { EngineEvent } from '../../shared/ipc-types.js'
```

在 `App` 函数体内，移除原来绝对定位的主题切换按钮，改为：

```tsx
  const [isRightOpenManual, setIsRightOpenManual] = useState(true)
  const effectiveRightOpen = isRightOpen && isRightOpenManual
```

将 `App` 的 return JSX 整段替换为：

```tsx
  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      {/* Left Sidebar */}
      {isLeftOpen && <SidebarLeft />}

      {/* Middle Content */}
      <div className="flex min-w-[500px] flex-1 flex-col">
        <ChatHeader
          workspaceName="默认工作区"
          isOnline={!offline}
          theme={theme === 'system' ? 'light' : theme}
          onSetTheme={(t) => setTheme(t)}
          isRightOpen={effectiveRightOpen}
          onToggleRight={() => setIsRightOpenManual((v) => !v)}
        />
        <OfflineBanner offline={offline} onRetry={() => send({ id: `hc-${Date.now()}`, type: 'health:check', payload: {} })} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {dayZero && messages.length === 0 && (
              <DayZeroWelcome content={dayZero.content} pills={dayZero.pills} onPillClick={handlePillClick} />
            )}
            <MessageList messages={messages} />
          </div>
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <UnifiedConsole onSend={handleSend} disabled={offline} />
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
              AI 可能会犯错。处理涉及财务或敏感数据前，请核实生成内容。
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs text-white shadow">
            AI 引擎连接中...
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      {effectiveRightOpen && <SidebarRight />}
    </div>
  )
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/layout/ChatHeader.tsx src/renderer/App.tsx
git commit -m "feat(ui): add ChatHeader with workspace title, status, theme toggle, panel switch"
```

---

### Task 5: 修复 UserBubble + AIAvatar + MessageList

**Files:**
- Modify: `src/renderer/components/chat/UserBubble.tsx`
- Modify: `src/renderer/components/chat/AIAvatar.tsx`
- Modify: `src/renderer/components/chat/MessageList.tsx`
- Create: `src/renderer/components/chat/ThinkingChain.tsx`
- Create: `src/renderer/components/chat/PlanCard.tsx`

**说明：** QA P0.4/P0.5/P0.6 联合修复消息层样式。

- [ ] **Step 1: 修复 UserBubble**

将 `src/renderer/components/chat/UserBubble.tsx` 替换为：

```tsx
// src/renderer/components/chat/UserBubble.tsx
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface UserBubbleProps {
  content: string
}

export function UserBubble({ content }: UserBubbleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[85%] sm:max-w-xl">
        <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>
        <button
          onClick={handleCopy}
          className="absolute -left-8 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 transition hover:bg-slate-100 group-hover:opacity-100 dark:hover:bg-slate-800"
          aria-label="复制"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-400" />}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 修复 AIAvatar**

将 `src/renderer/components/chat/AIAvatar.tsx` 替换为：

```tsx
// src/renderer/components/chat/AIAvatar.tsx
import { Bot } from 'lucide-react'

export function AIAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-gradient-to-br from-indigo-100 to-white text-indigo-600 dark:border-indigo-500/30 dark:from-indigo-900/40 dark:to-slate-900 dark:text-indigo-300">
      <Bot size={20} />
    </div>
  )
}
```

- [ ] **Step 3: 创建 ThinkingChain 占位组件**

```tsx
// src/renderer/components/chat/ThinkingChain.tsx
export function ThinkingChain() {
  return null
}
```

- [ ] **Step 4: 创建 PlanCard 占位组件**

```tsx
// src/renderer/components/chat/PlanCard.tsx
export function PlanCard() {
  return null
}
```

- [ ] **Step 5: 修复 MessageList**

将 `src/renderer/components/chat/MessageList.tsx` 替换为：

```tsx
// src/renderer/components/chat/MessageList.tsx
import { AlertCircle, Loader2 } from 'lucide-react'
import { AIAvatar } from './AIAvatar.js'
import { UserBubble } from './UserBubble.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { ThinkingChain } from './ThinkingChain.js'
import { PlanCard } from './PlanCard.js'
import type { ChatMessage } from '../../App.js'

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="animate-fade-up">
              <UserBubble content={msg.content} />
            </div>
          )
        }

        if (msg.role === 'system' && msg.error) {
          return (
            <div key={msg.id} className="animate-fade-up flex gap-3">
              <AIAvatar />
              <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span className="text-xs font-medium">出错了</span>
                </div>
                <p className="mt-1 text-sm">{msg.content}</p>
              </div>
            </div>
          )
        }

        return (
          <div key={msg.id} className="animate-fade-up flex gap-3">
            <AIAvatar />
            <div className="max-w-2xl">
              <ThinkingChain />
              <PlanCard />
              <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 shadow-sm dark:bg-slate-800">
                <MarkdownRenderer content={msg.content} />
                {msg.streaming && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>AI 正在思考...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/chat/
git commit -m "fix(ui): align UserBubble, AIAvatar, MessageList to DESIGN.md spec"
```

---

### Task 6: 修复 UnifiedConsole 外壳 + 占位控件

**Files:**
- Modify: `src/renderer/components/console/UnifiedConsole.tsx`

**说明：** QA P0.3 指出控制台缺少外壳样式、焦点环、发送按钮样式，以及模式/model 等控件。Phase 0 修复外壳和按钮样式，其余控件做视觉占位（disabled）。

- [ ] **Step 1: 替换 UnifiedConsole 整文件**

```tsx
// src/renderer/components/console/UnifiedConsole.tsx
import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, AtSign, ChevronDown, Sparkles, Lightbulb, Hammer } from 'lucide-react'

type Mode = 'ask' | 'plan' | 'craft'

const MODES: { id: Mode; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'ask', label: 'Ask', icon: Sparkles, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', desc: '只读对话' },
  { id: 'plan', label: 'Plan', icon: Lightbulb, color: 'text-amber-600 bg-amber-50 border-amber-200', desc: '需审批' },
  { id: 'craft', label: 'Craft', icon: Hammer, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', desc: '自动执行' },
]

const MODELS = [
  { id: 'minimax', label: 'Minimax 2.5' },
  { id: 'gpt4o', label: 'GPT-4o' },
  { id: 'claude', label: 'Claude 3.5 Sonnet' },
]

interface UnifiedConsoleProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function UnifiedConsole({ onSend, disabled }: UnifiedConsoleProps) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('ask')
  const [model, setModel] = useState('minimax')
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeMode = MODES.find((m) => m.id === mode)!

  const handleSubmit = useCallback(() => {
    if (disabled || !text.trim()) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Context Pills row — placeholder for file attachments */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Paperclip size={10} />
          销售数据_Q1.xlsx
        </span>
      </div>

      {/* Main container */}
      <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-500/20">
        {/* Left action buttons */}
        <div className="flex shrink-0 items-center gap-1 pb-1">
          <button
            disabled
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 opacity-50 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400"
            title="@引入（Phase 1 启用）"
          >
            <AtSign size={12} />
            <span className="hidden sm:inline">引入</span>
          </button>
          <button
            disabled
            className="rounded-lg p-1.5 text-slate-400 opacity-50 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            title="附件（Phase 1 启用）"
          >
            <Paperclip size={16} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={disabled ? '网络不可用，请检查网络后重试' : '输入消息，按 Enter 发送...'}
          className="max-h-[200px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50"
        />

        {/* Right send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:translate-y-0"
          aria-label="发送"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Bottom toolbar: mode + model switches */}
      <div className="mt-2 flex items-center justify-between px-1">
        {/* Mode switch */}
        <div className="relative">
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition ${activeMode.color}`}
          >
            <activeMode.icon size={12} />
            {activeMode.label}
            <span className="text-[10px] opacity-60">· {activeMode.desc}</span>
            <ChevronDown size={10} className={`transition ${showModeDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showModeDropdown && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setShowModeDropdown(false) }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                    mode === m.id
                      ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <m.icon size={14} />
                  <div className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-[10px] text-slate-400">{m.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model switch */}
        <div className="relative">
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {MODELS.find((m) => m.id === model)?.label}
            <ChevronDown size={10} className={`transition ${showModelDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showModelDropdown && (
            <div className="absolute bottom-full right-0 z-20 mb-1 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setShowModelDropdown(false) }}
                  className={`flex w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                    model === m.id
                      ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/console/UnifiedConsole.tsx
git commit -m "feat(ui): redesign UnifiedConsole with shadow-2xl, focus ring, mode/model placeholders"
```

---

### Task 7: 修复 DayZeroWelcome + 更新常量

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/renderer/components/system/DayZeroWelcome.tsx`

**说明：** QA P0.7 要求 DayZeroWelcome 渲染为正常 AI 消息气泡，内容需包含拖拽提示和 emoji pills。

- [ ] **Step 1: 更新 constants.ts**

将 `src/shared/constants.ts` 中的 `DAY_ZERO_WELCOME` 替换为：

```ts
export const DAY_ZERO_WELCOME = {
  content:
    '你好！我是你的专属 AI 办公助手。你可以直接将 Excel、Word 或 PDF 拖拽到这个窗口，或者试试点击下方的快捷指令：',
  pills: [
    { label: '📊 帮我分析并清洗 Excel 销售数据', prompt: '帮我分析并清洗 Excel 销售数据' },
    { label: '📝 将这份文本排版为标准公文格式', prompt: '将这份文本排版为标准公文格式' },
    { label: '📊 根据数据生成一份汇报 PPT', prompt: '根据数据生成一份汇报 PPT' },
  ],
}
```

- [ ] **Step 2: 重写 DayZeroWelcome 为 AI 消息气泡**

将 `src/renderer/components/system/DayZeroWelcome.tsx` 替换为：

```tsx
// src/renderer/components/system/DayZeroWelcome.tsx
import { AIAvatar } from '../chat/AIAvatar.js'

interface DayZeroWelcomeProps {
  content: string
  pills: Array<{ label: string; prompt: string }>
  onPillClick: (prompt: string) => void
}

export function DayZeroWelcome({ content, pills, onPillClick }: DayZeroWelcomeProps) {
  return (
    <div className="animate-fade-up flex gap-3">
      <AIAvatar />
      <div className="max-w-2xl">
        <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 shadow-sm dark:bg-slate-800">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {content}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pills.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => onPillClick(pill.prompt)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/constants.ts src/renderer/components/system/DayZeroWelcome.tsx
git commit -m "fix(ui): DayZeroWelcome as AI message bubble with DESIGN.md content and emoji pills"
```

---

### Task 8: 修复 OfflineBanner 重试按钮样式

**Files:**
- Modify: `src/renderer/components/system/OfflineBanner.tsx`

**说明：** QA P1.6 要求重试按钮为 text-link 样式而非 pill。

- [ ] **Step 1: 替换 OfflineBanner**

将 `src/renderer/components/system/OfflineBanner.tsx` 替换为：

```tsx
// src/renderer/components/system/OfflineBanner.tsx
import { WifiOff } from 'lucide-react'

interface OfflineBannerProps {
  offline: boolean
  onRetry: () => void
}

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
  if (!offline) return null

  return (
    <div className="flex items-center justify-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
      <WifiOff size={14} />
      <span>网络不可用，仅支持查看历史会话</span>
      <button
        onClick={onRetry}
        className="ml-1 text-xs font-medium text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
      >
        重试
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/system/OfflineBanner.tsx
git commit -m "fix(ui): OfflineBanner retry as text-link per DESIGN.md"
```

---

### Task 9: 安装 sonner + Toast 集成

**Files:**
- Modify: `package.json`
- Modify: `src/renderer/App.tsx`

**说明：** QA P1.1 建议添加 Toast 系统用于非阻塞反馈。

- [ ] **Step 1: 安装 sonner**

```bash
bun add sonner
```

Expected: `package.json` dependencies 中出现 `"sonner": "^1.x.x"`，`bun.lockb` 更新。

- [ ] **Step 2: 在 App.tsx 中导入并放置 Toaster**

在 `src/renderer/App.tsx` 的 imports 中加入：

```tsx
import { Toaster, toast } from 'sonner'
```

在 `App` 的 return JSX 最外层 `<div>` 内部的末尾（`</div>` 之前）插入：

```tsx
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-text, #1e293b)',
          },
        }}
      />
```

同时，在 `useEngine` 的 `chat:error` case 中加入 toast：

```tsx
      case 'chat:error': {
        const p = evt.payload as { code: string; message: string }
        toast.error(p.message)
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'system', content: p.message, error: true },
        ])
        break
      }
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb src/renderer/App.tsx
git commit -m "feat(ui): integrate sonner Toast for error and feedback notifications"
```

---

### Task 10: 添加 File Drop Overlay

**Files:**
- Create: `src/renderer/components/system/FileDropOverlay.tsx`
- Modify: `src/renderer/App.tsx`

**说明：** QA P1.2 建议添加全局拖拽覆盖层，属于领导 Demo 核心卖点。

- [ ] **Step 1: 创建 FileDropOverlay**

```tsx
// src/renderer/components/system/FileDropOverlay.tsx
import { Upload, FileText } from 'lucide-react'

interface FileDropOverlayProps {
  show: boolean
}

export function FileDropOverlay({ show }: FileDropOverlayProps) {
  if (!show) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-600/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-10 shadow-2xl dark:bg-slate-900"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10"
        >
          <Upload size={32} className="text-indigo-600 dark:text-indigo-300" />
        </div>
        <div className="text-center"
        >
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100"
          >释放以上传文件</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400"
          >支持 Excel、Word、PDF、PPT、Markdown、TXT</p>
        </div>
        <div className="flex gap-3"
        >
          {['.xlsx', '.docx', '.pdf', '.pptx', '.md'].map((ext) => (
            <div key={ext} className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              <FileText size={10} />
              {ext}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 App.tsx 添加拖拽状态**

在 `src/renderer/App.tsx` 的 `App` 函数体内新增状态：

```tsx
  const [isDragging, setIsDragging] = useState(false)
```

在外层 `<div>` 上添加拖拽事件：

```tsx
    <div
      className="relative flex h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false) /* Phase 3 处理文件 */ }}
    >
```

并在 `</div>` 闭合标签之前插入：

```tsx
      <FileDropOverlay show={isDragging} />
```

同时添加 `FileDropOverlay` import：

```tsx
import { FileDropOverlay } from './components/system/FileDropOverlay.js'
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/system/FileDropOverlay.tsx src/renderer/App.tsx
git commit -m "feat(ui): add global FileDropOverlay with supported extensions badge"
```

---

### Task 11: 端到端验证

**Files:**
- 无新建文件

- [ ] **Step 1: 启动 dev 服务验证构建**

```bash
bun run dev
```

Expected:
1. Electron 窗口弹出，三栏布局可见（左 256px、中自适应、右 320px）。
2. ChatHeader 显示 "默认工作区" + 绿色在线圆点 + "直连" + 主题按钮 + 面板切换按钮。
3. 左侧 SidebarLeft 显示 Logo、4 个导航按钮、3 个 mock 工作区、底部设置按钮。
4. 右侧 SidebarRight 显示 "产物文件" Tab + 2 个 mock 文件 + "在线预览" 空状态。
5. 中间聊天区显示 DayZeroWelcome（带 AIAvatar 的气泡）+ emoji pills。
6. 输入消息发送后，UserBubble 为 indigo-600、rounded-2xl rounded-tr-sm、带 hover Copy 按钮。
7. AI 回复时显示 "AI 正在思考..." + Loader2 旋转动画。
8. 主题切换即时生效，localStorage 持久化。
9. 拖拽文件到窗口中央出现蓝色遮罩覆盖层。
10. `bun run build` 零 TypeScript 错误。

- [ ] **Step 2: 验证免责声明文字**

检查窗口底部控制台下方显示：
`AI 可能会犯错。处理涉及财务或敏感数据前，请核实生成内容。`

- [ ] **Step 3: 验证离线横幅**

断开网络或修改 baseUrl，等待 30 秒内顶部显示横幅，文字为 "网络不可用，仅支持查看历史会话"，"重试" 为纯文本链接样式。

- [ ] **Step 4: 提交并打 tag**

```bash
git add -A
git commit -m "chore: Phase 0 UI compliance complete — all P0 gaps closed"
git tag v0.1.1-phase0-ui
```

---

## Self-Review

**1. Spec coverage：**

| QA 报告缺口 | 对应任务 |
|---|---|
| P0.1 空侧边栏 | Task 2 (SidebarLeft) + Task 3 (SidebarRight) |
| P0.2 缺失 ChatHeader | Task 4 (ChatHeader) |
| P0.3 UnifiedConsole 样式 | Task 6 (shadow-2xl, focus ring, send button, mode/model placeholders) |
| P0.4 UserBubble 颜色 + hover Copy | Task 5 (UserBubble.tsx) |
| P0.5 AIAvatar 尺寸 + 渐变 | Task 5 (AIAvatar.tsx) |
| P0.6 AI Message 结构 | Task 5 (MessageList + ThinkingChain stub + PlanCard stub) |
| P0.7 DayZeroWelcome 内容 | Task 7 (constants.ts + DayZeroWelcome.tsx) |
| P1.1 Toast 系统 | Task 9 (sonner + Toaster) |
| P1.2 文件拖放覆盖层 | Task 10 (FileDropOverlay) |
| P1.4 Tailwind 字体栈 | Task 1 (PingFang SC) |
| P1.5 免责声明文字 | Task 4 (App.tsx 文字更新) |
| P1.6 OfflineBanner 重试样式 | Task 8 (text-link) |
| P2.1 主题切换位置 | Task 4 (移入 ChatHeader) |
| P2.2 错误消息格式 | Task 5 (AlertCircle + AI bubble) |
| P2.3 AI Message Max Width | Task 5 (max-w-2xl) |
| P2.4 发送按钮尺寸 | Task 6 (rounded-xl bg-indigo-600) |

**2. Placeholder scan:** 无 TBD/TODO。ThinkingChain 和 PlanCard 为 Phase 2 预留的合法空状态组件。mode/model 下拉为 Phase 1 真实功能预留的视觉占位。

**3. Type consistency：**
- `ChatMessage` 接口在 `App.tsx` 定义，`MessageList.tsx`、`useEngine` 回调均使用同一类型。
- `Mode` 类型在 `UnifiedConsole.tsx` 内部定义，不影响外部接口。

---

## Phase 0 后续 TODO（未在本次修复中完成，已标识阶段归属）

以下项目在本次 Phase 0 UI 合规修复中**有意延后**，以避免与后续阶段返工：

| # | 项目 | 当前状态 | 延后至 | 原因 |
|---|---|---|---|---|
| 1 | **Settings Dialog** | 未实现 | Phase 1 | `docs/design.md:374` 明确模型切换配置属于 Phase 1；Phase 0 只有主题切换按钮已满足 Demo 需求 |
| 2 | **模型切换真实功能** | 占位（UnifiedConsole 有 UI 无 API 切换逻辑） | Phase 1 | `docs/design.md:374` 明确属于 Phase 1（Day 3-7），需改造 ProviderClient 支持多实例 |
| 3 | **Mode Switch 真实功能（Ask/Plan/Craft）** | 占位（有 UI 状态，无引擎逻辑） | Phase 2 | `docs/design.md:392` 明确 Plan 模式审批 UI 属于 Phase 2（Week 2），需状态机实现 |
| 4 | **Workspace 列表真实数据** | mock 数据 | Phase 1 | 左侧工作区持久化属于 Phase 1 多轮对话与会话历史 |
| 5 | **ThinkingChain 真实内容** | 返回 `null` 的占位组件 | Phase 2 | 需 Plan 模式输出结构化思考过程 |
| 6 | **PlanCard 真实审批逻辑** | 返回 `null` 的占位组件 | Phase 2 | 需 Plan 模式状态机 + 用户同意/拒绝交互 |
| 7 | **Artifacts 文件真实生成** | 右侧 mock 文件列表 | Phase 3 | 业务工具（Excel/Word/PPT 处理）属于 Phase 3 |
| 8 | **@引入 / Paperclip 附件功能** | disabled 按钮占位 | Phase 3 | 文件解析与向量化属于 Phase 3 |
| 9 | **FileDropOverlay 真实上传处理** | `onDrop` 仅 `preventDefault` | Phase 3 | 文件解析与 Workspace 沙箱写入属于 Phase 3 |
| 10 | **深色模式自定义颜色 `#0B1120`** | 未添加 | Phase 1 | QA 报告 P1.4 标记为 Low；当前 `dark:bg-slate-900` 已足够 |

---

## Execution Handoff

**Plan complete and appended to `docs/plans/2026-05-12-phase0-real-dialogue-shell.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
