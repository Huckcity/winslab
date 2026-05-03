# Winslab App UI Kit

A high-fidelity interactive recreation of the Winslab desktop application.

## Architecture

The Winslab app is a single-window Electron app with this layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar  (44px) — WinsLab ▾ | workspace name | Add Cue:…  │
├────────────────────────────────────┬────────────────────────┤
│                                    │                        │
│  Cue List  (flex 1)                │  Inspector  (320px)    │
│  virtualized table of cues         │  tabbed settings panel │
│                                    │                        │
├────────────────────────────────────┴────────────────────────┤
│  Waveform Panel  (110px) — canvas audio waveform            │
├─────────────────────────────────────────────────────────────┤
│  Transport Bar  (52px) — STOP | GO | PANIC                  │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Description |
|---|---|
| `index.html` | Full interactive prototype entry point |
| `Toolbar.jsx` | WinsLab brand btn, file menu, workspace name, Add Cue buttons |
| `CueList.jsx` | Cue list with header, cue rows (all states), drop indicator |
| `Inspector.jsx` | Inspector panel: tabbed, all cue type inspectors |
| `TransportBar.jsx` | GO / STOP / PANIC transport with running badge |
| `WaveformPanel.jsx` | Canvas waveform panel (simulated) |

## Design Tokens

All colors and type tokens are defined in `/colors_and_type.css`.

## Notes

- Prototype uses an in-memory Zustand-like store (plain React state) for simplicity
- Audio engine is simulated — no real audio playback in the prototype
- Drag-to-reorder is implemented; waveform is a synthetic static render
- File open/save dialogs are stubbed out with alerts
