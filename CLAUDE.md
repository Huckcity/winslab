# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow rules

- All development happens on a new branch, never directly on `main`. Create the branch before writing any code: `git checkout -b <descriptive-name>`.
- Every change must be covered by a test. Any change that affects the UI must also have a Playwright E2E test in `e2e/`.
- Run `npm test && npm run test:e2e` before each commit. Only commit once all tests pass.
- Make a commit after each coherent batch of work — not one giant commit at the end.

## Commands

```bash
npm run dev              # Start electron-vite dev server with hot reload
npm run typecheck        # TypeScript type check (no emit)
npm test                 # Vitest unit tests (single run)
npm run test:watch       # Vitest in watch mode
npm run test:coverage    # Coverage report (HTML + text)
npm run test:e2e         # Build then run Playwright E2E (headless)
npm run test:e2e:headed  # Build then run Playwright E2E (visible)
```

**Single test file:**
```bash
npx vitest src/renderer/src/engine/CueRunner.test.ts   # unit
npm run build && npx playwright test e2e/playback.spec.ts  # E2E
```

## Architecture

WinsLab is an Electron app with three layers — main process, preload bridge, and renderer — communicating exclusively over IPC.

### Process boundaries

```
Renderer (React/Zustand)
  └─ window.winslab  (contextBridge)
       └─ src/preload/index.ts
            └─ ipcRenderer.invoke(channel, ...args)
                 └─ src/main/ipc/handlers.ts  (ipcMain.handle)
                      ├─ MidiEngine  (midi npm package)
                      ├─ OscEngine   (node-osc)
                      └─ WorkspaceManager  (fs + dialog)
```

The renderer has **no direct Node.js access**. Everything goes through `window.winslab`:

```typescript
window.winslab.audio.readFile(filePath)    // ArrayBuffer via IPC
window.winslab.audio.pickFile()            // File dialog
window.winslab.midi.send({portName, messages})
window.winslab.osc.send({host, port, address, args})
window.winslab.workspace.save(workspace, existingPath)
window.winslab.workspace.open()            // Returns {path, workspace} | null
window.winslab.workspace.confirmClose(name) // Returns 0=Save 1=DontSave 2=Cancel
```

### Cue data model (`src/renderer/src/types/cue.ts`)

All 9 cue types share `CueBase` and form a discriminated union on `type`:

```typescript
type CueType = 'audio' | 'midi' | 'osc' | 'wait' | 'fade' | 'stop' | 'group' | 'network' | 'script'
```

Key `CueBase` fields that affect playback behaviour:
- `preWait` / `postWait` — ms delays before/after execution
- `advance: 'none' | 'on-start' | 'on-end'` — auto-advance to next cue trigger point
- `isArmed` — disarmed cues are skipped by GO
- `parentId: string | null` — groups are stored **flat** in the cues array; children point to their parent group via `parentId`

### Zustand store (`src/renderer/src/store/index.ts`)

Single flat `cues: Cue[]` array — no nested tree. Group children are interleaved in the array after their parent, identified by `parentId`.

Key store actions:
- `addCue(type, afterId?)` — smart insertion: after a group header → becomes a child; after a child → inherits same parent
- `moveCue(fromIndex, toIndex, newParentId?)` — drag/drop reordering
- `duplicateCue(id)` — deep copies group children too
- `loadWorkspace(cues, name, path)` — replaces entire state, clears `isDirty` and `running`
- `setRunning(id, RunningCue | null)` — tracks live playback state (`Map<string, RunningCue>`)

Hooks: `useSelectedCue()`, `useParentGroup(cueId)`.

### Playback engine (`src/renderer/src/engine/CueRunner.ts`)

Singleton `cueRunner` exported from the module. Initialized once in `App.tsx` with store callbacks.

Core execution flow for `go()`:
1. `fireCue(cue, onDone)` sequences: pre-wait → `execute(cue)` → post-wait → `onDone()`
2. `execute()` dispatches by type — audio and wait are async; MIDI/OSC are fire-and-forget
3. After `onDone`, if `advance === 'on-end'` the next cue is auto-fired; `'on-start'` fires it immediately after pre-wait
4. Groups: `executeGroup()` runs children sequentially via recursion (`runSequence()`), or picks one randomly
5. Selection advancement skips past group children to the next top-level cue

Timers tracked in `Map<string, NodeJS.Timeout>` with keys `"cueId"`, `"cueId:pre"`, `"cueId:post"` — cancel by prefix on `stop(cueId)`.

`panic()` = 200 ms audio fadeout then hard stop all.

### Audio engine (`src/renderer/src/engine/AudioPlayer.ts`)

Singleton `audioPlayer`. Uses Web Audio API; audio files are read in main via `window.winslab.audio.readFile()` and decoded client-side with `AudioContext.decodeAudioData`. Decoded `AudioBuffer`s are LRU-cached (100 max).

Playback chain per cue: `BufferSource → GainNode (volume + fade) → StereoPannerNode → AudioContext.destination`

Key methods: `play(cue, onEnd, onDurationKnown)`, `stop(cueId, fadeMs?)`, `stopAll(fadeMs?)`, `setVolume(cueId, target, durationMs)`, `getProgress(cueId)`.

### Workspace persistence

Files saved as `.wlab` JSON matching the `Workspace` interface (`src/renderer/src/types/workspace.ts`). `WorkspaceManager` (main process) handles file I/O and migrates legacy fields on load:
- `autoContinue` / `autoFollow` → `advance`
- `childIds` array → flat `parentId` pointers

### E2E tests (`e2e/`)

`e2e/helpers.ts` exports `launchApp()` (launches from `out/main/index.js`) and `closeApp()`. Tests use `test.beforeAll` / `test.afterAll` to start/stop Electron once per file.

CSS selectors used in E2E: `.cue-row`, `.toolbar`, `.toolbar-cue-btn`, `.transport-bar`, `.inspector-*`.

### Unit test patterns

- Vitest globals enabled; jsdom environment; `src/test/setup.ts` mocks `window.winslab`
- CueRunner tests use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` to step through pre/post-wait sequences
- Store tests reset via `useStore.setState(initialState)` in `beforeEach`
- Coverage targets: `src/renderer/src/engine/**`, `src/renderer/src/store/**`, `src/renderer/src/utils/**`
