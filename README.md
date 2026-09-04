# WinsLab

A cross-platform **QLab alternative** for Windows and macOS — professional show-control software for managing audio, MIDI, OSC, and network cues in live performance and broadcast environments.

Built with Electron, React, TypeScript, and Zustand. Licensed under [MIT](./LICENSE).

## Features

- **9 Cue Types**: Audio, MIDI, OSC, Wait, Fade, Stop, Group, Network, and Script cues
- **Audio Playback**: Multi-output audio with per-device volume/pan, fading, and loop control
- **MIDI Control**: Send MIDI messages to external instruments and gear
- **OSC Integration**: Send Open Sound Control messages for networked control
- **Show Sequencing**: Group cues, set auto-advance, pre/post-wait delays, and arm/disarm
- **Workspace Management**: Save/load `.wlab` JSON workspaces with full undo/redo
- **Cross-Platform**: Windows (NSIS installer) and macOS (DMG) builds
- **Timeline Mode**: Visual timeline-based show layout (alternative to list view)

## Getting Started

### Prerequisites

- Node.js 20+ (Node 24 also supported)
- npm or yarn
- macOS 10.15+ or Windows 10+ (for building)

### Installation

```bash
# Clone the repository
git clone https://github.com/Huckcity/winslab.git
cd winslab

# Install dependencies (with legacy peer deps support)
npm install --legacy-peer-deps

# Start dev server with hot reload
npm run dev
```

### Development Commands

```bash
npm run dev                # Start electron-vite dev server with hot reload
npm run typecheck          # TypeScript type check (no emit)
npm test                   # Run unit tests (Vitest)
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
npm run test:e2e          # Run E2E tests (Playwright, requires build)
npm run test:e2e:headed   # Run E2E tests with visible browser
npm run build             # Build TypeScript/React only (no packaging)
npm run preview           # Preview built app without packaging
npm run dist              # Build and package for all platforms
npm run dist:win          # Build and package for Windows only
npm run dist:mac          # Build and package for macOS only
```

## Architecture

WinsLab is structured as an Electron app with three distinct layers communicating exclusively over IPC:

```
Renderer Layer (React/Zustand)
  ├─ window.winslab (IPC bridge via contextBridge)
  │   └─ src/preload/index.ts
  │
Main Process Layer
  ├─ src/main/ipc/handlers.ts (ipcMain.handle)
  │   ├─ MidiEngine (using 'midi' npm package)
  │   ├─ OscEngine (using 'node-osc')
  │   └─ WorkspaceManager (fs + file dialogs)
```

**Key principle**: The renderer has **no direct Node.js access**. All I/O (file operations, MIDI, OSC, audio loading) goes through the IPC bridge.

### Cue Data Model

All cues extend `CueBase` and are stored in a flat array with `parentId` pointers for grouping:

```typescript
type CueType = 
  | "audio"    // Play audio file with outputs, fading, loop control
  | "midi"     // Send MIDI messages
  | "osc"      // Send OSC packets over network
  | "wait"     // Pause for specified duration
  | "fade"     // Gradually change target cue's volume/pan
  | "stop"     // Stop audio playback
  | "group"    // Sequence or randomly play child cues
  | "network"  // Make HTTP request
  | "script";  // Execute JavaScript
```

Key fields affecting playback:
- `preWait` / `postWait` — delays before/after execution (ms)
- `advance: 'none' | 'on-start' | 'on-end'` — auto-advance behavior
- `isArmed` — disarmed cues are skipped by GO button
- `parentId` — null for top-level; otherwise references parent group

### Playback Engine

`CueRunner` (in `src/renderer/src/engine/CueRunner.ts`) is a singleton that sequences cue execution:

1. **Execution sequence**: pre-wait → execute → post-wait → onDone callback
2. **Groups**: Can run children sequentially or randomly
3. **Auto-advance**: Fires next cue either immediately after pre-wait ("on-start") or after completion ("on-end")
4. **Timers**: Tracked with keys like `"cueId"`, `"cueId:pre"`, `"cueId:post"` for cancellation
5. **Panic**: 200ms audio fadeout + hard stop all

### Audio Engine

