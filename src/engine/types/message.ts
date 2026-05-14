// src/engine/types/message.ts
export type MessageRole = 'user' | 'assistant' | 'system'

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking'
  // text
  text?: string
  // tool_use
  id?: string
  name?: string
  input?: Record<string, unknown> | string
  // tool_result
  tool_use_id?: string
  is_error?: boolean
  // thinking
  thinking?: string
  signature?: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

export interface Message {
  uuid: string
  type: MessageRole
  timestamp: number
  content: string | ContentBlock[]
}

export interface AssistantMessage extends Message {
  type: 'assistant'
  stopReason?: string | null
  usage?: Usage
  requestId?: string
  apiError?: string
}

export interface UserMessage extends Message {
  type: 'user'
}

export interface SystemMessage extends Message {
  type: 'system'
  subtype?: string
  content: string
}

export type ContentBlockDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'signature_delta'; signature: string }
  | { type: 'input_json_delta'; partial_json: string }

export interface StreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop'
  message?: { usage?: Usage }
  index?: number
  content_block?: ContentBlock
  delta?: ContentBlockDelta
  usage?: Usage
  stop_reason?: string | null
}

export interface SystemAPIErrorMessage {
  type: 'system'
  subtype: 'api_error'
  content: string
  errorCode: string
}

export interface RequestStartEvent {
  type: 'stream_request_start'
}
