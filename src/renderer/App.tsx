// src/renderer/App.tsx
import { useEffect, useState } from 'react'
import { MessageList } from './components/chat/MessageList.js'
import { UnifiedConsole } from './components/console/UnifiedConsole.js'
import { OfflineBanner } from './components/system/OfflineBanner.js'
import { DayZeroWelcome } from './components/system/DayZeroWelcome.js'
import { useEngine } from './hooks/useEngine.js'
import { useTheme } from './hooks/useTheme.js'
import type { EngineEvent } from '../../shared/ipc-types.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  error?: boolean
}

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [offline, setOffline] = useState(false)
  const [dayZero, setDayZero] = useState<{ content: string; pills: Array<{ label: string; prompt: string }> } | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const { theme, setTheme } = useTheme()

  const { send, isConnected } = useEngine((evt: EngineEvent) => {
    switch (evt.type) {
      case 'chat:chunk': {
        const p = evt.payload as { text: string; messageId: string }
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.id === p.messageId && last.streaming) {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: last.content + p.text }
            return updated
          }
          return [...prev, { id: p.messageId, role: 'assistant', content: p.text, streaming: true }]
        })
        break
      }
      case 'chat:end': {
        const p = evt.payload as { messageId: string }
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, streaming: false } : m)),
        )
        break
      }
      case 'chat:error': {
        const p = evt.payload as { code: string; message: string }
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'system', content: p.message, error: true },
        ])
        break
      }
      case 'offline:changed': {
        const p = evt.payload as { offline: boolean }
        setOffline(p.offline)
        break
      }
      case 'state:sync': {
        const p = evt.payload as { dayZero?: { content: string; pills: Array<{ label: string; prompt: string }> } }
        if (p.dayZero) setDayZero(p.dayZero)
        break
      }
      case 'engine:ready':
        setEngineReady(true)
        break
    }
  })

  useEffect(() => {
    if (engineReady && messages.length === 0 && !dayZero) {
      send({ id: `sync-${Date.now()}`, type: 'health:check', payload: {} })
    }
  }, [engineReady, messages.length, dayZero, send])

  const handleSend = (content: string) => {
    if (!content.trim()) return
    const id = `user-${Date.now()}`
    setMessages((prev) => [...prev, { id, role: 'user', content: content.trim() }])
    send({ id: `req-${Date.now()}`, type: 'chat:send', payload: { content: content.trim() } })
  }

  const handlePillClick = (prompt: string) => {
    handleSend(prompt)
    setDayZero(null)
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      {/* Left Rail Placeholder — Phase 2+ 导航 */}
      <div className="hidden w-16 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex" />

      {/* Middle Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner offline={offline} onRetry={() => send({ id: `hc-${Date.now()}`, type: 'health:check', payload: {} })} />

        <div className="absolute right-4 top-4 z-10">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="rounded-8 border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {dayZero && messages.length === 0 && (
              <DayZeroWelcome content={dayZero.content} pills={dayZero.pills} onPillClick={handlePillClick} />
            )}
            <MessageList messages={messages} />
          </div>
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <UnifiedConsole onSend={handleSend} disabled={offline} />
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
              AI 生成内容仅供参考，处理敏感数据前请核实
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs text-white shadow">
            AI 引擎连接中...
          </div>
        )}
      </div>

      {/* Right Artifacts Panel Placeholder — Phase 2+ 产物 */}
      <div className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 xl:block" />
    </div>
  )
}
