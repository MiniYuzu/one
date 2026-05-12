// src/engine/api/models.ts
import type { AppConfig } from '../../shared/ipc-types.js'

export const AVAILABLE_MODELS = [
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
]

export function getDefaultModel(): string {
  return AVAILABLE_MODELS[0].id
}

export function validateModel(model: string): string {
  return AVAILABLE_MODELS.some((m) => m.id === model) ? model : getDefaultModel()
}
