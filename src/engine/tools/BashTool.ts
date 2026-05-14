// src/engine/tools/BashTool.ts
import { exec } from 'child_process'
import { promisify } from 'util'
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'

const execAsync = promisify(exec)

const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /curl.*\|.*sh/i,
  /wget.*\|.*sh/i,
]

export const BashTool: Tool = {
  name: 'Bash',
  description: 'Execute a bash command. Use only when no dedicated tool exists.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The bash command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (max 60000)' },
    },
    required: ['command'],
  },
  async execute(input, context): Promise<ToolResult> {
    const command = String(input.command || '')
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return { content: 'Dangerous command blocked by security policy.', is_error: true }
      }
    }
    try {
      const timeout = Math.min(Number(input.timeout) || 30000, 60000)
      // CRITICAL: use context.workingDirectory, NOT process.cwd()
      const { stdout, stderr } = await execAsync(command, { timeout, cwd: context.workingDirectory })
      return { content: stdout + (stderr ? `\nstderr:\n${stderr}` : '') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: msg, is_error: true }
    }
  },
}
