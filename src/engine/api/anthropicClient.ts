import axios from 'axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { StreamEvent, SystemAPIErrorMessage } from '../types/message.js'
import type { Tool } from '../types/tool.js'
import { getRetryDelay, is529Error } from './withRetry.js'

export type AnthropicSSEChunk =
  | {
      type: 'message_start'
      message: {
        id: string
        type: 'message'
        role: 'assistant'
        content: []
        model: string
        stop_reason?: string | null
        stop_sequence?: string | null
        usage?: { input_tokens: number; output_tokens: number }
      }
    }
  | {
      type: 'content_block_start'
      index: number
      content_block:
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        | { type: 'thinking'; thinking: string; signature?: string }
    }
  | {
      type: 'content_block_delta'
      index: number
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'input_json_delta'; partial_json: string }
        | { type: 'thinking_delta'; thinking: string }
        | { type: 'signature_delta'; signature: string }
    }
  | { type: 'content_block_stop'; index: number }
  | {
      type: 'message_delta'
      delta: { stop_reason?: string | null; stop_sequence?: string | null }
      usage?: { input_tokens: number; output_tokens: number }
    }
  | { type: 'message_stop' }
  | { type: 'ping' }

export interface CallModelOptions {
  model: string
  baseUrl: string
  apiKey: string | null
  maxTokens?: number
  temperature?: number
  tools?: Tool[]
  signal: AbortSignal
  fallbackModel?: string
  onStreamingFallback?: () => void
}

function* adaptAnthropicSSEToStreamEvents(chunk: AnthropicSSEChunk): Generator<StreamEvent> {
  switch (chunk.type) {
    case 'message_start': {
      yield {
        type: 'message_start',
        message: {
          usage: chunk.message?.usage
            ? { inputTokens: chunk.message.usage.input_tokens, outputTokens: chunk.message.usage.output_tokens }
            : undefined,
        },
      }
      break
    }
    case 'content_block_start': {
      if (chunk.content_block) {
        const block = chunk.content_block
        // 【关键修复】：防御 Anthropic 原生的 input: {} 导致字符串拼接出现 [object Object]
        if (block.type === 'tool_use') {
          yield {
            type: 'content_block_start',
            index: chunk.index ?? 0,
            content_block: { ...block, input: '' } as any,
          }
        } else {
          yield {
            type: 'content_block_start',
            index: chunk.index ?? 0,
            content_block: block as any,
          }
        }
      }
      break
    }
    case 'content_block_delta': {
      if (chunk.delta) {
        yield {
          type: 'content_block_delta',
          index: chunk.index ?? 0,
          delta: chunk.delta as any,
        }
      }
      break
    }
    case 'content_block_stop': {
      yield { type: 'content_block_stop', index: chunk.index ?? 0 }
      break
    }
    case 'message_delta': {
      yield {
        type: 'message_delta',
        usage: chunk.usage
          ? { inputTokens: chunk.usage.input_tokens ?? 0, outputTokens: chunk.usage.output_tokens ?? 0 }
          : undefined,
        stop_reason: chunk.delta?.stop_reason ?? null,
      }
      break
    }
    case 'message_stop': {
      yield { type: 'message_stop' }
      break
    }
    case 'ping': {
      break
    }
  }
}

export async function* streamAnthropicMessages(
  messages: Array<{ role: string; content: unknown }>,
  systemPrompt: string | string[],
  options: CallModelOptions,
): AsyncGenerator<StreamEvent | SystemAPIErrorMessage, void> {
  const url = `${options.baseUrl.replace(/\/$/, '')}/v1/messages`
  const system = Array.isArray(systemPrompt) ? systemPrompt.join('\n\n') : systemPrompt

  const body: Record<string, unknown> = {
    model: options.model,
    messages,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
    ...(system && { system }),
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.tools && options.tools.length > 0 && {
      tools: options.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
      tool_choice: { type: 'auto' },
    }),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'Anthropic-Version': '2023-06-01',
  }
  if (options.apiKey) {
    headers['x-api-key'] = options.apiKey
  }

  let attempt = 0
  const maxRetries = 3

  while (attempt <= maxRetries) {
    try {
      if (options.signal.aborted) throw new Error('ABORTED')

      const response = await axios({
        method: 'post',
        url,
        data: body,
        headers,
        responseType: 'stream',
        signal: options.signal,
        timeout: 120000,
      })

      const eventQueue: StreamEvent[] = []
      const parser = createParser({
        onEvent: (event: EventSourceMessage) => {
          if (event.data === '[DONE]') return
          try {
            const json = JSON.parse(event.data) as AnthropicSSEChunk
            for (const evt of adaptAnthropicSSEToStreamEvents(json)) {
              eventQueue.push(evt)
            }
          } catch {
            // ignore malformed JSON in stream
          }
        },
      })

      const decoder = new TextDecoder()
      for await (const chunk of response.data) {
        if (options.signal.aborted) break
        const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
        parser.feed(text)
        while (eventQueue.length > 0) {
          yield eventQueue.shift()!
        }
      }
      const flush = decoder.decode()
      if (flush) parser.feed(flush)
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!
      }
      return
    } catch (error) {
      if (axios.isCancel(error) || options.signal.aborted) return
      attempt++
      const isAxiosErr = axios.isAxiosError(error)
      const status = isAxiosErr ? error.response?.status : undefined
      const isNetworkError = isAxiosErr && !error.response
      const isRetryable = status === 429 || (status !== undefined && status >= 500) || isNetworkError || is529Error(error)

      if (!isRetryable || attempt > maxRetries) {
        const errorData = isAxiosErr && error.response?.data instanceof Buffer
          ? error.response.data.toString()
          : (error as Error).message
        yield {
          type: 'system',
          subtype: 'api_error',
          content: `请求被拒绝 (HTTP ${status ?? '网络'}): ${errorData}`,
          errorCode: 'API_ERROR',
        }
        return
      }

      yield {
        type: 'system',
        subtype: 'api_error',
        content: `网络繁忙，正在重试 (${attempt}/${maxRetries})...`,
        errorCode: 'RETRY',
      }
      await new Promise(r => setTimeout(r, getRetryDelay(attempt)))
    }
  }
}
