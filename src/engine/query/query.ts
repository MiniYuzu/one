import type { Message, AssistantMessage, UserMessage, StreamEvent, SystemAPIErrorMessage, ContentBlock } from '../types/message.js'
import type { Tool } from '../types/tool.js'
import { runTools } from '../tools/Tool.js'
import type { QueryConfig } from './queryConfig.js'
import type { QueryDeps } from './queryDeps.js'

export interface QueryParams {
  messages: Message[]
  systemPrompt: string[]
  tools: Tool[]
  config: QueryConfig
  deps: QueryDeps
  abortController: AbortController
  workingDirectory: string
}

function toApiMessages(messages: Message[]): Array<{ role: 'user' | 'assistant'; content: unknown }> {
  return messages
    .filter((m): m is UserMessage | AssistantMessage => m.type === 'user' || m.type === 'assistant')
    .map((m) => {
      if (m.type === 'user') {
        const blocks = m.content.map((c) => {
          if (c.type === 'text') {
            return { type: 'text', text: c.text }
          }
          if (c.type === 'tool_result') {
            return {
              type: 'tool_result',
              tool_use_id: c.tool_use_id,
              content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
              is_error: c.is_error,
            }
          }
          return c
        })
        return { role: 'user', content: blocks }
      }

      // assistant
      const blocks = m.content.map((c) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text }
        }
        if (c.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: c.id,
            name: c.name,
            input: typeof c.input === 'string' ? JSON.parse(c.input || '{}') : c.input,
          }
        }
        return c
      })
      return { role: 'assistant', content: blocks }
    })
}

export async function* query(params: QueryParams): AsyncGenerator<AssistantMessage | UserMessage | SystemAPIErrorMessage, void> {
  const { messages, systemPrompt, tools, config, deps, abortController, workingDirectory } = params
  const maxTurns = config.maxTurns ?? 10

  for (let turn = 0; turn < maxTurns; turn++) {
    const apiMessages = toApiMessages(messages)
    const stream = deps.callModel(apiMessages, systemPrompt, {
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      signal: abortController.signal,
      tools,
    })

    const assistantMessage: AssistantMessage = {
      uuid: deps.uuid(),
      type: 'assistant',
      timestamp: Date.now(),
      content: [],
    }

    let currentTextBlock: ContentBlock & { type: 'text' } | null = null
    let currentToolUseBlocks: Map<number, ContentBlock & { type: 'tool_use' }> = new Map()
    let pendingToolUseJson: Map<number, string> = new Map()
    let stopReason: string | null = null
    let usage = undefined

    for await (const event of stream) {
      if (event.type === 'system') {
        if (event.errorCode === 'RETRY') {
          // 重试警告：透传给上层，不入历史，让 UI 展示进度
          yield event
          continue
        }
        // 致命错误（API_ERROR、鉴权失败、重试耗尽等）
        const errorMsg: AssistantMessage = {
          uuid: deps.uuid(),
          type: 'assistant',
          timestamp: Date.now(),
          content: [{ type: 'text', text: event.content }],
          apiError: event.errorCode,
        }
        yield errorMsg
        return
      }

      const se = event as StreamEvent
      switch (se.type) {
        case 'message_start':
          if (se.message.usage) usage = se.message.usage
          break
        case 'content_block_start': {
          if (se.content_block.type === 'text') {
            currentTextBlock = { type: 'text', text: se.content_block.text || '' }
          } else if (se.content_block.type === 'tool_use') {
            const block: ContentBlock & { type: 'tool_use' } = {
              type: 'tool_use',
              id: se.content_block.id,
              name: se.content_block.name,
              input: se.content_block.input || '',
            }
            currentToolUseBlocks.set(se.index, block)
            pendingToolUseJson.set(se.index, '')
          }
          break
        }
        case 'content_block_delta': {
          if (se.delta.type === 'text_delta' && currentTextBlock) {
            currentTextBlock.text += se.delta.text
          } else if (se.delta.type === 'input_json_delta') {
            const existing = pendingToolUseJson.get(se.index) || ''
            pendingToolUseJson.set(se.index, existing + se.delta.partial_json)
          }
          break
        }
        case 'content_block_stop': {
          if (currentTextBlock) {
            assistantMessage.content.push(currentTextBlock)
            currentTextBlock = null
          }
          const toolBlock = currentToolUseBlocks.get(se.index)
          if (toolBlock) {
            const jsonStr = pendingToolUseJson.get(se.index) || ''
            try {
              toolBlock.input = jsonStr ? JSON.parse(jsonStr) : {}
            } catch {
              toolBlock.input = jsonStr
            }
            assistantMessage.content.push(toolBlock)
            currentToolUseBlocks.delete(se.index)
            pendingToolUseJson.delete(se.index)
          }
          break
        }
        case 'message_delta':
          if (se.usage) usage = se.usage
          if (se.stop_reason !== undefined) stopReason = se.stop_reason
          break
        case 'message_stop':
          break
      }
    }

    assistantMessage.stopReason = stopReason
    assistantMessage.usage = usage
    yield assistantMessage

    const toolUses = assistantMessage.content
      .filter((c): c is ContentBlock & { type: 'tool_use' } => c.type === 'tool_use')
      .map(c => ({ id: c.id, name: c.name, input: typeof c.input === 'string' ? {} : (c.input as Record<string, unknown>) }))

    if (toolUses.length === 0) {
      return
    }

    const results = await runTools(toolUses, tools, {
      messages,
      abortController,
      workingDirectory,
    })

    const toolResultMessage: UserMessage = {
      uuid: deps.uuid(),
      type: 'user',
      timestamp: Date.now(),
      content: results.map(r => ({
        type: 'tool_result' as const,
        tool_use_id: r.tool_use_id,
        is_error: r.is_error,
        content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content),
      })),
    }

    yield toolResultMessage
    messages.push(assistantMessage)
    messages.push(toolResultMessage)
  }
}
