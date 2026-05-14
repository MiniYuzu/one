// src/engine/types/message.ts
export type MessageRole = 'user' | 'assistant' | 'system'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> | string }
  | { type: 'tool_result'; tool_use_id: string; is_error?: boolean; content: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: unknown }> }
  | { type: 'thinking'; thinking: string; signature?: string }

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

export interface BaseMessage {
  uuid: string
  timestamp: number
}

export interface UserMessage extends BaseMessage {
  type: 'user'
  content: ContentBlock[]
}

export interface AssistantMessage extends BaseMessage {
  type: 'assistant'
  content: ContentBlock[]
  stopReason?: string | null
  usage?: Usage
  requestId?: string
  apiError?: string
}

export interface SystemMessage extends BaseMessage {
  type: 'system'
  subtype?: 'api_error'
  content: string
}

export type Message = UserMessage | AssistantMessage | SystemMessage

export type ContentBlockDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'signature_delta'; signature: string }
  | { type: 'input_json_delta'; partial_json: string }

export type StreamEvent =
  | { type: 'message_start'; message: { usage?: Usage } }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentBlockDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; usage?: Usage; stop_reason?: string | null }
  | { type: 'message_stop' }

export interface SystemAPIErrorMessage {
  type: 'system'
  subtype: 'api_error'
  content: string
  errorCode: string
}

export interface RequestStartEvent {
  type: 'stream_request_start'
}
