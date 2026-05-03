import { useStore } from '../../store'
import type { GroupCue, GroupMode } from '../../types/cue'

interface Props { cue: GroupCue }

export function GroupInspector({ cue }: Props) {
  const update = useStore(s => s.updateCue)
  const set = (patch: Partial<GroupCue>) => update(cue.id, patch as any)

  return (
    <div>
      <div className="field-row">
        <label>Mode</label>
        <select value={cue.mode} onChange={e => set({ mode: e.target.value as GroupMode })}>
          <option value="sequence">Sequence — run all in order</option>
          <option value="playlist">Playlist — advance manually</option>
          <option value="random">Random — pick one at random</option>
        </select>
      </div>
      <p className="inspector-hint">
        Expand the group in the cue list to add, remove, or reorder its children.
      </p>
    </div>
  )
}
