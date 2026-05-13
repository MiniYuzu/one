// src/renderer/components/chat/UserBubble.tsx
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface UserBubbleProps {
  content: string
}

export function UserBubble({ content }: UserBubbleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      window.mainAPI.copyText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[85%] sm:max-w-xl">
        <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>
        <button
          onClick={handleCopy}
          className="absolute -left-8 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 transition hover:bg-slate-100 group-hover:opacity-100 dark:hover:bg-slate-800"
          aria-label="复制"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-400" />}
        </button>
      </div>
    </div>
  )
}
