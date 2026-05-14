// src/engine/types/tool.ts
import type { Message } from './message.js'

export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute: (input: Record<string, unknown>, context: ToolUseContext) => Promise<ToolResult>
  backfillObservableInput?: (input: Record<string, unknown>) => void
}

export interface ToolResult {
  content: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: unknown }>
  is_error?: boolean
}

export interface ToolUseContext {
  messages: Message[]
  abortController: AbortController
  /** Absolute path. NEVER use process.cwd() in Electron — it points to the app bundle, not the user's workspace. */
  workingDirectory: string
}
