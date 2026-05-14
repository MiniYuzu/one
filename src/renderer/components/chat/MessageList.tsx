// src/renderer/components/chat/MessageList.tsx
import { useState } from 'react'
import { AlertCircle, Loader2, Copy, Check, BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react'
import { AIAvatar } from './AIAvatar.js'
import { UserBubble } from './UserBubble.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'
import { ThinkingChain } from './ThinkingChain.js'
import { PlanCard } from './PlanCard.js'
import { ToolCallCard } from './ToolCallCard.js'
import type { ChatMessage } from '../../App.js'

interface MessageListProps {
  messages: ChatMessage[]
  isWaiting?: boolean
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    try {
      window.mainAPI.copyText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
      aria-label="复制"
      title="复制"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  )
}

function ThinkableMessage({ content }: { content: string }) {
  const [isThinkOpen, setIsThinkOpen] = useState(false)

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
  const thinkContent = thinkMatch ? thinkMatch[1].trim() : null

  const isThinkingNow = content.includes('<think>') && !content.includes('</think>')
  const partialThinkContent = isThinkingNow ? content.replace('<think>', '').trim() : null

  const mainContent = isThinkingNow
    ? ''
    : content.replace(/<think>[\s\S]*?<\/think>/, '').trim()

  return (
    <div className="flex flex-col gap-2">
      {(thinkContent || isThinkingNow) && (
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/50">
          <button
            onClick={() => setIsThinkOpen(!isThinkOpen)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <div className="flex items-center gap-2">
              <BrainCircuit size={14} />
              <span>{isThinkingNow ? 'AI 正在深度思考...' : '查看深度思考过程'}</span>
            </div>
            {isThinkOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {isThinkOpen && (
            <div className="border-t border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              <div className="whitespace-pre-wrap">{thinkContent || partialThinkContent}</div>
            </div>
          )}
        </div>
      )}
      {mainContent && <MarkdownRenderer content={mainContent} />}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="animate-fade-up flex gap-3">
      <AIAvatar />
      <div className="flex items-center rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/60 [animation-delay:-0.3s]"></span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/60 [animation-delay:-0.15s]"></span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400/60"></span>
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, isWaiting }: MessageListProps) {
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
            <div className="max-w-2xl w-full min-w-0">
              <ThinkingChain />
              <PlanCard />
              <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 shadow-sm dark:bg-slate-800">
                <ThinkableMessage content={msg.content} />
                {msg.blocks?.map((block, idx) => {
                  if (block.type === 'tool_use') {
                    return <ToolCallCard key={idx} name={block.name} input={block.input} status="running" />
                  }
                  if (block.type === 'tool_result') {
                    return <ToolCallCard key={idx} content={block.content} isError={block.is_error} status="done" />
                  }
                  return null
                })}
                {msg.streaming && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>AI 正在思考...</span>
                  </div>
                )}
                {!msg.streaming && (
                  <div className="mt-2 flex justify-end">
                    <CopyButton content={msg.content} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {isWaiting && <TypingIndicator />}
    </div>
  )
}
