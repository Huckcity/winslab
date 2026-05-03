import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { audioPlayer } from '../../engine/AudioPlayer'
import './SettingsDialog.css'

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const { audioSettings, midiSettings, updateAudioSettings, updateMidiSettings } = useStore()
  const [tab, setTab] = useState<'audio' | 'midi'>('audio')
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [midiPorts, setMidiPorts] = useState<string[]>([])

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'))
    })
    window.winslab.midi.listPorts().then(setMidiPorts)
  }, [])

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleOutputDevice = async (deviceId: string) => {
    updateAudioSettings({ outputDeviceId: deviceId })
    await audioPlayer.setOutputDevice(deviceId)
  }

  return (
    <div className="settings-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="settings-tabs">
          <button
            className="settings-tab"
            data-active={tab === 'audio'}
            onClick={() => setTab('audio')}
          >Audio</button>
          <button
            className="settings-tab"
            data-active={tab === 'midi'}
            onClick={() => setTab('midi')}
          >MIDI</button>
        </div>

        <div className="settings-body">
          {tab === 'audio' && (
            <>
              <div className="field-row">
                <label>Output device</label>
                <select
                  value={audioSettings.outputDeviceId}
                  onChange={e => handleOutputDevice(e.target.value)}
                >
                  {outputDevices.length === 0 && (
                    <option value="default">Default Output</option>
                  )}
                  {outputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Output ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label>Sample rate</label>
                <span className="settings-info">{audioSettings.sampleRate.toLocaleString()} Hz</span>
              </div>
              <div className="field-row">
                <label>Buffer size</label>
                <span className="settings-info">{audioSettings.bufferSize} samples</span>
              </div>
            </>
          )}

          {tab === 'midi' && (
            <>
              <div className="field-row">
                <label>Default output</label>
                <select
                  value={midiSettings.outputPortName}
                  onChange={e => updateMidiSettings({ outputPortName: e.target.value })}
                >
                  <option value="">— none —</option>
                  {midiPorts.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <p className="inspector-hint">
                Individual MIDI cues can override this with a per-cue port selection.
              </p>
            </>
          )}
        </div>

        <div className="settings-footer">
          <button className="inspector-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
