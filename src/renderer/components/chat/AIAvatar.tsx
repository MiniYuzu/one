// src/renderer/components/chat/AIAvatar.tsx
import { Bot } from 'lucide-react'

export function AIAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-gradient-to-br from-indigo-100 to-white text-indigo-600 dark:border-indigo-500/30 dark:from-indigo-900/40 dark:to-slate-900 dark:text-indigo-300">
      <Bot size={20} />
    </div>
  )
}
