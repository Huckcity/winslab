import { useStore } from '../../store'
import { useCueRunner, useKeyboard } from '../../hooks/useCueRunner'
import './TransportBar.css'

export function TransportBar() {
  const { go, stop, panic } = useCueRunner()
  useKeyboard(go, stop, panic)

  const selectedId = useStore(s => s.selectedId)
  const cues = useStore(s => s.cues)
  const running = useStore(s => s.running)

  const selectedCue = cues.find(c => c.id === selectedId)
  const runningCount = running.size

  return (
    <div className="transport-bar">
      <div className="transport-left">
        <span className="running-badge" data-active={runningCount > 0}>
          {runningCount > 0 ? `${runningCount} running` : 'idle'}
        </span>
      </div>
      <div className="transport-center">
        <button className="btn-stop" onClick={stop} title="Stop All (Esc)">
          ■ STOP
        </button>
        <button className="btn-go" onClick={go} title="Go (Space)">
          ▶ GO
        </button>
        <button className="btn-panic" onClick={panic} title="Panic (Shift+Esc)">
          ✕ PANIC
        </button>
      </div>
      <div className="transport-right">
        {selectedCue && (
          <span className="next-cue">
            <strong>{selectedCue.number}</strong> {selectedCue.name}
          </span>
        )}
      </div>
    </div>
  )
}
