// src/renderer/components/system/DayZeroWelcome.tsx
import { Sparkles } from 'lucide-react'

interface DayZeroWelcomeProps {
  content: string
  pills: Array<{ label: string; prompt: string }>
  onPillClick: (prompt: string) => void
}

export function DayZeroWelcome({ content, pills, onPillClick }: DayZeroWelcomeProps) {
  return (
    <div className="animate-fade-up mx-auto max-w-2xl py-8">
      <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
        <Sparkles size={18} />
        <span className="text-sm font-medium">ONE AI Agent</span>
      </div>
      <p className="mt-3 text-base leading-relaxed text-slate-700 dark:text-slate-300">{content}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => onPillClick(pill.prompt)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}
