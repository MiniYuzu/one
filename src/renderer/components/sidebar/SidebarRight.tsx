// src/renderer/components/sidebar/SidebarRight.tsx
import { useState } from 'react'
import { Layout, FileText, FileSpreadsheet, Presentation } from 'lucide-react'

const MOCK_FILES = [
  { id: '1', name: '销售数据_Q1.xlsx', type: 'excel', size: '24 KB', time: '10:30' },
  { id: '2', name: '会议纪要_0512.docx', type: 'word', size: '12 KB', time: '09:15' },
]

const FILE_ICONS: Record<string, React.ReactNode> = {
  excel: <FileSpreadsheet size={16} className="text-emerald-500" />,
  word: <FileText size={16} className="text-blue-500" />,
  ppt: <Presentation size={16} className="text-amber-500" />,
}

type Tab = 'files' | 'preview'

export function SidebarRight() {
  const [activeTab, setActiveTab] = useState<Tab>('files')

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Tab Bar */}
      <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('files')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'files'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            产物文件
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === 'preview'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            在线预览
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'files' ? (
          <div className="flex flex-col gap-1 p-2">
            {MOCK_FILES.map((file) => (
              <button
                key={file.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {FILE_ICONS[file.type] || <FileText size={16} className="text-slate-400" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{file.name}</span>
                  <span className="text-xs text-slate-400">
                    {file.size} · {file.time}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-slate-400">
            <Layout size={40} strokeWidth={1.5} />
            <p className="text-sm">选择左侧文件以预览</p>
          </div>
        )}
      </div>
    </div>
  )
}
