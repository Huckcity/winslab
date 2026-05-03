import { useState } from 'react'
import { Toolbar } from './components/layout/Toolbar'
import { TransportBar } from './components/layout/TransportBar'
import { CueList } from './components/cue-list/CueList'
import { Inspector } from './components/inspector/Inspector'
import { WaveformPanel } from './components/waveform/WaveformPanel'
import { SettingsDialog } from './components/layout/SettingsDialog'
import './App.css'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="app-shell">
      <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="app-main">
        <CueList />
        <Inspector />
      </div>
      <WaveformPanel />
      <TransportBar />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
