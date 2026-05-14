// src/engine/tools/FileWriteTool.ts
import { writeFile, mkdir } from 'fs/promises'
import path from 'node:path'
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'

export const FileWriteTool: Tool = {
  name: 'FileWrite',
  description: 'Write content to a file. Creates the file and any necessary directories.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from working directory' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  async execute(input, context): Promise<ToolResult> {
    const rawPath = String(input.path || '')
    const filePath = path.join(context.workingDirectory, rawPath)
    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, String(input.content || ''), 'utf-8')
      return { content: `File written successfully: ${rawPath}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: `Error writing file: ${msg}`, is_error: true }
    }
  },
}
