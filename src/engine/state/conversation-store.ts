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
