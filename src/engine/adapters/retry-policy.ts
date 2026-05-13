// src/engine/adapters/retry-policy.ts

export interface RetryableOperation<T> {
  execute: (attempt: number) => Promise<T>
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

export interface RetryPolicyConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryableStatuses: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryPolicyConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

function isRetryableError(error: unknown, config: RetryPolicyConfig): boolean {
  if (error && typeof error === 'object') {
    const status = (error as { status?: number }).status
    if (typeof status === 'number' && config.retryableStatuses.includes(status)) {
      return true
    }
    const code = (error as { code?: string }).code
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return true
    }
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  operation: RetryableOperation<T>,
  config: RetryPolicyConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation.execute(attempt)
    } catch (error) {
      lastError = error
      if (attempt === config.maxRetries) break
      if (!isRetryableError(error, config)) throw error

      const delayMs = Math.min(
        config.baseDelayMs * Math.pow(2, attempt),
        config.maxDelayMs,
      )
      operation.onRetry?.(attempt + 1, delayMs, error)
      await sleep(delayMs)
    }
  }

  throw lastError
}
