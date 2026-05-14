import { randomUUID } from 'crypto'
import type { Message, AssistantMessage, SystemAPIErrorMessage } from '../types/message.js'
import type { Tool } from '../types/tool.js'
import { buildSystemPrompt, resolveSystemPromptSections } from '../prompt/prompts.js'
import type { QueryConfig } from './queryConfig.js'
import type { QueryDeps } from './queryDeps.js'
import { query } from './query.js'

export interface QueryEngineOptions {
  config: QueryConfig
  tools: Tool[]
  deps: QueryDeps
  workingDirectory: string
}

export class QueryEngine {
  private config: QueryConfig
  private tools: Tool[]
  private deps: QueryDeps
  private messages: Message[] = []
  private abortController: AbortController
  private workingDirectory: string

  constructor(options: QueryEngineOptions) {
    this.config = options.config
    this.tools = options.tools
    this.deps = options.deps
    this.workingDirectory = options.workingDirectory
    this.abortController = new AbortController()
  }

  async *submitMessage(prompt: string): AsyncGenerator<AssistantMessage | SystemAPIErrorMessage, void> {
    const userMessage: Message = {
      uuid: randomUUID(),
      type: 'user',
      timestamp: Date.now(),
      content: [{ type: 'text', text: prompt }],
    }
    this.messages.push(userMessage)

    const sections = buildSystemPrompt({ enabledTools: new Set(this.tools.map(t => t.name)) })
    const resolved = await resolveSystemPromptSections(sections)
    const systemPrompt = resolved.filter((s): s is string => s !== null)

    for await (const message of query({
      messages: this.messages,
      systemPrompt,
      tools: this.tools,
      config: this.config,
      deps: this.deps,
      abortController: this.abortController,
      workingDirectory: this.workingDirectory,
    })) {
      if (message.type === 'assistant') {
        this.messages.push(message)
        yield message
      } else if (message.type === 'user') {
        this.messages.push(message)
      } else if (message.type === 'system') {
        // 重试提示等 transient 消息不入历史，直接透传
        yield message
      }
    }
  }

  cancel(): void {
    this.abortController.abort()
  }
}
