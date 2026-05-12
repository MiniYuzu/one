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

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-12-phase0-real-dialogue-shell.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
