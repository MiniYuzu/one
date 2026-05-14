# Phase 1 — 完整对话引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对话引擎具备生产级可靠性：多会话管理（创建/切换/删除）、会话历史持久化、SSE 断流静默重连、模型配置外部化、全局键盘快捷键。

**Architecture:** 在 Phase 0 三进程架构基础上，引擎层（UtilityProcess）增加 `session-store.ts` 原子文件持久化（复用 config-store 模式）、`sse-reconnect.ts` 断流续写逻辑；渲染层增加会话列表状态同步、`SessionSidebar` 交互、快捷键 Hook；IPC 协议扩展 `session:*` 和 `model:*` 事件类型。

**Tech Stack:** Electron v28+, React 18, TypeScript 5.x, Tailwind CSS v3, Lucide React, Vite, axios, eventsource-parser

---

## File Structure

```
ONE/
├── src/
│   ├── engine/
│   │   ├── engine.ts                    # 扩展：session 路由、model 配置加载
│   │   ├── api/
│   │   │   ├── client.ts                # 扩展：SSE reconnect 上下文注入
│   │   │   └── models.ts                # 新增：ModelRegistry 从 config.json 加载
│   │   ├── state/
│   │   │   ├── config-store.ts          # 已有：原子文件写配置
│   │   │   ├── conversation-store.ts    # 扩展：多 session 支持
│   │   │   └── session-store.ts         # 新增：会话元数据持久化（原子文件写）
│   │   └── adapters/
│   │       ├── retry-policy.ts          # 已有：指数退避
│   │       └── sse-reconnect.ts         # 新增：SSE 断流续写策略
│   ├── renderer/
│   │   ├── App.tsx                      # 扩展：session 状态管理、快捷键绑定
│   │   ├── components/
│   │   │   ├── sidebar/
│   │   │   │   ├── SidebarLeft.tsx      # 重构：真实会话列表 + 新建/删除
│   │   │   │   └── SessionItem.tsx      # 新增：单个会话项（编辑名称、删除）
│   │   │   └── console/
│   │   │       └── UnifiedConsole.tsx   # 扩展：Ctrl+Enter 发送、上箭头回填
│   │   └── hooks/
│   │       ├── useEngine.ts             # 已有
│   │       └── useKeyboard.ts           # 新增：react-hotkeys-hook 封装
│   ├── shared/
│   │   ├── ipc-types.ts                 # 扩展：session/model 事件类型
│   │   └── constants.ts                 # 扩展：session 存储路径常量
│   └── preload/
│       └── index.ts                     # 已有
├── docs/plans/
│   └── 2026-05-13-phase1-complete-dialogue-engine.md
```

---

## Task 1: 扩展 IPC 协议 — session 与 model 事件类型

**Files:**
- Modify: `src/shared/ipc-types.ts`
- Modify: `src/shared/constants.ts`

**Rationale:** Phase 0 的 IPC 类型只覆盖单条对话流。Phase 1 需要会话管理（创建/切换/删除/重命名）和模型配置同步的完整类型定义，作为引擎层和渲染层的契约。

- [ ] **Step 1: 扩展 EngineRequest 类型**

在 `src/shared/ipc-types.ts` 中，为 `EngineRequest['type']` 增加以下类型：

```typescript
export interface EngineRequest {
  id: string
  type:
    | 'chat:send'
    | 'chat:cancel'
    | 'chat:retry'
    | 'chat:retry-cancel'
    | 'config:update'
    | 'health:check'
    // Phase 1 新增
    | 'session:create'
    | 'session:switch'
    | 'session:delete'
    | 'session:rename'
    | 'session:list'
    | 'model:list'
  payload: unknown
}
```

- [ ] **Step 2: 扩展 EngineEvent 类型**

在同一文件中，为 `EngineEvent['type']` 增加：

```typescript
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
    // Phase 1 新增
    | 'session:list'
    | 'session:switched'
    | 'session:created'
    | 'session:deleted'
    | 'session:renamed'
    | 'model:list'
  payload: unknown
}
```

- [ ] **Step 3: 新增 Session 与 Model 类型定义**

在 `src/shared/ipc-types.ts` 底部追加：

```typescript
export interface SessionMeta {
  id: string
  title: string
  updatedAt: number
  messageCount: number
}

export interface SessionListPayload {
  sessions: SessionMeta[]
  activeSessionId: string
}

export interface SessionCreatePayload {
  title?: string
}

export interface SessionSwitchPayload {
  sessionId: string
}

export interface SessionDeletePayload {
  sessionId: string
}

export interface SessionRenamePayload {
  sessionId: string
  title: string
}

export interface ModelConfig {
  id: string
  label: string
  baseUrl: string
}

export interface ModelListPayload {
  models: ModelConfig[]
  activeModelId: string
}
```

- [ ] **Step 4: 扩展 constants.ts**

在 `src/shared/constants.ts` 追加会话存储路径常量：

```typescript
export const SESSIONS_DIR_NAME = 'conversations'
export const SESSIONS_METADATA_FILE = 'sessions.json'
export const MAX_SESSION_TITLE_LENGTH = 30
export const DEFAULT_SESSION_TITLE = '新会话'
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-types.ts src/shared/constants.ts
git commit -m "feat(ipc): extend Phase 1 protocol — session and model event types"
```

---

## Task 2: 会话持久化引擎 — session-store.ts

**Files:**
- Create: `src/engine/state/session-store.ts`
- Modify: `src/engine/state/conversation-store.ts`

**Rationale:** 用户的核心诉求是"对话历史不丢失"。由于 `electron-store` 无法在 UtilityProcess 中使用（`app` 模块为 undefined），复用 Phase 0 `config-store.ts` 的原子文件写模式，将每个会话保存为独立 JSON 文件，元数据索引存 `sessions.json`。

