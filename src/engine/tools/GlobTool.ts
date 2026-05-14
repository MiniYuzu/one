// src/engine/tools/GlobTool.ts
import { readdir } from 'fs/promises'
import path from 'node:path'
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'

async function globRecursive(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(dir, fullPath)
    if (entry.isDirectory()) {
      if (pattern.includes('**')) {
        const subResults = await globRecursive(fullPath, pattern)
        results.push(...subResults)
      }
    } else {
      // Simple glob: support * (any chars in filename) and ** (recursive)
      const regex = pattern
        .replace(/\*\*/g, '«RECURSIVE»')
        .replace(/\*/g, '[^/\\]*')
        .replace(/«RECURSIVE»/g, '.*')
      if (new RegExp(regex).test(relPath)) {
        results.push(relPath)
      }
    }
  }
  return results
}

export const GlobTool: Tool = {
  name: 'Glob',
  description: 'Search for files matching a pattern.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, e.g. "*.ts" or "src/**/*.tsx"' },
    },
    required: ['pattern'],
  },
  async execute(input, context): Promise<ToolResult> {
    const pattern = String(input.pattern || '')
    try {
      const matches = await globRecursive(context.workingDirectory, pattern)
      return { content: matches.join('\n') || 'No files found.' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: `Error searching files: ${msg}`, is_error: true }
    }
  },
}
