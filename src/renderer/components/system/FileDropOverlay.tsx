// src/renderer/components/system/FileDropOverlay.tsx
import { Upload, FileText } from 'lucide-react'

interface FileDropOverlayProps {
  show: boolean
}

export function FileDropOverlay({ show }: FileDropOverlayProps) {
  if (!show) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-600/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-10 shadow-2xl dark:bg-slate-900"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10"
        >
          <Upload size={32} className="text-indigo-600 dark:text-indigo-300" />
        </div>
        <div className="text-center"
        >
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100"
          >释放以上传文件</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400"
          >支持 Excel、Word、PDF、PPT、Markdown、TXT</p>
        </div>
        <div className="flex gap-3"
        >
          {['.xlsx', '.docx', '.pdf', '.pptx', '.md'].map((ext) => (
            <div key={ext} className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              <FileText size={10} />
              {ext}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