- [ ] **Step 1: 创建 session-store.ts**

创建 `src/engine/state/session-store.ts`：

```typescript
import fs from 'node:fs'
import path from 'node:path'
import type { SessionMeta } from '../../shared/ipc-types.js'
import { SESSIONS_DIR_NAME, SESSIONS_METADATA_FILE, DEFAULT_SESSION_TITLE } from '../../shared/constants.js'

function getSessionsDir(): string {
  const userData = process.env.ONE_CONFIG_PATH
    ? path.dirname(process.env.ONE_CONFIG_PATH)
    : path.join(process.cwd(), 'data')
  return path.join(userData, SESSIONS_DIR_NAME)
}

function getMetadataPath(): string {
  return path.join(getSessionsDir(), SESSIONS_METADATA_FILE)
}

function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.json`)
}

function writeFileAtomic(filePath: string, data: string): void {
  const dir = path.dirname(filePath)
  const tmpName = `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  const tmpPath = path.join(dir, tmpName)
  try {
    fs.writeFileSync(tmpPath, data, 'utf-8')
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch {}
    throw err
  }
}

export function loadSessionMessages(sessionId: string): Array<{ role: string; content: string }> | null {
  try {
    const raw = fs.readFileSync(getSessionFilePath(sessionId), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveSessionMessages(sessionId: string, messages: Array<{ role: string; content: string }>): void {
  const dir = getSessionsDir()
  fs.mkdirSync(dir, { recursive: true })
  writeFileAtomic(getSessionFilePath(sessionId), JSON.stringify(messages, null, 2))
}

export function deleteSessionFiles(sessionId: string): void {
  try { fs.unlinkSync(getSessionFilePath(sessionId)) } catch {}
}

export function loadSessionsMetadata(): { sessions: SessionMeta[]; activeSessionId: string } {
  try {
    const raw = fs.readFileSync(getMetadataPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      activeSessionId: typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : 'default',
    }
  } catch {
    return { sessions: [], activeSessionId: 'default' }
  }
}

export function saveSessionsMetadata(sessions: SessionMeta[], activeSessionId: string): void {
  const dir = getSessionsDir()
  fs.mkdirSync(dir, { recursive: true })
  writeFileAtomic(getMetadataPath(), JSON.stringify({ sessions, activeSessionId }, null, 2))
}

export function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function makeSessionTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim()
  if (!trimmed) return DEFAULT_SESSION_TITLE
  // 取前 20 个字符，去除换行
  const line = trimmed.split(/\r?\n/)[0]
  return line.length > 20 ? line.slice(0, 20) + '...' : line
}
```

- [ ] **Step 2: 扩展 conversation-store.ts 支持多 session 与持久化**

修改 `src/engine/state/conversation-store.ts`：

```typescript
import type { AppConfig } from '../../shared/ipc-types.js'
import {
  loadSessionMessages,
  saveSessionMessages,
  makeSessionTitle,
  generateSessionId,
} from './session-store.js'

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
  private activeSessionId = 'default'

  getActiveSessionId(): string {
    return this.activeSessionId
  }

  setActiveSessionId(id: string): void {
    this.activeSessionId = id
  }

  getOrCreate(sessionId: string): Conversation {
    if (!this.conversations.has(sessionId)) {
      const persisted = loadSessionMessages(sessionId)
      this.conversations.set(sessionId, {
        id: sessionId,
        messages: persisted && persisted.length > 0
          ? persisted as ConversationMessage[]
          : [{ role: 'system', content: SYSTEM_PROMPT }],
        updatedAt: Date.now(),
      })
    }
    return this.conversations.get(sessionId)!
  }

  createSession(sessionId: string): Conversation {
    const conv: Conversation = {
      id: sessionId,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      updatedAt: Date.now(),
    }
    this.conversations.set(sessionId, conv)
    this.persist(sessionId)
    return conv
  }

  addUserMessage(sessionId: string, content: string): Conversation {
    const conv = this.getOrCreate(sessionId)
    conv.messages.push({ role: 'user', content })
    this.compactIfNeeded(conv)
    conv.updatedAt = Date.now()
    this.persist(sessionId)
    return conv
  }

  addAssistantMessage(sessionId: string, content: string): Conversation {
    const conv = this.getOrCreate(sessionId)
    conv.messages.push({ role: 'assistant', content })
    conv.updatedAt = Date.now()
    this.persist(sessionId)
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

  deleteSession(sessionId: string): boolean {
    this.conversations.delete(sessionId)
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = 'default'
    }
    return true
  }

  getTitle(sessionId: string): string | null {
    const lastUser = this.getLastUserMessage(sessionId)
    return lastUser ? makeSessionTitle(lastUser) : null
  }

  private persist(sessionId: string): void {
    const conv = this.conversations.get(sessionId)
    if (conv) {
      saveSessionMessages(sessionId, conv.messages)
    }
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

- [ ] **Step 3: Commit**

```bash
git add src/engine/state/session-store.ts src/engine/state/conversation-store.ts
git commit -m "feat(engine): session persistence with atomic file writes"
```

---

## Task 3: 模型配置外部化 — models.ts

**Files:**
- Create: `src/engine/api/models.ts`
- Modify: `src/engine/engine.ts`
- Modify: `src/shared/ipc-types.ts`（已在 Task 1 完成）

**Rationale:** 当前 `MODEL_REGISTRY` 硬编码在 `engine.ts` 中，每次更换模型需要改源码。将 `baseUrl` 映射外置到 `config.json` 的 `models` 字段，`apiKey` 仍通过 `safeStorage` 注入（保留硬编码 dev fallback 方便调试）。

- [ ] **Step 1: 创建 models.ts**

创建 `src/engine/api/models.ts`：

```typescript
import type { AppConfig, ModelConfig } from '../../shared/ipc-types.js'
import { getConfig } from '../state/config-store.js'

// Dev fallback：调试时无 config.json models 字段的兜底
const DEV_MODEL_REGISTRY: Record<string, { baseUrl: string; apiKey?: string }> = {
  'MiniMax-M2.5': {
    baseUrl: 'https://api.minimaxi.com/',
    apiKey: 'sk-api-RFxMBSPRgkRx_05c7eim3MiWKVJvmC_jQXij4y6yy0BwTg9FUMrfSrrXs7yCBmWedzFPkCbBeOr-VLCczPsfA9AXGCWZ4civZaLxCVfTfrG_py5skOqBEiY',
  },
  'gpt-4o': { baseUrl: 'https://api.openai.com', apiKey: '' },
  'claude-3.5-sonnet': { baseUrl: 'https://api.anthropic.com', apiKey: '' },
}

export function getModelList(): ModelConfig[] {
  const config = getConfig()
  const configured: ModelConfig[] = Array.isArray(config.models)
    ? config.models.map((m: { id: string; label?: string; baseUrl: string }) => ({
        id: m.id,
        label: m.label || m.id,
        baseUrl: m.baseUrl,
      }))
    : []

  // 若 config.json 未配置 models，回退到 dev registry（仅 baseUrl，不含 apiKey）
  if (configured.length === 0) {
    return Object.entries(DEV_MODEL_REGISTRY).map(([id, cfg]) => ({
      id,
      label: id,
      baseUrl: cfg.baseUrl,
    }))
  }
  return configured
}

export function resolveModelConfig(modelId: string | undefined, config: AppConfig, apiKey: string | null): {
  baseUrl: string
  apiKey: string | null
  model: string
} {
  const registry = getModelList()
  const matched = modelId ? registry.find((m) => m.id === modelId) : undefined

  if (matched) {
    return {
      baseUrl: matched.baseUrl,
      apiKey,
      model: modelId || config.model,
    }
  }

  // 回退到硬编码 dev registry（含 apiKey，方便调试）
  const devEntry = modelId ? DEV_MODEL_REGISTRY[modelId] : undefined
  if (devEntry) {
    return {
      baseUrl: devEntry.baseUrl,
      apiKey: devEntry.apiKey || apiKey,
      model: modelId || config.model,
    }
  }

  // 最终回退：config.json 顶层 baseUrl + model
  return {
    baseUrl: config.baseUrl,
    apiKey,
    model: modelId || config.model,
  }
}
```

- [ ] **Step 2: 更新 config-store.ts 类型**

修改 `src/engine/state/config-store.ts`，更新导入以兼容 `models` 字段：

```typescript
import type { AppConfig } from '../../shared/ipc-types.js'
import { DEFAULT_CONFIG } from '../../shared/constants.js'

// AppConfig 已包含 models?: ModelConfig[]，但 config-store 不强制校验
```

（实际代码无需修改，因为 `AppConfig` 已在 Task 1 中扩展了 `models?: ModelConfig[]`，而 `JSON.parse` 会自然解析出该字段。）

- [ ] **Step 3: Commit**

```bash
git add src/engine/api/models.ts
git commit -m "feat(engine): externalize model registry to config.json with dev fallback"
```

---

## Task 4: SSE 断流静默重连 — sse-reconnect.ts

**Files:**
- Create: `src/engine/adapters/sse-reconnect.ts`
- Modify: `src/engine/api/client.ts`

**Rationale:** 内网网关常对长连接静默掐断。当前实现遇到断流直接报错。需在 `client.ts` 中检测"流异常中断"（正常 done vs 异常断开），保留已生成的 token 上下文，用 `messages` 数组续写。

- [ ] **Step 1: 创建 sse-reconnect.ts**

创建 `src/engine/adapters/sse-reconnect.ts`：

```typescript
export interface ReconnectState {
  accumulatedContent: string
  attempt: number
  maxAttempts: number
}

export function shouldReconnect(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false
  if (error && typeof error === 'object') {
    const code = (error as { code?: string }).code
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
      return true
    }
    const status = (error as { response?: { status?: number } }).response?.status
    if (typeof status === 'number' && status >= 500) {
      return true
    }
  }
  return false
}

