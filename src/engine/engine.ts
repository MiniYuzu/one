// src/engine/engine.ts
import type { EngineRequest, EngineEvent, ChatSendPayload, ConfigUpdatePayload, AppConfig } from '../shared/ipc-types.js'
import { streamAnthropicMessages } from './api/anthropicClient.js'
import { getConfig, setConfig } from './state/config-store.js'
import { DAY_ZERO_WELCOME, HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_TIMEOUT_MS } from '../shared/constants.js'
import axios from 'axios'
import { QueryEngine } from './query/QueryEngine.js'
import { buildQueryConfig } from './query/queryConfig.js'
import { ALL_TOOLS } from './tools/Tool.js'
import path from 'node:path'

let currentQueryEngine: QueryEngine | null = null
let isOffline = false
let healthCheckTimer: NodeJS.Timeout | null = null
let apiKey: string | null = null

const MODEL_REGISTRY: Record<string, { baseUrl: string; apiKey: string }> = {
  'MiniMax-M2.5': {
    baseUrl: 'https://api.minimaxi.com/',
    apiKey: 'sk-api-RFxMBSPRgkRx_05c7eim3MiWKVJvmC_jQXij4y6yy0BwTg9FUMrfSrrXs7yCBmWedzFPkCbBeOr-VLCczPsfA9AXGCWZ4civZaLxCVfTfrG_py5skOqBEiY',
  },
  'gpt-4o': {
    baseUrl: 'https://api.openai.com',
    apiKey: '',
  },
  'claude-3.5-sonnet': {
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
  },
}
let isProcessing = false

function sendEvent(evt: EngineEvent): void {
  process.parentPort?.postMessage(evt)
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// NEVER use process.cwd() in Electron — it points to the app bundle.
// Fallback chain: ONE_WORKSPACE_PATH env → ONE_CONFIG_PATH dirname.
function getSafeWorkingDirectory(): string {
  if (process.env.ONE_WORKSPACE_PATH) return process.env.ONE_WORKSPACE_PATH
  if (process.env.ONE_CONFIG_PATH) {
    return path.join(path.dirname(process.env.ONE_CONFIG_PATH), 'workspace')
  }
  return path.join(process.cwd(), 'workspace')
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

function injectDayZeroWelcome(): void {
  sendEvent({
    id: generateId(),
    type: 'state:sync',
    payload: { dayZero: DAY_ZERO_WELCOME },
  })
}

function createQueryEngine(config: AppConfig, effectiveApiKey: string | null): QueryEngine {
  const modelEntry = MODEL_REGISTRY[config.model]
  const baseUrl = modelEntry?.baseUrl || config.baseUrl
  const key = modelEntry?.apiKey || effectiveApiKey || config.apiKey || null

  return new QueryEngine({
    config: buildQueryConfig({
      model: config.model,
      baseUrl,
      apiKey: key,
      temperature: 1,
      maxTokens: 4096,
    }),
    tools: ALL_TOOLS,
    deps: {
      callModel: (messages, systemPrompt, options) =>
        streamAnthropicMessages(messages, systemPrompt, {
          model: options.model,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          signal: options.signal,
          tools: options.tools,
        }),
      uuid: () => generateId(),
    },
    workingDirectory: getSafeWorkingDirectory(),
  })
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
    if (isOffline) {
      sendEvent({
        id: generateId(),
        type: 'chat:error',
        payload: { code: 'OFFLINE', message: '网络不可用，请检查网络连接后重试' },
      })
      return
    }

    const config = getConfig()
    const modelEntry = payload.model ? MODEL_REGISTRY[payload.model] : null
    const effectiveConfig: AppConfig = modelEntry
      ? { ...config, baseUrl: modelEntry.baseUrl, model: payload.model! }
      : payload.model
        ? { ...config, model: payload.model }
        : config
    const effectiveApiKey = modelEntry?.apiKey || apiKey

    currentQueryEngine = createQueryEngine(effectiveConfig, effectiveApiKey)
    const messageId = generateId()

    for await (const msg of currentQueryEngine.submitMessage(payload.content)) {
      // 透传重试等 transient system 消息，作为临时状态展示
      if (msg.type === 'system') {
        sendEvent({ id: generateId(), type: 'chat:chunk', payload: { text: `> ${msg.content}\n\n`, messageId } })
        continue
      }

      const assistantMessage = msg
      const textBlocks = assistantMessage.content.filter(c => c.type === 'text')
      const toolUseBlocks = assistantMessage.content.filter(c => c.type === 'tool_use')

      for (const tb of textBlocks) {
        sendEvent({ id: generateId(), type: 'chat:chunk', payload: { text: tb.text, messageId } })
      }

      for (const tu of toolUseBlocks) {
        sendEvent({
          id: generateId(),
          type: 'chat:tool_use',
          payload: {
            id: tu.id,
            name: tu.name,
            input: typeof tu.input === 'string' ? tu.input : JSON.stringify(tu.input),
            messageId,
          },
        })
      }

      // If this assistant message was followed by tool results inside the engine,
      // we need to surface them. The QueryEngine does not expose intermediate user/tool_result
      // messages from submitMessage, so we inspect the engine's internal history after each yield.
      const history = (currentQueryEngine as unknown as { messages: Array<{ type: string; content: unknown[] }> }).messages
      const lastMessage = history[history.length - 1]
      if (lastMessage && lastMessage.type === 'user') {
        const toolResults = lastMessage.content.filter((c: unknown) => (c as { type?: string }).type === 'tool_result')
        for (const tr of toolResults) {
          const result = tr as { tool_use_id: string; content: string; is_error?: boolean }
          const preview = result.content.length > 500 ? result.content.slice(0, 500) + '...' : result.content
          sendEvent({
            id: generateId(),
            type: 'chat:tool_result',
            payload: {
              tool_use_id: result.tool_use_id,
              content: preview,
              is_error: result.is_error,
              messageId,
            },
          })
        }
      }
    }

    sendEvent({ id: generateId(), type: 'chat:end', payload: { messageId } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    sendEvent({ id: generateId(), type: 'chat:error', payload: { code: 'ENGINE_ERROR', message: msg } })
  } finally {
    isProcessing = false
    currentQueryEngine = null
  }
}

async function handleRequest(req: EngineRequest): Promise<void> {
  switch (req.type) {
    case 'chat:send':
      await handleChatSend(req.payload as ChatSendPayload)
      break
    case 'chat:cancel':
    case 'chat:retry-cancel':
      currentQueryEngine?.cancel()
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
injectDayZeroWelcome()
