import type { StreamEvent, SystemAPIErrorMessage } from '../types/message.js'
import type { Tool } from '../types/tool.js'

export interface QueryDeps {
  callModel: (
    messages: Array<{ role: string; content?: string | null | unknown[]; tool_calls?: unknown[]; tool_call_id?: string }>,
    systemPrompt: string[],
    options: { model: string; baseUrl: string; apiKey: string | null; signal: AbortSignal; tools?: Tool[] },
  ) => AsyncGenerator<StreamEvent | SystemAPIErrorMessage, void>
  uuid: () => string
}
