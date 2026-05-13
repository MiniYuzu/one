// src/renderer/components/chat/MessageList.tsx
import { AlertCircle, Loader2 } from 'lucide-react'
import { AIAvatar } from './AIAvatar.js'
import { UserBubble } from './UserBubble.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { ThinkingChain } from './ThinkingChain.js'
import { PlanCard } from './PlanCard.js'
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
            <div key={msg.id} className="animate-fade-up flex gap-3">
              <AIAvatar />
              <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span className="text-xs font-medium">出错了</span>
                </div>
                <p className="mt-1 text-sm">{msg.content}</p>
              </div>
            </div>
          )
        }

        return (
          <div key={msg.id} className="animate-fade-up flex gap-3">
            <AIAvatar />
            <div className="max-w-2xl">
              <ThinkingChain />
              <PlanCard />
              <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 shadow-sm dark:bg-slate-800">
                <MarkdownRenderer content={msg.content} />
                {msg.streaming && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>AI 正在思考...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
