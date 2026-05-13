// src/renderer/components/console/UnifiedConsole.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, AtSign, ChevronDown, Sparkles, Lightbulb, Hammer } from 'lucide-react'

type Mode = 'ask' | 'plan' | 'craft'

const MODES: { id: Mode; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'ask', label: 'Ask', icon: Sparkles, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', desc: '只读对话' },
  { id: 'plan', label: 'Plan', icon: Lightbulb, color: 'text-amber-600 bg-amber-50 border-amber-200', desc: '需审批' },
  { id: 'craft', label: 'Craft', icon: Hammer, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', desc: '自动执行' },
]

const MODELS = [
  { id: 'MiniMax-M2.5', label: 'M2.5' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
]

interface UnifiedConsoleProps {
  onSend: (content: string, model?: string) => void
  disabled?: boolean
}

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [ref, onOutside])
}

export function UnifiedConsole({ onSend, disabled }: UnifiedConsoleProps) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('ask')
  const [model, setModel] = useState('MiniMax-M2.5')
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  const activeMode = MODES.find((m) => m.id === mode)!

  useClickOutside(modeRef, () => setShowModeDropdown(false))
  useClickOutside(modelRef, () => setShowModelDropdown(false))

  const handleSubmit = useCallback(() => {
    if (disabled || !text.trim()) return
    onSend(text.trim(), model)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, onSend, model])

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
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-500/20">
        {/* Top: context pills */}
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Paperclip size={10} />
            销售数据_Q1.xlsx
          </span>
        </div>

        {/* Middle: textarea only */}
        <div className="px-3 pb-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={disabled}
            placeholder={disabled ? '网络不可用，请检查网络后重试' : '描述需求，使用 @ 引用文件或对话...'}
            className="max-h-[200px] w-full resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400 disabled:opacity-50"
          />
        </div>

        {/* Bottom toolbar: mode + model + actions + send */}
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {/* Mode switch */}
            <div className="relative" ref={modeRef}>
              <button
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition ${activeMode.color}`}
              >
                <activeMode.icon size={12} />
                {activeMode.label}
                <span className="text-[10px] opacity-60">· {activeMode.desc}</span>
                <ChevronDown size={10} className={`transition ${showModeDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showModeDropdown && (
                <div className="absolute bottom-full left-0 z-20 mb-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); setShowModeDropdown(false) }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                        mode === m.id
                          ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      <m.icon size={14} />
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-[10px] text-slate-400">{m.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model switch */}
            <div className="relative" ref={modelRef}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                {MODELS.find((m) => m.id === model)?.label}
                <ChevronDown size={10} className={`transition ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showModelDropdown && (
                <div className="absolute bottom-full left-0 z-20 mb-1 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setShowModelDropdown(false) }}
                      className={`flex w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                        model === m.id
                          ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* @引入 button */}
            <button
              disabled
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 opacity-50 transition hover:bg-slate-50 dark:hover:bg-slate-700"
              title="@引入（Phase 1 启用）"
            >
              <AtSign size={12} />
              <span>引入</span>
            </button>

            {/* Paperclip button */}
            <button
              disabled
              className="rounded-md p-1 text-slate-400 opacity-50 transition hover:bg-slate-50 dark:hover:bg-slate-700"
              title="附件（Phase 1 启用）"
            >
              <Paperclip size={16} />
            </button>
          </div>

          {/* Send button — aligned with bottom toolbar */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
            aria-label="发送"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
