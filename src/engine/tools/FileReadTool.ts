// src/engine/tools/FileReadTool.ts
import { readFile } from 'fs/promises'
import path from 'node:path'
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'

export const FileReadTool: Tool = {
  name: 'FileRead',
  description: 'Read the contents of a file.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from working directory' },
      limit: { type: 'number', description: 'Max characters to read' },
      offset: { type: 'number', description: 'Character offset to start from' },
    },
    required: ['path'],
  },
  async execute(input, context): Promise<ToolResult> {
    const rawPath = String(input.path || '')
    const filePath = path.join(context.workingDirectory, rawPath)
    try {
      const content = await readFile(filePath, 'utf-8')
      const limit = Number(input.limit) || content.length
      const offset = Number(input.offset) || 0
      const sliced = content.slice(offset, offset + limit)
      return { content: sliced }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: `Error reading file: ${msg}`, is_error: true }
    }
  },
}
