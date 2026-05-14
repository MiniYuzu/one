// src/engine/api/streamAdapter.ts
import type { StreamEvent, Usage, ContentBlock } from '../types/message.js'

export interface OpenAIStreamChunk {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: Array<{
    index?: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export function* adaptOpenAISSEToStreamEvents(chunk: OpenAIStreamChunk): Generator<StreamEvent> {
  const choice = chunk.choices?.[0]
  if (!choice) return

  const delta = choice.delta
  const index = choice.index ?? 0

  // Message start (first chunk with role)
  if (delta.role) {
    yield {
      type: 'message_start',
      message: { usage: undefined },
    }
  }

  // Text content
  if (delta.content !== undefined && delta.content !== null) {
    yield {
      type: 'content_block_start',
      index,
      content_block: { type: 'text', text: '' },
    }
    yield {
      type: 'content_block_delta',
      index,
      delta: { type: 'text_delta', text: delta.content },
    }
    yield {
      type: 'content_block_stop',
      index,
    }
  }

  // Tool calls (OpenAI format → content_block_start/delta/stop)
  if (delta.tool_calls && delta.tool_calls.length > 0) {
    for (const tc of delta.tool_calls) {
      if (tc.id) {
        yield {
          type: 'content_block_start',
          index: tc.index,
          content_block: {
            type: 'tool_use',
            id: tc.id,
            name: tc.function?.name || '',
            input: '',
          },
        }
      }
      if (tc.function?.arguments) {
        yield {
          type: 'content_block_delta',
          index: tc.index,
          delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
        }
      }
      if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
        yield {
          type: 'content_block_stop',
          index: tc.index,
        }
      }
    }
  }

  // Usage & stop_reason on final chunk
  if (chunk.usage || choice.finish_reason !== undefined) {
    const usage: Usage | undefined = chunk.usage
      ? {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        }
      : undefined
    yield {
      type: 'message_delta',
      usage,
      stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason,
    }
    yield { type: 'message_stop' }
  }
}
