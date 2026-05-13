// src/engine/state/config-store.ts
import fs from 'node:fs'
import path from 'node:path'
import type { AppConfig } from '../../shared/ipc-types.js'
import { DEFAULT_CONFIG } from '../../shared/constants.js'

const configPath = process.env.ONE_CONFIG_PATH || path.join(process.cwd(), 'config.json')

function writeFileAtomic(filePath: string, data: string): void {
  const dir = path.dirname(filePath)
  const tmpName = `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  const tmpPath = path.join(dir, tmpName)
  try {
    fs.writeFileSync(tmpPath, data, 'utf-8')
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch {}
    throw err
  }
}

export function getConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function setConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig()
  const next = { ...current, ...partial }
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    writeFileAtomic(configPath, JSON.stringify(next, null, 2))
  } catch (err) {
    console.error('Failed to write config:', err)
  }
  return next
}
