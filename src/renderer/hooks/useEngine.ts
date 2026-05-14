// src/renderer/hooks/useEngine.ts
import { useEffect, useRef, useState, useCallback } from 'react'
import type { EngineRequest, EngineEvent } from '@shared/ipc-types.js'

export function useEngine(onEvent: (evt: EngineEvent) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const eventHandlerRef = useRef(onEvent)
  eventHandlerRef.current = onEvent

  useEffect(() => {
    if (typeof window === 'undefined' || !window.engineAPI) {
      console.warn('engineAPI not available')
      return
    }
    setIsConnected(true)
    const unsubscribe = window.engineAPI.onMessage((evt) => {
      if (evt.type === 'engine:crashed') {
        setIsConnected(false)
      }
      eventHandlerRef.current(evt)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const send = useCallback((req: EngineRequest) => {
    if (typeof window !== 'undefined' && window.engineAPI) {
      window.engineAPI.postMessage(req)
    }
  }, [])

  return { send, isConnected }
}
