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
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}
