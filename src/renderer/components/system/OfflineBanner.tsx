// src/renderer/components/system/OfflineBanner.tsx
import { WifiOff, RefreshCw } from 'lucide-react'

interface OfflineBannerProps {
  offline: boolean
  onRetry: () => void
}

export function OfflineBanner({ offline, onRetry }: OfflineBannerProps) {
  if (!offline) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-rose-500 px-4 py-2 text-xs text-white">
      <WifiOff size={14} />
      <span>网络连接已断开</span>
      <button
        onClick={onRetry}
        className="ml-2 flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
      >
        <RefreshCw size={12} />
        重试
      </button>
    </div>
  )
}
