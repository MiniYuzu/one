// src/renderer/components/chat/AIAvatar.tsx
import { Bot } from 'lucide-react'

export function AIAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
      <Bot size={18} />
    </div>
  )
}
