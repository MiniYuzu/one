// src/renderer/components/system/OfflineBanner.tsx
import { WifiOff } from 'lucide-react'

interface OfflineBannerProps {
  offline: boolean
  onRetry: () => void
}

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
  if (!offline) return null

  return (
    <div className="flex items-center justify-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
      <WifiOff size={14} />
      <span>网络不可用，仅支持查看历史会话</span>
      <button
        onClick={onRetry}
        className="ml-1 text-xs font-medium text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
      >
        重试
      </button>
    </div>
  )
}
