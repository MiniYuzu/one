// src/engine/api/openaiClient.ts
import axios from 'axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { StreamEvent, SystemAPIErrorMessage } from '../types/message.js'
import type { Tool } from '../types/tool.js'
import { adaptOpenAISSEToStreamEvents, createStreamAdapterState, type OpenAIStreamChunk } from './streamAdapter.js'

export interface CallModelOptions {
  model: string
  baseUrl: string
  apiKey: string | null
  temperature?: number
  maxTokens?: number
  tools?: Tool[]
  signal: AbortSignal
  fallbackModel?: string
  onStreamingFallback?: () => void
}

export async function* streamChatCompletion(
  messages: Array<{ role: string; content?: string | null | unknown[]; tool_calls?: unknown[]; tool_call_id?: string }>,
  systemPrompt: string | string[],
  options: CallModelOptions,
): AsyncGenerator<StreamEvent | SystemAPIErrorMessage, void> {
  const isAnthropicNative = options.baseUrl.includes('anthropic.com')
  const url = isAnthropicNative
    ? `${options.baseUrl.replace(/\/$/, '')}/v1/messages`
    : `${options.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const system = Array.isArray(systemPrompt) ? systemPrompt.join('\n\n') : systemPrompt

  const apiTools = options.tools?.map((t) =>
    isAnthropicNative
      ? {
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        }
      : {
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          },
        },
  )

  const body: Record<string, unknown> = {
    model: options.model,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    stream: true,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    ...(apiTools && apiTools.length > 0 && {
      tools: apiTools,
      tool_choice: 'auto' as const,
    }),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (options.apiKey) {
    headers[isAnthropicNative ? 'x-api-key' : 'Authorization'] = isAnthropicNative
      ? options.apiKey
      : `Bearer ${options.apiKey}`
    if (isAnthropicNative) headers['anthropic-version'] = '2023-06-01'
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
        timeout: 60000,
      })

      const eventQueue: StreamEvent[] = []
      const parserState = createStreamAdapterState()
      const parser = createParser({
        onEvent: (event: EventSourceMessage) => {
          if (event.data === '[DONE]') return
          try {
            const json = JSON.parse(event.data) as OpenAIStreamChunk
            for (const evt of adaptOpenAISSEToStreamEvents(json, parserState)) {
              eventQueue.push(evt)
            }
          } catch {
            // ignore malformed chunks
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
      // 网络层错误（无 response，如 ECONNRESET、ETIMEDOUT、TLS 握手失败）也应重试
      const isNetworkError = isAxiosErr && !error.response
      const isRetryable = status === 429 || (status !== undefined && status >= 500) || isNetworkError
      if (!isRetryable || attempt > maxRetries) {
        const errorData =
          isAxiosErr && error.response?.data instanceof Buffer
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
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
}
