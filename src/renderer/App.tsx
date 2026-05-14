// src/renderer/App.tsx
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { MessageList } from './components/chat/MessageList.js'
import { UnifiedConsole } from './components/console/UnifiedConsole.js'
import { OfflineBanner } from './components/system/OfflineBanner.js'
import { DayZeroWelcome } from './components/system/DayZeroWelcome.js'
import { FileDropOverlay } from './components/system/FileDropOverlay.js'
import { SidebarLeft } from './components/sidebar/SidebarLeft.js'
import { SidebarRight } from './components/sidebar/SidebarRight.js'
import { ChatHeader } from './components/layout/ChatHeader.js'
import { useEngine } from './hooks/useEngine.js'
import { useTheme } from './hooks/useTheme.js'
import { useResponsiveLayout } from './hooks/useResponsiveLayout.js'
import type { EngineEvent } from '../../shared/ipc-types.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  streaming?: boolean
  error?: boolean
  blocks?: Array<
    | { type: 'tool_use'; name: string; input: string }
    | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  >
}

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const [offline, setOffline] = useState(false)
  const [dayZero, setDayZero] = useState<{ content: string; pills: Array<{ label: string; prompt: string }> } | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const [isRightOpenManual, setIsRightOpenManual] = useState(true)
  const [isLeftOpenManual, setIsLeftOpenManual] = useState<boolean | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isLeftOpen: isLeftOpenResponsive, isRightOpen } = useResponsiveLayout()

  const effectiveLeftOpen = isLeftOpenManual !== null ? isLeftOpenManual : isLeftOpenResponsive
  const effectiveRightOpen = isRightOpen && isRightOpenManual

  const { send, isConnected } = useEngine((evt: EngineEvent) => {
    switch (evt.type) {
      case 'chat:chunk': {
        const p = evt.payload as { text: string; messageId: string }
        setIsWaiting(false)
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
        setIsWaiting(false)
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, streaming: false } : m)),
        )
        break
      }
      case 'chat:error': {
        const p = evt.payload as { code: string; message: string }
        setIsWaiting(false)
        toast.error(p.message)
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
      case 'chat:tool_use': {
        const p = evt.payload as { messageId: string; id: string; name: string; input: string }
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...last,
              blocks: [...(last.blocks || []), { type: 'tool_use', name: p.name, input: p.input }],
            }
            return updated
          }
          return [...prev, {
            id: p.messageId,
            role: 'assistant',
            content: '',
            blocks: [{ type: 'tool_use', name: p.name, input: p.input }],
          }]
        })
        break
      }
      case 'chat:tool_result': {
        const p = evt.payload as { messageId: string; tool_use_id: string; content: string; is_error?: boolean }
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...last,
              blocks: [...(last.blocks || []), { type: 'tool_result', tool_use_id: p.tool_use_id, content: p.content, is_error: p.is_error }],
            }
            return updated
          }
          return [...prev, {
            id: p.messageId,
            role: 'assistant',
            content: '',
            blocks: [{ type: 'tool_result', tool_use_id: p.tool_use_id, content: p.content, is_error: p.is_error }],
          }]
        })
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

  const handleSend = (content: string, model?: string) => {
    if (!content.trim()) return
    const id = `user-${Date.now()}`
    setMessages((prev) => [...prev, { id, role: 'user', content: content.trim() }])
    setIsWaiting(true)
    send({ id: `req-${Date.now()}`, type: 'chat:send', payload: { content: content.trim(), model } })
  }

  const handlePillClick = (prompt: string) => {
    handleSend(prompt)
    setDayZero(null)
  }

  return (
    <div
      className="relative flex h-screen w-screen bg-slate-50 pt-7 text-slate-900 dark:bg-slate-900 dark:text-slate-50"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false) /* Phase 3 处理文件 */ }}
    >
      {/* Left Sidebar */}
      {effectiveLeftOpen && <SidebarLeft />}

      {/* Middle Content */}
      <div className="flex min-w-[500px] flex-1 flex-col">
        <ChatHeader
          workspaceName="默认工作区"
          isOnline={!offline}
          theme={theme === 'system' ? 'light' : theme}
          onSetTheme={(t) => setTheme(t)}
          isLeftOpen={effectiveLeftOpen}
          onToggleLeft={() => setIsLeftOpenManual((v) => (v === null ? !isLeftOpenResponsive : !v))}
          isRightOpen={effectiveRightOpen}
          onToggleRight={() => setIsRightOpenManual((v) => !v)}
        />
        <OfflineBanner offline={offline} onRetry={() => send({ id: `hc-${Date.now()}`, type: 'health:check', payload: {} })} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {dayZero && messages.length === 0 && (
              <DayZeroWelcome content={dayZero.content} pills={dayZero.pills} onPillClick={handlePillClick} />
            )}
            <MessageList messages={messages} isWaiting={isWaiting} />
          </div>
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <UnifiedConsole onSend={handleSend} disabled={offline} />
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
              AI 可能会犯错。处理涉及财务或敏感数据前，请核实生成内容。
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs text-white shadow">
            AI 引擎连接中...
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      {effectiveRightOpen && <SidebarRight />}

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-text, #1e293b)',
          },
        }}
      />

      <FileDropOverlay show={isDragging} />
    </div>
  )
}
