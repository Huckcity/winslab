import { useStore } from '../../store'
import type { GroupCue, GroupMode } from '../../types/cue'

interface Props { cue: GroupCue }

const TYPE_ICON: Record<string, string> = {
  audio: '♪', midi: 'M', osc: 'O', wait: '⏱', fade: '↘',
  stop: '■', group: '▤', network: '⊕', script: '{ }'
}

export function GroupInspector({ cue }: Props) {
  const update = useStore(s => s.updateCue)
  const allCues = useStore(s => s.cues)
  const set = (patch: Partial<GroupCue>) => update(cue.id, patch as any)

  const candidates = allCues.filter(c => c.id !== cue.id && c.type !== 'group')

  const toggle = (id: string) => {
    const childIds = cue.childIds.includes(id)
      ? cue.childIds.filter(c => c !== id)
      : [...cue.childIds, id]
    set({ childIds })
  }

  const moveChild = (index: number, direction: -1 | 1) => {
    const childIds = [...cue.childIds]
    const target = index + direction
    if (target < 0 || target >= childIds.length) return
    ;[childIds[index], childIds[target]] = [childIds[target], childIds[index]]
    set({ childIds })
  }

  const orderedChildren = cue.childIds
    .map(id => allCues.find(c => c.id === id))
    .filter(Boolean)

  return (
    <div>
      <div className="field-row">
        <label>Mode</label>
        <select value={cue.mode} onChange={e => set({ mode: e.target.value as GroupMode })}>
          <option value="sequence">Sequence — run children in order</option>
          <option value="playlist">Playlist — advance manually</option>
          <option value="random">Random — pick one at random</option>
        </select>
      </div>

      {orderedChildren.length > 0 && (
        <>
          <div className="field-section-title">Children ({orderedChildren.length})</div>
          <div className="group-children">
            {orderedChildren.map((child, i) => child && (
              <div key={child.id} className="group-child-row">
                <span className="group-child-icon">{TYPE_ICON[child.type]}</span>
                <span className="group-child-num">{child.number}</span>
                <span className="group-child-name">{child.name || <em>untitled</em>}</span>
                <button onClick={() => moveChild(i, -1)} disabled={i === 0} className="group-child-btn">↑</button>
                <button onClick={() => moveChild(i, 1)} disabled={i === orderedChildren.length - 1} className="group-child-btn">↓</button>
                <button onClick={() => toggle(child.id)} className="group-child-btn remove">✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="field-section-title">Add Children</div>
      {candidates.length === 0 ? (
        <p className="inspector-hint">No other cues available to add.</p>
      ) : (
        <div className="group-candidates">
          {candidates.map(c => (
            <label key={c.id} className="group-candidate">
              <input
                type="checkbox"
                checked={cue.childIds.includes(c.id)}
                onChange={() => toggle(c.id)}
              />
              <span className="group-child-icon">{TYPE_ICON[c.type]}</span>
              <span className="group-child-num">{c.number}</span>
              <span>{c.name || <em>untitled</em>}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
