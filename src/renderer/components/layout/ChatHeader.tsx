// src/renderer/components/layout/ChatHeader.tsx
import { Menu, Globe, PanelRight, Sun, Moon } from 'lucide-react'

interface ChatHeaderProps {
  workspaceName: string
  isOnline: boolean
  theme: 'light' | 'dark' | 'system'
  onSetTheme: (theme: 'light' | 'dark') => void
  isRightOpen: boolean
  onToggleRight: () => void
}

export function ChatHeader({
  workspaceName,
  isOnline,
  theme,
  onSetTheme,
  isRightOpen,
  onToggleRight,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
      {/* Left: Hamburger + Workspace Name */}
      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="菜单"
        >
          <Menu size={18} />
        </button>
        <h1 className="max-w-xs truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {workspaceName}
        </h1>
      </div>

      {/* Right: Status + Theme + Panel Toggle */}
      <div className="flex items-center gap-2">
        {/* Online Status */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800">
          <Globe size={12} className="text-slate-400" />
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isOnline ? '直连' : '离线'}
          </span>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
          <button
            onClick={() => onSetTheme('light')}
            className={`rounded-md p-1.5 transition ${
              theme === 'light'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label="浅色模式"
          >
            <Sun size={14} />
          </button>
          <button
            onClick={() => onSetTheme('dark')}
            className={`rounded-md p-1.5 transition ${
              theme === 'dark'
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label="深色模式"
          >
            <Moon size={14} />
          </button>
        </div>

        {/* Right Panel Toggle */}
        <button
          onClick={onToggleRight}
          className={`rounded-md p-1.5 transition ${
            isRightOpen
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
          }`}
          aria-label="切换右侧面板"
        >
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  )
}
