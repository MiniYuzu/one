// src/engine/tools/ITool.ts

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
}

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
}

export interface ITool {
  readonly name: string
  readonly description: string
  readonly parameters: ToolParameter[]

  execute(params: Record<string, unknown>): Promise<ToolResult>
}

export class ToolRegistry {
  private tools = new Map<string, ITool>()

  register(tool: ITool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name)
  }

  list(): ITool[] {
    return Array.from(this.tools.values())
  }
}
