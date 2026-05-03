import { useEffect, useCallback } from 'react'
import { cueRunner } from '../engine/CueRunner'
import { useStore } from '../store'

export function useCueRunner() {
  const setRunning = useStore(s => s.setRunning)
  const clearAllRunning = useStore(s => s.clearAllRunning)
  const select = useStore(s => s.select)
  const syncCueDuration = useStore(s => s.syncCueDuration)

  useEffect(() => {
    cueRunner.init({
      getCues: () => useStore.getState().cues,
      getSelected: () => useStore.getState().selectedId,
      setSelected: select,
      setRunning,
      clearAllRunning,
      syncCueDuration
    })
  }, [select, setRunning, clearAllRunning, syncCueDuration])

  const go = useCallback(() => cueRunner.go(), [])
  const stop = useCallback(() => cueRunner.stop(), [])
  const panic = useCallback(() => cueRunner.panic(), [])

  return { go, stop, panic }
}

export function useKeyboard(go: () => void, stop: () => void, panic: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const tag = el?.tagName
      const isTextInput = (tag === 'INPUT' && (el as HTMLInputElement).type !== 'range') ||
        tag === 'TEXTAREA' || tag === 'SELECT'
      if (isTextInput) return
      if (e.code === 'Space' && !e.shiftKey) { e.preventDefault(); go() }
      if (e.code === 'Escape' && e.shiftKey) { e.preventDefault(); panic() }
      if (e.code === 'Escape' && !e.shiftKey) { e.preventDefault(); stop() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, stop, panic])
}