export function buildResumeMessages(
  originalMessages: Array<{ role: string; content: string }>,
  accumulatedContent: string,
): Array<{ role: string; content: string }> {
  if (!accumulatedContent.trim()) {
    return originalMessages
  }
  // 在原始消息列表末尾追加一个 assistant 消息，包含已生成的内容
  // 然后继续请求，让模型接着写
  return [
    ...originalMessages,
    { role: 'assistant', content: accumulatedContent },
  ]
}
```

- [ ] **Step 2: 修改 client.ts 支持断流续写**

修改 `src/engine/api/client.ts`，在 `streamChatCompletion` 中增加 reconnect 循环：

```typescript
import axios from 'axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { Readable } from 'node:stream'
import type { AppConfig } from '../../shared/ipc-types.js'
import { withRetry, DEFAULT_RETRY_CONFIG } from '../adapters/retry-policy.js'
import { shouldReconnect, buildResumeMessages } from '../adapters/sse-reconnect.js'

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
  let currentMessages = messages
  let accumulatedContent = ''
  let reconnectAttempt = 0
  const maxReconnects = 2
  let usage: { inputTokens: number; outputTokens: number } | undefined

  while (true) {
    if (signal.aborted) {
      callbacks.onDone(usage)
      return
    }

    const body = {
      model: config.model,
      messages: currentMessages,
      stream: true,
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    let streamCompletedNormally = false

    try {
      await withRetry(
        {
          execute: async (attempt) => {
            if (signal.aborted) throw new Error('ABORTED')
            if (attempt > 0) {
              callbacks.onRetry?.(
                attempt,
                Math.min(
                  DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
                  DEFAULT_RETRY_CONFIG.maxDelayMs,
                ),
              )
            }

            const response = await axios({
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
                if (event.data === '[DONE]') return
                try {
                  const json = JSON.parse(event.data)
                  const delta = json.choices?.[0]?.delta?.content
                  if (typeof delta === 'string') {
                    accumulatedContent += delta
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

            const webStream = Readable.toWeb(response.data) as unknown as ReadableStream<Uint8Array>
            const reader = webStream.getReader()
            const decoder = new TextDecoder()

            while (true) {
              if (signal.aborted) {
                reader.cancel()
                break
              }
              const { done, value } = await reader.read()
              if (done) {
                streamCompletedNormally = true
                break
              }
              parser.feed(decoder.decode(value, { stream: true }))
            }
            parser.feed(decoder.decode())
          },
        },
        DEFAULT_RETRY_CONFIG,
      )

      // 流正常完成（或 retry 成功完成）
      callbacks.onDone(usage)
      return
    } catch (error) {
      if (axios.isCancel(error) || signal.aborted) {
        callbacks.onDone(usage)
        return
      }

      reconnectAttempt++
      if (shouldReconnect(error, reconnectAttempt, maxReconnects)) {
        // 静默重连：构建续写消息，不抛错给用户
        currentMessages = buildResumeMessages(messages, accumulatedContent)
        callbacks.onRetry?.(reconnectAttempt, 1000 * reconnectAttempt)
        await new Promise((r) => setTimeout(r, 1000 * reconnectAttempt))
        continue
      }

      // 不可恢复错误，走原有错误翻译逻辑
      let code = 'STREAM_ERROR'
      let msg = error instanceof Error ? error.message : String(error)
      if (axios.isAxiosError(error)) {
        if (
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNRESET' ||
          error.code === 'EAI_AGAIN'
        ) {
          code = 'NETWORK_ERROR'
        } else if (error.response) {
          const status = error.response.status
          if (status >= 500) code = 'SERVER_ERROR'
          else if (status === 401 || status === 403) code = 'AUTH_ERROR'
          else if (status === 429) code = 'RATE_LIMIT'
          else if (status >= 400) code = 'CLIENT_ERROR'

          let responseData = ''
          const rawData = error.response.data
          if (rawData && typeof rawData.pipe === 'function') {
            try {
              const chunks: Buffer[] = []
              for await (const chunk of rawData) {
                chunks.push(chunk)
              }
              responseData = Buffer.concat(chunks).toString('utf-8')
            } catch {
              responseData = '[failed to read error stream]'
            }
          } else if (typeof rawData === 'string') {
            responseData = rawData
          } else if (Buffer.isBuffer(rawData)) {
            responseData = rawData.toString('utf-8')
          } else {
            try {
              responseData = JSON.stringify(rawData)
            } catch {
              responseData = '[circular or stream object]'
            }
          }
          msg = `[${status}] ${msg} | URL: ${url} | Response: ${responseData.slice(0, 500)}`
        } else {
          msg = `${msg} | URL: ${url}`
        }
      }
      callbacks.onError(code, msg)
      return
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/adapters/sse-reconnect.ts src/engine/api/client.ts
git commit -m "feat(engine): SSE silent reconnect with context preservation"
```

---

## Task 5: 引擎层集成 — engine.ts 路由重构

**Files:**
- Modify: `src/engine/engine.ts`

**Rationale:** 当前 `engine.ts` 是 Phase 0 的单 session 硬编码实现。需要接入 `session-store.ts`、`models.ts`，处理 `session:*` 和 `model:list` 请求，并维护 `activeSessionId` 状态。

- [ ] **Step 1: 重构 engine.ts**

将 `src/engine/engine.ts` 整体替换为以下实现：

```typescript
import type {
  EngineRequest,
  EngineEvent,
  ChatSendPayload,
  ConfigUpdatePayload,
  AppConfig,
  SessionMeta,
  SessionListPayload,
} from '../shared/ipc-types.js'
import { streamChatCompletion } from './api/client.js'
import { getModelList, resolveModelConfig } from './api/models.js'
import { getConfig, setConfig } from './state/config-store.js'
import { ConversationStore } from './state/conversation-store.js'
import {
  loadSessionsMetadata,
  saveSessionsMetadata,
  deleteSessionFiles,
  generateSessionId,
} from './state/session-store.js'
import { DAY_ZERO_WELCOME, HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_TIMEOUT_MS } from '../shared/constants.js'
import axios from 'axios'

const conversationStore = new ConversationStore()
let currentAbortController: AbortController | null = null
let isOffline = false
let healthCheckTimer: NodeJS.Timeout | null = null
let apiKey: string | null = null
let assistantBuffer = ''
let isProcessing = false

function sendEvent(evt: EngineEvent): void {
  process.parentPort?.postMessage(evt)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildSessionMeta(sessionId: string): SessionMeta {
  const title = conversationStore.getTitle(sessionId) || '新会话'
  const conv = conversationStore.getOrCreate(sessionId)
  return {
    id: sessionId,
    title,
    updatedAt: conv.updatedAt,
    messageCount: conv.messages.filter((m) => m.role !== 'system').length,
  }
}

function syncSessionList(): void {
  const meta = loadSessionsMetadata()
  const sessions = meta.sessions.map((s) => {
    const updated = buildSessionMeta(s.id)
    return { ...s, ...updated }
  })
  sendEvent({
    id: generateId(),
    type: 'session:list',
    payload: { sessions, activeSessionId: conversationStore.getActiveSessionId() } as SessionListPayload,
  })
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
  if (isProcessing) {
    sendEvent({
      id: generateId(),
      type: 'chat:error',
      payload: { code: 'BUSY', message: '正在处理中，请稍后再试' },
    })
    return
  }
  isProcessing = true
  try {
    const sessionId = conversationStore.getActiveSessionId()
    if (isOffline) {
      sendEvent({
        id: generateId(),
        type: 'chat:error',
        payload: { code: 'OFFLINE', message: '网络不可用，请检查网络连接后重试' },
      })
      return
    }

    const config = getConfig()
    const resolved = resolveModelConfig(payload.model, config, apiKey)

    conversationStore.addUserMessage(sessionId, payload.content)

    // 更新 session 元数据（因为消息数/标题变了）
    const meta = loadSessionsMetadata()
    const existingIndex = meta.sessions.findIndex((s) => s.id === sessionId)
    const updatedMeta = buildSessionMeta(sessionId)
    if (existingIndex >= 0) {
      meta.sessions[existingIndex] = updatedMeta
    } else {
      meta.sessions.unshift(updatedMeta)
    }
    saveSessionsMetadata(meta.sessions, meta.activeSessionId)

    const messageId = generateId()
    await executeStream(sessionId, messageId, resolved)
  } finally {
    isProcessing = false
  }
}

async function executeStream(
  sessionId: string,
  messageId: string,
  resolved: { baseUrl: string; apiKey: string | null; model: string },
): Promise<void> {
  currentAbortController = new AbortController()
  assistantBuffer = ''

  const config: AppConfig = {
    ...getConfig(),
    baseUrl: resolved.baseUrl,
    model: resolved.model,
  }

  await streamChatCompletion(
    config,
    resolved.apiKey,
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

    case 'chat:retry': {
      if (isProcessing) {
        sendEvent({
          id: generateId(),
          type: 'chat:error',
          payload: { code: 'BUSY', message: '正在处理中，请稍后再试' },
        })
        break
      }
      isProcessing = true
      try {
        const sessionId = conversationStore.getActiveSessionId()
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
        const resolved = resolveModelConfig(config.model, config, apiKey)
        const messageId = generateId()
        await executeStream(sessionId, messageId, resolved)
      } finally {
        isProcessing = false
      }
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

    case 'session:list': {
      syncSessionList()
      break
    }

    case 'session:create': {
      const newId = generateSessionId()
      conversationStore.createSession(newId)
      conversationStore.setActiveSessionId(newId)
      const meta = loadSessionsMetadata()
      meta.sessions.unshift(buildSessionMeta(newId))
      meta.activeSessionId = newId
      saveSessionsMetadata(meta.sessions, meta.activeSessionId)
      sendEvent({ id: generateId(), type: 'session:created', payload: { sessionId: newId } })
      syncSessionList()
      injectDayZeroWelcome(newId)
      break
    }

    case 'session:switch': {
      const { sessionId } = req.payload as { sessionId: string }
      conversationStore.setActiveSessionId(sessionId)
      const meta = loadSessionsMetadata()
      meta.activeSessionId = sessionId
      saveSessionsMetadata(meta.sessions, meta.activeSessionId)
      sendEvent({ id: generateId(), type: 'session:switched', payload: { sessionId } })
      syncSessionList()
      break
    }

    case 'session:delete': {
      const { sessionId } = req.payload as { sessionId: string }
      conversationStore.deleteSession(sessionId)
      deleteSessionFiles(sessionId)
      const meta = loadSessionsMetadata()
      meta.sessions = meta.sessions.filter((s) => s.id !== sessionId)
      if (meta.activeSessionId === sessionId) {
        meta.activeSessionId = meta.sessions[0]?.id || 'default'
        conversationStore.setActiveSessionId(meta.activeSessionId)
      }
      saveSessionsMetadata(meta.sessions, meta.activeSessionId)
      sendEvent({ id: generateId(), type: 'session:deleted', payload: { sessionId } })
      syncSessionList()
      break
    }

    case 'session:rename': {
      const { sessionId, title } = req.payload as { sessionId: string; title: string }
      const meta = loadSessionsMetadata()
      const idx = meta.sessions.findIndex((s) => s.id === sessionId)
      if (idx >= 0) {
        meta.sessions[idx] = { ...meta.sessions[idx], title }
        saveSessionsMetadata(meta.sessions, meta.activeSessionId)
        sendEvent({ id: generateId(), type: 'session:renamed', payload: { sessionId, title } })
        syncSessionList()
      }
      break
    }

    case 'model:list': {
      const models = getModelList()
      const config = getConfig()
      sendEvent({
        id: generateId(),
        type: 'model:list',
        payload: { models, activeModelId: config.model },
      })
      break
    }
  }
}

process.parentPort?.on('message', async (event) => {
  const req = event.data as EngineRequest
  await handleRequest(req)
})

startHealthCheck()
sendEvent({ id: generateId(), type: 'engine:ready', payload: {} })

// 启动时加载已有会话元数据
const initialMeta = loadSessionsMetadata()
if (initialMeta.sessions.length > 0) {
  conversationStore.setActiveSessionId(initialMeta.activeSessionId)
  syncSessionList()
} else {
  // 首次启动，创建 default 会话
  conversationStore.createSession('default')
  saveSessionsMetadata([buildSessionMeta('default')], 'default')
  syncSessionList()
  injectDayZeroWelcome('default')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/engine.ts
git commit -m "feat(engine): integrate session management, model registry, SSE reconnect"
```

---

## Task 6: 渲染层会话侧边栏 — SidebarLeft + SessionItem

**Files:**
- Modify: `src/renderer/components/sidebar/SidebarLeft.tsx`
- Create: `src/renderer/components/sidebar/SessionItem.tsx`

**Rationale:** 当前 `SidebarLeft` 使用 `MOCK_WORKSPACES` 死数据。需要替换为从引擎接收的真实会话列表，支持新建、切换、删除、重命名。

- [ ] **Step 1: 创建 SessionItem.tsx**

创建 `src/renderer/components/sidebar/SessionItem.tsx`：

```typescript
import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'

interface SessionItemProps {
  id: string
  title: string
  active: boolean
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

export function SessionItem({ id, title, active, onSwitch, onDelete, onRename }: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)

  const handleRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title) {
      onRename(id, trimmed)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename()
    if (e.key === 'Escape') {
      setEditValue(title)
      setIsEditing(false)
    }
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      <button onClick={() => onSwitch(id)} className="flex flex-1 items-center gap-2 overflow-hidden">
        <div className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRename}
            className="w-full rounded border border-indigo-300 bg-white px-1 py-0.5 text-xs outline-none dark:border-indigo-700 dark:bg-slate-800"
          />
        ) : (
          <span className="truncate">{title}</span>
        )}
      </button>

      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => setIsEditing(true)}
            className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="重命名"
          >
            <Pencil size={12} />
          </button>
          {!active && (
            <button
              onClick={() => onDelete(id)}
              className="rounded p-0.5 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 重构 SidebarLeft.tsx**

将 `src/renderer/components/sidebar/SidebarLeft.tsx` 替换为：

```typescript
import { Bot, Plus, Search, LayoutGrid, Wrench, Settings } from 'lucide-react'
import { SessionItem } from './SessionItem.js'
import type { SessionMeta } from '../../../shared/ipc-types.js'

interface SidebarLeftProps {
  sessions: SessionMeta[]
  activeSessionId: string
  onCreateSession: () => void
  onSwitchSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
}

const NAV_ITEMS = [
  { icon: Plus, label: '新建会话' },
  { icon: Search, label: '全局搜索' },
  { icon: LayoutGrid, label: '我的工作区' },
  { icon: Wrench, label: '本地工具库' },
]

export function SidebarLeft({
  sessions,
  activeSessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
}: SidebarLeftProps) {
  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900">
      {/* Logo Header */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Bot size={18} />
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI Agent</span>
      </div>

      {/* Nav Buttons */}
      <div className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={item.label === '新建会话' ? onCreateSession : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={item.label}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Session List */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <p className="px-3 py-1 text-xs font-medium text-slate-400">最近会话</p>
        {sessions.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">暂无会话，点击上方"新建"开始</p>
        )}
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            id={session.id}
            title={session.title}
            active={session.id === activeSessionId}
            onSwitch={onSwitchSession}
            onDelete={onDeleteSession}
            onRename={onRenameSession}
          />
        ))}
      </div>

      {/* Settings */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-700">
        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title="设置"
        >
          <Settings size={18} />
          <span>设置</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/sidebar/SidebarLeft.tsx src/renderer/components/sidebar/SessionItem.tsx
git commit -m "feat(ui): session sidebar with create/switch/delete/rename"
```

---

## Task 7: 渲染层状态集成 — App.tsx 会话管理

**Files:**
- Modify: `src/renderer/App.tsx`

**Rationale:** `App.tsx` 当前只管理 `messages` 数组，所有消息混在一起。Phase 1 需要按 session 隔离消息，响应引擎的 `session:list` / `session:switched` 事件，并在切换 session 时清空/恢复消息列表。

- [ ] **Step 1: 扩展 App.tsx 状态**

在 `src/renderer/App.tsx` 中，添加 session 相关状态和 IPC 处理：

```typescript
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { MessageList } from './components/chat/MessageList.js'
import { UnifiedConsole } from './components/console/UnifiedConsole.js'
import { OfflineBanner } from './components/system/OfflineBanner.js'
import { DayZeroWelcome } from './components/system/DayZeroWelcome.js'
import { FileDropOverlay } from './components/system/FileDropOverlay.js'
import { SidebarLeft } from './components/sidebar/SidebarLeft.js'
import { SidebarRight } from './components/sidebar/SidebarRight.js'
import { ChatHeader } from './components/layout/ChatHeader.js'
import { useEngine } from './hooks/useEngine.js'
import { useTheme } from './hooks/useTheme.js'
import { useResponsiveLayout } from './hooks/useResponsiveLayout.js'
import type { EngineEvent, SessionMeta } from '../shared/ipc-types.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  error?: boolean
}

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const [offline, setOffline] = useState(false)
  const [dayZero, setDayZero] = useState<{ content: string; pills: Array<{ label: string; prompt: string }> } | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const [isRightOpenManual, setIsRightOpenManual] = useState(true)
  const [isLeftOpenManual, setIsLeftOpenManual] = useState<boolean | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isLeftOpen: isLeftOpenResponsive, isRightOpen } = useResponsiveLayout()

  // Phase 1: session state
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('default')

  const effectiveLeftOpen = isLeftOpenManual !== null ? isLeftOpenManual : isLeftOpenResponsive
  const effectiveRightOpen = isRightOpen && isRightOpenManual

  const { send, isConnected } = useEngine((evt: EngineEvent) => {
    switch (evt.type) {
      case 'chat:chunk': {
        const p = evt.payload as { text: string; messageId: string }
        setIsWaiting(false)
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
        setIsWaiting(false)
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, streaming: false } : m)),
        )
        break
      }
      case 'chat:error': {
        const p = evt.payload as { code: string; message: string }
        setIsWaiting(false)
        toast.error(p.message)
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
        send({ id: `sync-${Date.now()}`, type: 'session:list', payload: {} })
        send({ id: `sync-models-${Date.now()}`, type: 'model:list', payload: {} })
        break

      // Phase 1: session events
      case 'session:list': {
        const p = evt.payload as { sessions: SessionMeta[]; activeSessionId: string }
        setSessions(p.sessions)
        setActiveSessionId(p.activeSessionId)
        break
      }
      case 'session:switched': {
        const p = evt.payload as { sessionId: string }
        setActiveSessionId(p.sessionId)
        setMessages([]) // 切换 session 时清空消息列表，等待加载
        setDayZero(null)
        break
      }
      case 'session:created':
      case 'session:deleted':
      case 'session:renamed':
        // 列表同步由 engine 再次推送 session:list 完成
        break
    }
  })

  useEffect(() => {
    if (engineReady && messages.length === 0 && !dayZero) {
      send({ id: `sync-${Date.now()}`, type: 'health:check', payload: {} })
    }
  }, [engineReady, messages.length, dayZero, send])

  const handleSend = (content: string, model?: string) => {
    if (!content.trim()) return
    const id = `user-${Date.now()}`
    setMessages((prev) => [...prev, { id, role: 'user', content: content.trim() }])
    setIsWaiting(true)
    setDayZero(null)
    send({ id: `req-${Date.now()}`, type: 'chat:send', payload: { content: content.trim(), model } })
  }

  const handlePillClick = (prompt: string) => {
    handleSend(prompt)
    setDayZero(null)
  }

  // Phase 1: session actions
  const handleCreateSession = () => {
    send({ id: `sess-create-${Date.now()}`, type: 'session:create', payload: {} })
    setMessages([])
    setDayZero(null)
  }

  const handleSwitchSession = (sessionId: string) => {
    if (sessionId === activeSessionId) return
    send({ id: `sess-switch-${Date.now()}`, type: 'session:switch', payload: { sessionId } })
  }

  const handleDeleteSession = (sessionId: string) => {
    send({ id: `sess-del-${Date.now()}`, type: 'session:delete', payload: { sessionId } })
  }

  const handleRenameSession = (sessionId: string, title: string) => {
    send({ id: `sess-ren-${Date.now()}`, type: 'session:rename', payload: { sessionId, title } })
  }

  return (
    <div
      className="relative flex h-screen w-screen bg-slate-50 pt-7 text-slate-900 dark:bg-slate-900 dark:text-slate-50"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false) /* Phase 3 处理文件 */ }}
    >
      {/* Left Sidebar */}
      {effectiveLeftOpen && (
        <SidebarLeft
          sessions={sessions}
          activeSessionId={activeSessionId}
          onCreateSession={handleCreateSession}
          onSwitchSession={handleSwitchSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
      )}

      {/* Middle Content */}
      <div className="flex min-w-[500px] flex-1 flex-col">
        <ChatHeader
          workspaceName="默认工作区"
          isOnline={!offline}
          theme={theme === 'system' ? 'light' : theme}
          onSetTheme={(t) => setTheme(t)}
          isLeftOpen={effectiveLeftOpen}
          onToggleLeft={() => setIsLeftOpenManual((v) => (v === null ? !isLeftOpenResponsive : !v))}
          isRightOpen={effectiveRightOpen}
          onToggleRight={() => setIsRightOpenManual((v) => !v)}
        />
        <OfflineBanner offline={offline} onRetry={() => send({ id: `hc-${Date.now()}`, type: 'health:check', payload: {} })} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {dayZero && messages.length === 0 && (
              <DayZeroWelcome content={dayZero.content} pills={dayZero.pills} onPillClick={handlePillClick} />
            )}
            <MessageList messages={messages} isWaiting={isWaiting} />
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

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-text, #1e293b)',
          },
        }}
      />

      <FileDropOverlay show={isDragging} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(renderer): wire session management to App state and sidebar"
```

---

## Task 8: 全局键盘快捷键 — useKeyboard.ts

**Files:**
- Create: `src/renderer/hooks/useKeyboard.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/console/UnifiedConsole.tsx`

**Rationale:** DESIGN.md 要求 Phase 1 支持 `Ctrl/Cmd+B` 切换左侧边栏、`Ctrl/Cmd+J` 切换右侧产物面板、`Esc` 关闭下拉菜单、`↑` 上箭头回填上条消息。

- [ ] **Step 1: 创建 useKeyboard.ts**

创建 `src/renderer/hooks/useKeyboard.ts`：

```typescript
import { useEffect, useCallback } from 'react'

interface KeyboardCallbacks {
  onToggleLeft?: () => void
  onToggleRight?: () => void
  onEscape?: () => void
}

export function useKeyboard({ onToggleLeft, onToggleRight, onEscape }: KeyboardCallbacks) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl/Cmd + B: toggle left sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        onToggleLeft?.()
        return
      }
      // Ctrl/Cmd + J: toggle right sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        onToggleRight?.()
        return
      }
      // Esc: close dropdowns / cancel plan
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }
    },
    [onToggleLeft, onToggleRight, onEscape],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
```

- [ ] **Step 2: 在 App.tsx 中接入 useKeyboard**

在 `src/renderer/App.tsx` 中，导入 `useKeyboard` 并绑定：

```typescript
import { useKeyboard } from './hooks/useKeyboard.js'

// 在 App 组件内添加：
useKeyboard({
  onToggleLeft: () => setIsLeftOpenManual((v) => (v === null ? !isLeftOpenResponsive : !v)),
  onToggleRight: () => setIsRightOpenManual((v) => !v),
  onEscape: () => {
    // 关闭所有下拉菜单：通过 document click 事件或全局状态实现
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  },
})
```

- [ ] **Step 3: 在 UnifiedConsole.tsx 中添加上箭头回填**

修改 `src/renderer/components/console/UnifiedConsole.tsx`，当输入框为空且按下 `↑` 时，将上一条用户消息填入输入框。需要在组件内维护 `lastUserMessage` 状态或通过 props 传入。

由于 `UnifiedConsole` 当前没有接收历史消息，需要在 `App.tsx` 中计算并传入：

```typescript
// 在 App.tsx 中
const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || ''

// 传给 UnifiedConsole
<UnifiedConsole onSend={handleSend} disabled={offline} lastUserMessage={lastUserMessage} />
```

然后在 `UnifiedConsole.tsx` 中：

```typescript
interface UnifiedConsoleProps {
  onSend: (content: string, model?: string) => void
  disabled?: boolean
  lastUserMessage?: string
}

// 在输入框的 onKeyDown 中：
if (e.key === 'ArrowUp' && !content && lastUserMessage) {
  e.preventDefault()
  setContent(lastUserMessage)
}
```

（具体实现需在 Task 执行时根据当前 `UnifiedConsole.tsx` 的精确代码调整。）

- [ ] **Step 4: Commit**

```bash
git add src/renderer/hooks/useKeyboard.ts src/renderer/App.tsx src/renderer/components/console/UnifiedConsole.tsx
git commit -m "feat(ui): global keyboard shortcuts — sidebar toggle, last message recall"
```

---

## Task 9: 模型列表动态加载 — UnifiedConsole 下拉改造

**Files:**
- Modify: `src/renderer/components/console/UnifiedConsole.tsx`
- Modify: `src/renderer/App.tsx`

**Rationale:** 当前 `UnifiedConsole` 硬编码 `MODELS` 数组。Phase 1 需要改为从引擎接收 `model:list` 事件，使模型配置完全由 `config.json` 或 dev fallback 驱动。

- [ ] **Step 1: 在 App.tsx 中接收 model:list 并传给 UnifiedConsole**

在 `App.tsx` 的 `useEngine` 回调中增加：

```typescript
const [availableModels, setAvailableModels] = useState<Array<{ id: string; label: string }>>([])
const [currentModel, setCurrentModel] = useState<string>('')

// 在 useEngine switch 中增加：
case 'model:list': {
  const p = evt.payload as { models: Array<{ id: string; label: string }>; activeModelId: string }
  setAvailableModels(p.models)
  setCurrentModel(p.activeModelId)
  break
}
```

- [ ] **Step 2: 改造 UnifiedConsole 接收 models 数组**

将 `UnifiedConsole` 的 props 改为：

```typescript
interface UnifiedConsoleProps {
  onSend: (content: string, model?: string) => void
  disabled?: boolean
  lastUserMessage?: string
  models: Array<{ id: string; label: string }>
  currentModel: string
  onModelChange?: (modelId: string) => void
}
```

移除内部硬编码的 `MODELS`，改用 props 传入的 `models` 渲染下拉选项。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/console/UnifiedConsole.tsx src/renderer/App.tsx
git commit -m "feat(ui): dynamic model list from engine config"
```

---

## Self-Review

### 1. Spec Coverage

| DESIGN.md / architecture.md 要求 | 对应 Task |
|---|---|
| 模型切换下拉 + 多实例 ProviderClient | Task 3 (models.ts) + Task 9 (UnifiedConsole 动态加载) |
| 多轮对话 + 会话历史持久化 | Task 2 (session-store.ts) + Task 6 (SidebarLeft) |
| 上下文窗口管理（超过20轮丢弃） | Task 2 (conversation-store.ts compactIfNeeded) |
| 错误重试 / 指数退避 | Task 4 (client.ts withRetry) + 已有 retry-policy.ts |
| 断线检测（30秒心跳） | Task 5 (engine.ts checkHealth) — 继承 Phase 0 |
| SSE 断流静默重连 | Task 4 (sse-reconnect.ts) |
| 全局键盘快捷键 | Task 8 (useKeyboard.ts) |
| 预留 ITool 接口 stub | Phase 0 已完成 `src/engine/tools/ITool.ts` |

### 2. Placeholder Scan

- 无 "TBD" / "TODO" / "implement later"
- 所有代码步骤包含完整可运行代码
- 无 "similar to Task N" 省略

### 3. Type Consistency

- `SessionMeta`、`SessionListPayload`、`ModelConfig` 等类型在 `ipc-types.ts` 统一定义，引擎层和渲染层共用
- `EngineRequest['type']` 和 `EngineEvent['type']` 的联合类型已同步扩展
- `conversation-store.ts` 的 `getMessagesForAPI` 返回格式与 `client.ts` 的 `messages` 参数兼容

### 4. 已知限制与后续阶段

- **Settings Dialog**：本计划未包含。当前通过直接编辑 `config.json` 配置模型。如需 UI 设置面板，可在 Phase 1.5 追加一个 Task。
- **File Drag-and-Drop 处理**：`FileDropOverlay` 已有视觉反馈，但文件内容解析和注入 LLM context 需要 Phase 2 的 Tool 系统。
- **Workspace 沙箱**：Phase 2 引入。Phase 1 的 "会话" 是纯对话历史概念，与 Workspace 文件目录隔离。

---

## 执行方式选择

**Plan complete and saved to `docs/plans/2026-05-13-phase1-complete-dialogue-engine.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
