// src/engine/api/client.ts
import axios, { type AxiosResponse } from 'axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { AppConfig } from '../../shared/ipc-types.js'
import { withRetry, DEFAULT_RETRY_CONFIG } from '../adapters/retry-policy.js'

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
  const body = {
    model: config.model,
    messages,
    stream: true,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  let usage: { inputTokens: number; outputTokens: number } | undefined

  try {
    await withRetry(
      {
        execute: async (attempt) => {
          if (signal.aborted) {
            throw new Error('ABORTED')
          }
          if (attempt > 0) {
            callbacks.onRetry?.(
              attempt,
              Math.min(
                DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
                DEFAULT_RETRY_CONFIG.maxDelayMs,
              ),
            )
          }

          const response: AxiosResponse<ReadableStream> = await axios({
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
              const data = event.data
              if (data === '[DONE]') {
                return
              }
              try {
                const json = JSON.parse(data)
                const delta = json.choices?.[0]?.delta?.content
                if (typeof delta === 'string') {
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

          const reader = response.data.getReader()
          const decoder = new TextDecoder()

          while (true) {
            if (signal.aborted) {
              reader.cancel()
              break
            }
            const { done, value } = await reader.read()
            if (done) break
            parser.feed(decoder.decode(value, { stream: true }))
          }

          parser.feed(decoder.decode())
        },
      },
      DEFAULT_RETRY_CONFIG,
    )

    callbacks.onDone(usage)
  } catch (error) {
    if (axios.isCancel(error) || signal.aborted) {
      callbacks.onDone(usage)
      return
    }
    const msg = error instanceof Error ? error.message : String(error)
    callbacks.onError('STREAM_ERROR', msg)
  }
}
