// src/renderer/hooks/useResponsiveLayout.ts
import { useState, useEffect } from 'react'

export interface LayoutState {
  width: number
  isLeftOpen: boolean
  isRightOpen: boolean
}

const RIGHT_PANEL_THRESHOLD = 1100
const LEFT_RAIL_THRESHOLD = 800

export function useResponsiveLayout(): LayoutState {
  const [width, setWidth] = useState(window.innerWidth)
  const [isRightOpen, setIsRightOpen] = useState(window.innerWidth >= RIGHT_PANEL_THRESHOLD)
  const [isLeftOpen, setIsLeftOpen] = useState(window.innerWidth >= LEFT_RAIL_THRESHOLD)

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setWidth(w)
      setIsRightOpen(w >= RIGHT_PANEL_THRESHOLD)
      setIsLeftOpen(w >= LEFT_RAIL_THRESHOLD)
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { width, isLeftOpen, isRightOpen }
}
