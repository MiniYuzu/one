// src/engine/tools/FileEditTool.ts
import { readFile, writeFile } from 'fs/promises'
import path from 'node:path'
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'

export const FileEditTool: Tool = {
  name: 'FileEdit',
  description: 'Edit a file by replacing an exact string with another.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative path from working directory' },
      old_string: { type: 'string', description: 'Exact string to replace' },
      new_string: { type: 'string', description: 'Replacement string' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  async execute(input, context): Promise<ToolResult> {
    const rawPath = String(input.path || '')
    const filePath = path.join(context.workingDirectory, rawPath)
    try {
      const content = await readFile(filePath, 'utf-8')
      const oldStr = String(input.old_string)
      const newStr = String(input.new_string)
      const occurrences = content.split(oldStr).length - 1
      if (occurrences === 0) {
        return { content: `Error: old_string not found in file`, is_error: true }
      }
      if (occurrences > 1) {
        return { content: `Error: old_string appears ${occurrences} times in file. Must be unique.`, is_error: true }
      }
      const updated = content.replace(oldStr, newStr)
      await writeFile(filePath, updated, 'utf-8')
      return { content: `File edited successfully: ${rawPath}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: `Error editing file: ${msg}`, is_error: true }
    }
  },
}
