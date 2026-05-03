import { useState } from 'react'
import { Toolbar } from './components/layout/Toolbar'
import { TransportBar } from './components/layout/TransportBar'
import { CueList } from './components/cue-list/CueList'
import { Inspector } from './components/inspector/Inspector'
import { WaveformPanel } from './components/waveform/WaveformPanel'
import { TimelineEditor } from './components/timeline/TimelineEditor'
import { SettingsDialog } from './components/layout/SettingsDialog'
import { useSelectedCue } from './store'
import type { GroupCue } from './types/cue'
import './App.css'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const selected = useSelectedCue()

  const timelineGroupCue = selected?.type === 'group' && (selected as GroupCue).mode === 'timeline'
    ? selected as GroupCue
    : null

  const shellClass = `app-shell${timelineExpanded && timelineGroupCue ? ' timeline-fullscreen' : ''}`

  return (
    <div className={shellClass}>
      <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="app-main">
        <CueList />
        <Inspector />
      </div>
      {timelineGroupCue
        ? <TimelineEditor
            cue={timelineGroupCue}
            expanded={timelineExpanded}
            onToggleExpand={() => setTimelineExpanded(e => !e)}
          />
        : <WaveformPanel />
      }
      <TransportBar />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
