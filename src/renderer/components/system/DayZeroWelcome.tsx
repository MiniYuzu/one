// src/renderer/components/system/DayZeroWelcome.tsx
import { AIAvatar } from '../chat/AIAvatar.js'

interface DayZeroWelcomeProps {
  content: string
  pills: Array<{ label: string; prompt: string }>
  onPillClick: (prompt: string) => void
}

export function DayZeroWelcome({ content, pills, onPillClick }: DayZeroWelcomeProps) {
  return (
    <div className="animate-fade-up flex gap-3">
      <AIAvatar />
      <div className="max-w-2xl">
        <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 shadow-sm dark:bg-slate-800">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {content}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pills.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => onPillClick(pill.prompt)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
