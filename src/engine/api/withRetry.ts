export class CannotRetryError extends Error {
  constructor(public readonly originalError: Error) {
    super(originalError.message)
    this.name = 'CannotRetryError'
  }
}

export class FallbackTriggeredError extends Error {
  constructor(public readonly originalError: Error) {
    super('Streaming fallback triggered')
    this.name = 'FallbackTriggeredError'
  }
}

export interface RetryContext {
  model: string
  maxTokensOverride?: number
  fastMode?: boolean
  thinkingConfig?: { type: 'disabled' | 'enabled' | 'adaptive'; budgetTokens?: number }
}

export interface RetryConfig {
  model: string
  fallbackModel?: string
  thinkingConfig?: RetryContext['thinkingConfig']
  fastMode?: boolean
  signal: AbortSignal
  maxRetries?: number
  querySource?: string
  initialConsecutive529Errors?: number
}

const DEFAULT_MAX_RETRIES = 10
const BASE_DELAY_MS = 500
const MAX_529_RETRIES = 3

export function getRetryDelay(attempt: number): number {
  const jitter = Math.random() * 200 - 100
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 30000) + jitter
}

export function is529Error(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { status?: number; response?: { status?: number; headers?: Record<string, string> } }
  if (e.status === 529) return true
  if (e.response?.status === 529) return true
  const shouldRetry = e.response?.headers?.['x-should-retry']
  if (shouldRetry === 'true') return true
  return false
}

function shouldRetry(error: unknown, attempt: number, consecutive529s: number): boolean {
  if (attempt >= DEFAULT_MAX_RETRIES) return false
  if (is529Error(error)) return consecutive529s < MAX_529_RETRIES
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 429) return true
  if (status && status >= 500 && status !== 529) return true
  const code = (error as { code?: string })?.code
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'].includes(code || '')) return true
  return false
}

export async function* withRetry<T>(
  getClient: () => T,
  execute: (client: T, attempt: number, context: RetryContext) => Promise<unknown>,
  config: RetryConfig,
): AsyncGenerator<import('../types/message.js').SystemAPIErrorMessage, T> {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
  let attempt = 0
  let consecutive529Errors = config.initialConsecutive529Errors ?? 0
  let lastError: Error | undefined

  while (attempt <= maxRetries) {
    try {
      const client = getClient()
      const context: RetryContext = {
        model: config.model,
        fastMode: config.fastMode,
        thinkingConfig: config.thinkingConfig,
      }
      const result = await execute(client, attempt, context)
      return result as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (config.signal.aborted) throw lastError
      if (!shouldRetry(error, attempt, consecutive529Errors)) {
        throw new CannotRetryError(lastError)
      }
      if (is529Error(error)) consecutive529Errors++
      yield {
        type: 'system',
        subtype: 'api_error',
        content: `API request failed (attempt ${attempt + 1}): ${lastError.message}. Retrying...`,
        errorCode: 'RETRY',
      }
      const delay = getRetryDelay(attempt)
      await new Promise(r => setTimeout(r, delay))
      attempt++
    }
  }
  throw new CannotRetryError(lastError ?? new Error('Max retries exceeded'))
}
