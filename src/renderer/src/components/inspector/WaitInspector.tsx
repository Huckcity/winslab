import { useStore } from '../../store'
import type { WaitCue } from '../../types/cue'

interface Props { cue: WaitCue }

export function WaitInspector({ cue }: Props) {
  const update = useStore(s => s.updateCue)

  return (
    <div>
      <div className="field-row">
        <label>Duration (ms)</label>
        <input
          type="number"
          min={0}
          value={cue.duration}
          onChange={e => update(cue.id, { duration: Number(e.target.value) })}
        />
      </div>
      <p style={{ color: '#666', fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
        Wait cues pause the sequence for the specified duration, then continue.
        Set Auto-follow on the Basics tab to automatically fire the next cue after waiting.
      </p>
    </div>
  )
}
