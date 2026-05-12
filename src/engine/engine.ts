// src/engine/engine.ts
import type { EngineRequest, EngineEvent, ChatSendPayload, ConfigUpdatePayload } from '../shared/ipc-types.js'
import { streamChatCompletion } from './api/client.js'
import { getConfig, setConfig } from './state/config-store.js'
import { DAY_ZERO_WELCOME, HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_TIMEOUT_MS } from '../shared/constants.js'
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

// Bootstrap
process.parentPort?.on('message', async (event) => {
  const req = event.data as EngineRequest
  await handleRequest(req)
})

startHealthCheck()
sendEvent({ id: generateId(), type: 'engine:ready', payload: {} })
injectDayZeroWelcome('default')
