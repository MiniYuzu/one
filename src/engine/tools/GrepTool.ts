// src/engine/tools/GrepTool.ts
import { readFile } from 'fs/promises'
import path from 'node:path'
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'

export const GrepTool: Tool = {
  name: 'Grep',
  description: 'Search file contents with a regex pattern.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'Relative path to file or directory' },
    },
    required: ['pattern', 'path'],
  },
  async execute(input, context): Promise<ToolResult> {
    const rawPath = String(input.path || '')
    const pattern = String(input.pattern || '')
    const searchPath = path.join(context.workingDirectory, rawPath)
    try {
      const content = await readFile(searchPath, 'utf-8')
      const regex = new RegExp(pattern, 'g')
      const matches: string[] = []
      let match
      while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 40)
        const end = Math.min(content.length, match.index + match[0].length + 40)
        matches.push(content.slice(start, end).replace(/\n/g, ' '))
      }
      return { content: matches.join('\n') || 'No matches found.' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: `Error searching content: ${msg}`, is_error: true }
    }
  },
}