`AudioPlayer` (in `src/renderer/src/engine/AudioPlayer.ts`) uses Web Audio API:

- Audio files read via IPC and decoded client-side
- Decoded `AudioBuffer`s cached (LRU, max 100)
- Per-cue playback chain: `BufferSource → GainNode (volume + fade) → StereoPannerNode → destination`
- Multi-output support: each audio cue can route to different device/channel pairs

### State Management

Zustand store (`src/renderer/src/store/index.ts`) maintains:
- `cues: Cue[]` — flat workspace cue array
- `selectedId` — currently selected cue
- `isDirty` — unsaved changes flag
- `running: Map<string, RunningCue>` — live playback state
- Undo/redo stacks (`past`, `future`)

## Project Structure

```
winslab/
├── src/
│   ├── main/
│   │   ├── ipc/
│   │   │   └── handlers.ts          # Main process IPC handlers
│   │   └── index.ts                 # Electron main process entry
│   ├── preload/
│   │   └── index.ts                 # IPC bridge (context isolation)
│   └── renderer/
│       └── src/
│           ├── components/          # React components
│           ├── engine/              # CueRunner, AudioPlayer
│           ├── store/               # Zustand state management
│           ├── types/               # TypeScript definitions (Cue, Workspace)
│           ├── utils/               # Helpers (cueDefaults, formatDuration)
│           ├── App.tsx              # Root component
│           └── index.css
├── e2e/                             # Playwright E2E tests
├── src/test/                        # Vitest setup & mocks
├── resources/                       # App icons, installer assets
├── .github/workflows/               # CI/CD (typecheck, tests, build)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron.vite.config.ts
```

## Workspace Format

Workspaces are saved as `.wlab` files (JSON format matching the `Workspace` interface):

```json
{
  "name": "My Show",
  "cues": [
    {
      "id": "uuid",
      "type": "audio",
      "number": "1",
      "name": "Intro Music",
      "filePath": "/path/to/file.mp3",
      "outputs": [{"deviceId": "default", "channelPair": [1, 2], "volume": 1, "pan": 0}],
      "preWait": 0,
      "postWait": 0,
      "advance": "on-end",
      "isArmed": true
      // ... other fields
    }
  ],
  "audioSettings": { /* master volume, device settings */ },
  "midiSettings": { /* port mappings */ }
}
```

`WorkspaceManager` (main process) handles I/O and auto-migrates legacy fields on load.

## Testing

- **Unit Tests**: `npm test` (Vitest, jsdom environment)
  - Covers: CueRunner sequencing, store actions, audio playback, utilities
  - Location: `src/**/*.test.ts`
  - Fakes timers for deterministic timing tests
- **E2E Tests**: `npm run test:e2e` (Playwright, requires build)
  - Tests UI interactions, drag/drop, playback flow
  - Location: `e2e/`
  - Use helpers from `e2e/helpers.ts`

**Before committing**:
```bash
npm test && npm run typecheck
# For UI changes, also run:
npm run test:e2e
```

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **`ci.yml`**: Runs on pull requests
  - Typecheck, unit tests (Ubuntu), E2E tests (macOS)
  - Node 20 with `--legacy-peer-deps`
- **`build.yml`**: Runs on version tags (`v*`)
  - Tests + builds Windows (NSIS) and macOS (DMG) installers
  - Uploads to R2 (Cloudflare) and GitHub Releases
- **`release.yml`**: Semantic versioning with `semantic-release`

## Known Limitations

- MIDI native module requires ALSA headers on Linux (not officially supported)
- Network cues require appropriate CORS headers on target servers
- E2E tests require display (run on macOS in CI, headless on Linux requires Xvfb)

## Contributing

1. Create a branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run `npm test && npm run typecheck` (and `npm run test:e2e` for UI changes)
4. Commit with conventional commits: `feat:`, `fix:`, `chore:`, etc.
5. Push and create a pull request

See `CLAUDE.md` for detailed development guidelines.

## Support

- **Issues**: [GitHub Issues](https://github.com/Huckcity/winslab/issues)
- **Feedback**: The fastest way to shape Winslab is to file an issue with your use case — "I run sound for X and need Y" directly drives the roadmap.
