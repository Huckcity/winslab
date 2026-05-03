import { useState } from 'react'
import { useSelectedCue, useStore } from '../../store'
import { BasicTab } from './BasicTab'
import { AudioInspector } from './AudioInspector'
import { MidiInspector } from './MidiInspector'
import { OscInspector } from './OscInspector'
import { WaitInspector } from './WaitInspector'
import { FadeInspector } from './FadeInspector'
import { GroupInspector } from './GroupInspector'
import type { Cue } from '../../types/cue'
import './Inspector.css'

const TYPE_TABS: Record<string, string[]> = {
  audio: ['Basics', 'Audio', 'Timing'],
  midi: ['Basics', 'MIDI'],
  osc: ['Basics', 'OSC'],
  wait: ['Basics', 'Wait'],
  fade: ['Basics', 'Fade'],
  stop: ['Basics'],
  group: ['Basics', 'Group'],
  network: ['Basics', 'Network'],
  script: ['Basics', 'Script']
}

function TabContent({ cue, tab }: { cue: Cue; tab: string }) {
  if (tab === 'Basics') return <BasicTab cue={cue} />
  if (tab === 'Audio' || tab === 'Timing') return <AudioInspector cue={cue as any} tab={tab} />
  if (tab === 'MIDI') return <MidiInspector cue={cue as any} />
  if (tab === 'OSC') return <OscInspector cue={cue as any} />
  if (tab === 'Wait') return <WaitInspector cue={cue as any} />
  if (tab === 'Fade') return <FadeInspector cue={cue as any} />
  if (tab === 'Group') return <GroupInspector cue={cue as any} />
  return <div className="inspector-placeholder">No settings for this tab.</div>
}

export function Inspector() {
  const cue = useSelectedCue()
  const [activeTab, setActiveTab] = useState('Basics')

  if (!cue) {
    return (
      <div className="inspector inspector-empty">
        Select a cue to inspect it.
      </div>
    )
  }

  const tabs = TYPE_TABS[cue.type] ?? ['Basics']
  const tab = tabs.includes(activeTab) ? activeTab : tabs[0]

  return (
    <div className="inspector">
      <div className="inspector-tabs">
        {tabs.map(t => (
          <button
            key={t}
            className="inspector-tab"
            data-active={t === tab}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="inspector-body">
        <TabContent key={cue.id} cue={cue} tab={tab} />
      </div>
    </div>
  )
}
