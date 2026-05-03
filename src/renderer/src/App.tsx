import { Toolbar } from './components/layout/Toolbar'
import { TransportBar } from './components/layout/TransportBar'
import { CueList } from './components/cue-list/CueList'
import { Inspector } from './components/inspector/Inspector'
import { WaveformPanel } from './components/waveform/WaveformPanel'
import './App.css'

export function App() {
  return (
    <div className="app-shell">
      <Toolbar />
      <div className="app-main">
        <CueList />
        <Inspector />
      </div>
      <WaveformPanel />
      <TransportBar />
    </div>
  )
}
