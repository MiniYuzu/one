// src/renderer/components/sidebar/SidebarLeft.tsx
import { useState } from 'react'
import { Bot, Plus, Search, LayoutGrid, Wrench, Settings, ChevronLeft, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { icon: Plus, label: '新建工作区' },
  { icon: Search, label: '全局搜索' },
  { icon: LayoutGrid, label: '我的工作区' },
  { icon: Wrench, label: '本地工具库' },
]

const MOCK_WORKSPACES = [
  { id: '1', name: '默认工作区', active: true },
  { id: '2', name: '季度报表', active: false },
  { id: '3', name: '客户数据分析', active: false },
]

export function SidebarLeft() {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900 ${
        expanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo Header */}
      <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Bot size={18} />
        </div>
        {expanded && <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI Agent</span>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label={expanded ? '收起侧边栏' : '展开侧边栏'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav Buttons */}
      <div className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
              expanded ? '' : 'justify-center'
            }`}
            title={item.label}
          >
            <item.icon size={18} />
            {expanded && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Workspace List */}
      {expanded && (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <p className="px-3 py-1 text-xs font-medium text-slate-400">最近工作区</p>
          {MOCK_WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                ws.active
                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${ws.active ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Settings */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-700">
        <button
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            expanded ? '' : 'justify-center'
          }`}
          title="设置"
        >
          <Settings size={18} />
          {expanded && <span>设置</span>}
        </button>
      </div>
    </div>
  )
}
