export interface QueryConfig {
  model: string
  baseUrl: string
  apiKey: string | null
  maxTurns?: number
  temperature?: number
  maxTokens?: number
  customSystemPrompt?: string
  appendSystemPrompt?: string
}

export function buildQueryConfig(config: QueryConfig): QueryConfig {
  return {
    maxTurns: 10,
    temperature: 1,
    ...config,
  }
}
