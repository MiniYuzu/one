import type { AssistantMessage } from '../types/message.js'

export const API_ERROR_MESSAGE_PREFIX = 'API Error'
export const PROMPT_TOO_LONG_ERROR_MESSAGE = 'Prompt is too long'
export const CUSTOM_OFF_SWITCH_MESSAGE = 'Service temporarily unavailable'

export type ClassifiedError =
  | 'aborted'
  | 'api_timeout'
  | 'repeated_529'
  | 'rate_limit'
  | 'server_overload'
  | 'prompt_too_long'
  | 'auth_error'
  | 'context_overflow'
  | 'tool_use_mismatch'
  | 'client_error'
  | 'server_error'
  | 'network_error'
  | 'unknown'

export function classifyAPIError(error: unknown): ClassifiedError {
  if (!(error instanceof Error)) return 'unknown'
  if (error.name === 'AbortError' || error.message.includes('aborted')) return 'aborted'
  if (error.message.includes('timeout') || (error as { code?: string }).code === 'ETIMEDOUT') return 'api_timeout'
  const axiosError = error as {
    response?: { status?: number; headers?: Record<string, string>; data?: unknown }
    code?: string
  }
  const status = axiosError.response?.status
  if (status === 529) return 'server_overload'
  if (status === 429) return 'rate_limit'
  if (status === 401 || status === 403) return 'auth_error'
  if (status === 413) return 'prompt_too_long'
  if (status === 422) {
    const data = JSON.stringify(axiosError.response?.data || '')
    if (data.includes('tool_use') || data.includes('tool result')) return 'tool_use_mismatch'
    if (data.includes('context') || data.includes('too long')) return 'context_overflow'
    return 'client_error'
  }
  if (status && status >= 500) return 'server_error'
  if (status && status >= 400) return 'client_error'
  if (['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'].includes(axiosError.code || '')) return 'network_error'
  return 'unknown'
}

export function getAssistantMessageFromError(
  error: unknown,
  model?: string,
): AssistantMessage {
  const code = classifyAPIError(error)
  const err = error instanceof Error ? error : new Error(String(error))
  let content = `${API_ERROR_MESSAGE_PREFIX}: ${err.message}`

  switch (code) {
    case 'rate_limit':
      content = '请求过于频繁，请稍后再试。'
      break
    case 'auth_error':
      content = 'API 鉴权失败，请检查 API Key 配置。'
      break
    case 'server_overload':
      content = '服务器过载，正在自动重试...'
      break
    case 'prompt_too_long':
    case 'context_overflow':
      content = PROMPT_TOO_LONG_ERROR_MESSAGE
      break
    case 'api_timeout':
      content = '请求超时，请检查网络连接后重试。'
      break
    case 'network_error':
      content = '网络连接失败，请检查网络配置。'
      break
    case 'aborted':
      content = '请求已取消。'
      break
  }

  return {
    uuid: crypto.randomUUID(),
    type: 'assistant',
    timestamp: Date.now(),
    content: [{
      type: 'text',
      text: content,
    }],
    apiError: code,
  }
}

export function isPromptTooLongMessage(message: string): boolean {
  return message.toLowerCase().includes('prompt is too long') ||
    message.toLowerCase().includes('too many tokens') ||
    message.toLowerCase().includes('context length')
}

export function parsePromptTooLongTokenCounts(rawMessage: string): { promptTokens: number; maxTokens: number } | null {
  const match = rawMessage.match(/prompt is too long[^0-9]*(\d+)\s*tokens?\s*>\s*(\d+)/i)
  if (!match) return null
  return { promptTokens: parseInt(match[1]!, 10), maxTokens: parseInt(match[2]!, 10) }
}

export function getErrorMessageIfRefusal(stopReason: string | null, _model?: string): string | null {
  if (stopReason === 'max_tokens') return '回复被截断（达到最大输出长度）。'
  return null
}
