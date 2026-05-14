// src/renderer/components/chat/ToolCallCard.tsx
import { Wrench, Check, AlertCircle } from 'lucide-react'

interface ToolCallCardProps {
  name?: string
  input?: string
  content?: string
  isError?: boolean
  status?: 'running' | 'done'
}

export function ToolCallCard({ name, input, content, isError, status }: ToolCallCardProps) {
  let parsedInput: Record<string, unknown> | undefined
  try {
    parsedInput = input ? JSON.parse(input) : undefined
  } catch {
    parsedInput = undefined
  }

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
        {status === 'running' ? <Wrench size={14} className="text-amber-500" /> :
          isError ? <AlertCircle size={14} className="text-rose-500" /> :
            <Check size={14} className="text-emerald-500" />}
        <span>{name || 'Tool Result'}</span>
      </div>
      {parsedInput && Object.keys(parsedInput).length > 0 && (
        <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          {JSON.stringify(parsedInput, null, 2)}
        </pre>
      )}
      {content && (
        <div className={`mt-1 text-xs ${isError ? 'text-rose-600' : 'text-slate-600'} dark:text-slate-400`}>
          {content}
        </div>
      )}
    </div>
  )
}
