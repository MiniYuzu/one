// src/renderer/components/console/UnifiedConsole.tsx
import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'

interface UnifiedConsoleProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function UnifiedConsole({ onSend, disabled }: UnifiedConsoleProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    if (disabled || !text.trim()) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-20 border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder={disabled ? '网络不可用，请检查网络后重试' : '输入消息，按 Enter 发送...'}
        className="max-h-[200px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:opacity-40"
        aria-label="发送"
      >
        <Send size={16} />
      </button>
    </div>
  )
}
