// src/renderer/components/chat/MessageList.tsx
import { AIAvatar } from './AIAvatar.js'
import { UserBubble } from './UserBubble.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import type { ChatMessage } from '../../App.js'

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="animate-fade-up">
              <UserBubble content={msg.content} />
            </div>
          )
        }

        if (msg.role === 'system' && msg.error) {
          return (
            <div key={msg.id} className="animate-fade-up flex justify-center">
              <div className="rounded-8 bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                {msg.content}
              </div>
            </div>
          )
        }

        return (
          <div key={msg.id} className="animate-fade-up flex gap-3">
            <AIAvatar />
            <div className="max-w-[80%] rounded-16 bg-slate-100 px-4 py-3 dark:bg-slate-800">
              <MarkdownRenderer content={msg.content} />
              {msg.streaming && (
                <span className="mt-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
