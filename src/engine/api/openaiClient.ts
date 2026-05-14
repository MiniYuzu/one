// src/engine/api/openaiClient.ts
import axios from 'axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { Readable } from 'node:stream'
import type { StreamEvent, SystemAPIErrorMessage, Usage } from '../types/message.js'
import type { Tool } from '../types/tool.js'
import { withRetry, CannotRetryError, type RetryConfig } from './withRetry.js'
import { adaptOpenAISSEToStreamEvents, type OpenAIStreamChunk } from './streamAdapter.js'

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

function releaseStreamResources(
  stream?: ReadableStreamDefaultReader<Uint8Array>,
): void {
  stream?.cancel().catch(() => {})
}

export async function* streamChatCompletion(
  messages: Array<{ role: string; content?: string | null | unknown[]; tool_calls?: unknown[]; tool_call_id?: string }>,
  systemPrompt: string | string[],
  options: CallModelOptions,
): AsyncGenerator<StreamEvent | SystemAPIErrorMessage, void> {
  const url = `${options.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const system = Array.isArray(systemPrompt) ? systemPrompt.join('\n\n') : systemPrompt

  // OpenAI-compatible vs Anthropic-native schema switch
  const isAnthropic = options.baseUrl.includes('anthropic.com')
  const apiTools = options.tools?.map(t =>
    isAnthropic
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

  const body = {
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
    headers['Authorization'] = `Bearer ${options.apiKey}`
  }

  // Streaming idle timeout watchdog
  const STREAM_IDLE_TIMEOUT_MS = 90000
  const STREAM_IDLE_WARNING_MS = STREAM_IDLE_TIMEOUT_MS / 2
  let streamIdleAborted = false
  let streamIdleTimer: ReturnType<typeof setTimeout> | null = null
  let streamIdleWarningTimer: ReturnType<typeof setTimeout> | null = null

  function clearStreamIdleTimers(): void {
    if (streamIdleWarningTimer) { clearTimeout(streamIdleWarningTimer); streamIdleWarningTimer = null }
    if (streamIdleTimer) { clearTimeout(streamIdleTimer); streamIdleTimer = null }
  }
  function resetStreamIdleTimer(): void {
    clearStreamIdleTimers()
    streamIdleWarningTimer = setTimeout(() => {
      console.warn(`Streaming idle warning: no chunks received for ${STREAM_IDLE_WARNING_MS / 1000}s`)
    }, STREAM_IDLE_WARNING_MS)
    streamIdleTimer = setTimeout(() => {
      streamIdleAborted = true
      console.error(`Streaming idle timeout: aborting stream after ${STREAM_IDLE_TIMEOUT_MS / 1000}s`)
    }, STREAM_IDLE_TIMEOUT_MS)
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  try {
    const retryConfig: RetryConfig = {
      model: options.model,
      fallbackModel: options.fallbackModel,
      signal: options.signal,
      querySource: 'repl_main_thread',
    }

    const retryGenerator = withRetry(
      () => ({ client: 'axios' }),
      async (_client, attempt, _context) => {
        if (options.signal.aborted) throw new Error('ABORTED')

        const axiosResponse = await axios({
          method: 'post',
          url,
          data: body,
          headers,
          responseType: 'stream',
          signal: options.signal,
          timeout: 60000,
        })

        const webStream = Readable.toWeb(axiosResponse.data) as unknown as ReadableStream<Uint8Array>
        return webStream.getReader()
      },
      retryConfig,
    )

    let re = await retryGenerator.next()
    while (!re.done) {
      yield re.value
      re = await retryGenerator.next()
    }
    reader = re.value
    if (!reader) throw new Error('Failed to get stream reader')

    // Phase 2: consume stream directly and yield events
    const eventBuffer: StreamEvent[] = []
    let streamDone = false
    let streamError: Error | null = null

    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (event.data === '[DONE]') return
        try {
          const json = JSON.parse(event.data) as OpenAIStreamChunk
          for (const evt of adaptOpenAISSEToStreamEvents(json)) {
            eventBuffer.push(evt)
          }
        } catch {
          console.warn('Malformed SSE chunk:', event.data)
        }
      },
    })

    // Pump stream in background
    const pumpPromise = (async () => {
      try {
        const decoder = new TextDecoder()
        resetStreamIdleTimer()
        while (true) {
          if (streamIdleAborted || options.signal.aborted) {
            reader!.cancel().catch(() => {})
            break
          }
          const { done, value } = await reader!.read()
          if (done) break
          parser.feed(decoder.decode(value, { stream: true }))
        }
        parser.feed(decoder.decode())
      } catch (err) {
        streamError = err instanceof Error ? err : new Error(String(err))
      } finally {
        streamDone = true
        clearStreamIdleTimers()
      }
    })()

    // Yield events as they arrive
    while (!streamDone || eventBuffer.length > 0) {
      if (eventBuffer.length > 0) {
        yield eventBuffer.shift()!
        resetStreamIdleTimer()
      } else {
        await new Promise(r => setTimeout(r, 5))
      }
    }

    await pumpPromise
    if (streamError) throw streamError
  } finally {
    clearStreamIdleTimers()
    releaseStreamResources(reader)
  }
}
