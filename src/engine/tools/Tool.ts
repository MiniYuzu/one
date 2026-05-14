// src/engine/tools/Tool.ts
import type { Tool, ToolResult, ToolUseContext } from '../types/tool.js'
import { BashTool } from './BashTool.js'
import { FileReadTool } from './FileReadTool.js'
import { FileWriteTool } from './FileWriteTool.js'
import { FileEditTool } from './FileEditTool.js'
import { GlobTool } from './GlobTool.js'
import { GrepTool } from './GrepTool.js'

export const ALL_TOOLS: Tool[] = [
  BashTool,
  FileReadTool,
  FileWriteTool,
  FileEditTool,
  GlobTool,
  GrepTool,
]

export function findToolByName(tools: Tool[], name: string): Tool | undefined {
  return tools.find(t => t.name === name)
}

export function toolMatchesName(tool: Tool, name: string): boolean {
  return tool.name === name
}

export async function runTools(
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  tools: Tool[],
  context: ToolUseContext,
): Promise<Array<{ tool_use_id: string; content: ToolResult['content']; is_error?: boolean }>> {
  return Promise.all(
    toolUses.map(async tu => {
      const tool = findToolByName(tools, tu.name)
      if (!tool) {
        return {
          tool_use_id: tu.id,
          content: `Tool "${tu.name}" not found`,
          is_error: true,
        }
      }
      try {
        const result = await tool.execute(tu.input, context)
        return {
          tool_use_id: tu.id,
          content: result.content,
          is_error: result.is_error,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          tool_use_id: tu.id,
          content: `Error executing ${tu.name}: ${msg}`,
          is_error: true,
        }
      }
    }),
  )
}
