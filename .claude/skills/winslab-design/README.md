# Winslab Design System

## About

**Winslab** is a cross-platform QLab alternative for Windows — a professional show-control desktop application built with Electron + React + TypeScript. It is the primary product by Huckcity.

QLab is the industry-standard macOS show-control tool used in live theatre, concerts, and events to trigger audio, MIDI, OSC, video, and lighting cues. Winslab brings this capability to Windows.

### Source

- **Codebase:** GitHub — `Huckcity/winslab` (private, `main` branch)
- **Figma:** None provided
- **Design system:** Derived entirely from the codebase CSS and component files

---

## Products / Surfaces

| Surface | Description |
|---|---|
| **Desktop App** | Electron + React renderer — the only current surface. A single-window, full-screen dark UI. |

The app is a single-window layout with four main zones:
1. **Toolbar** — file menu (WinsLab ▾), workspace name, + Add Cue buttons
2. **Cue List** — virtualized table of cues, drag-to-reorder, file-drop support
3. **Inspector** — right panel, tabbed settings for the selected cue
4. **Waveform Panel** — canvas-rendered audio waveform below the cue list
5. **Transport Bar** — STOP / GO / PANIC buttons + running status at the bottom

---

## CONTENT FUNDAMENTALS

### Tone & Voice
- **Terse, technical, professional.** This is a tool for audio engineers and show operators, not a consumer app.
- **No marketing fluff.** Labels are direct: "Audio", "MIDI", "OSC", "Fade", "Stop", "Panic".
- **Lowercase is preferred** for status text and secondary labels: "idle", "playing", "pre-wait", "post-wait", "No cues." — but button actions are UPPERCASE: "STOP", "GO", "PANIC".
- **No emoji** anywhere in the UI.
- **Minimal copy.** Empty states say exactly what they need: "No cues. Add cues using the toolbar above, or drag audio files here." / "Select a cue to inspect it."
- **Technical abbreviations are fine:** Pre-W, Post-W, Adv, ms, dB, Hz.
- **Keyboard shortcut style:** macOS-style (⌘N, ⇧⌘S, ⌘O) — likely because the app targets Windows but the developer is macOS-native. Shortcuts shown inline in menus next to item label.

### Casing Rules
| Context | Case |
|---|---|
| Transport buttons | ALL CAPS |
| Section headers in inspector | UPPERCASE, small, letter-spaced |
| Column headers in cue list | UPPERCASE, small, letter-spaced |
| Menu items, tabs | Title Case |
| Labels & status text | lowercase |
| Cue types (in buttons) | Title Case: Audio, MIDI, OSC, Wait, Fade, Stop, Group, Network, Script |

### Language Patterns
- **Cue types** are nouns/verbs, not descriptions: "Audio", "MIDI", "Fade", "Stop"
- **Actions** are imperative: "Browse", "Add Message", "Add Argument", "Reset start time"
- **States** are past participles or nouns: "playing", "pre-wait", "idle", "running"
- **Placeholders** are lowercase, parenthetical: "play to end", "No file selected", "F0 41 10 42 12 ... F7"

---

## VISUAL FOUNDATIONS

### Color

The Winslab palette is a **deep dark theme** with a single amber accent and a blue interactive accent. Backgrounds are near-black neutrals; only interactive elements and status indicators use color.

| Role | Value | Usage |
|---|---|---|
| **bg-base** | `#181818` | App background, body |
| **bg-surface** | `#1e1e1e` | Toolbar, inspector panel |
| **bg-raised** | `#1a1a1a` | Cue list header, transport bar |
| **bg-well** | `#111` | Waveform panel |
| **bg-card** | `#252525` | MIDI message blocks, group child rows |
| **bg-input** | `#2a2a2a` | Form inputs, cue type buttons |
| **bg-hover** | `#3a3a3a` | Button/input hover |
| **border** | `#333` | Primary panel borders |
| **border-soft** | `#2a2a2a` | Subtle dividers |
| **border-input** | `#444` | Input borders |
| **fg-primary** | `#ccc` / `#ddd` | Main text |
| **fg-secondary** | `#aaa` / `#bbb` | Secondary text |
| **fg-muted** | `#888` | Labels, numbers |
| **fg-dim** | `#666` | Hints, column headers |
| **fg-ghost** | `#555` | Empty states, placeholders |
| **accent-amber** | `#e0a020` | Brand color — WinsLab wordmark, dirty-dot, start-time marker, waveform start marker |
| **accent-blue** | `#4a9eff` | Interactive — selected tab underline, focused input border, drop indicator, audio playhead, progress fill |
| **accent-blue-dim** | `#2a6099` | Waveform fill (unplayed) |
| **state-green** | `#2d7a2d` | GO button background |
| **state-green-hover** | `#39a039` | GO button hover |
| **state-red** | `#7a2d2d` | PANIC button background |
| **state-red-hover** | `#a03939` | PANIC button hover |
| **state-selected** | `#1e2d3d` | Selected cue row background (blue-tinted dark) |
| **state-playing** | `#1a2a1a` | Playing cue row background (green-tinted dark) |
| **state-prewait** | `#2a2a1a` | Pre-wait cue row (amber-tinted dark) |

#### Cue Color Labels
Cues can be assigned a color label: none, red, orange, yellow, green, blue, purple, pink.
These show as a 6×20px colored bar on the left of each cue row.

| Label | Hex |
|---|---|
| none | transparent |
| red | `#c0392b` |
| orange | `#e67e22` |
| yellow | `#f1c40f` |
| green | `#27ae60` |
| blue | `#2980b9` |
| purple | `#8e44ad` |
| pink | `#e91e8c` |

### Typography

The app uses **system UI fonts** only — no custom typefaces are bundled.

```
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
font-size: 13px (base)
-webkit-font-smoothing: antialiased
```

| Role | Size | Weight | Color | Notes |
|---|---|---|---|---|
| Brand / wordmark | 14px | 700 | `#e0a020` | UPPERCASE, letter-spacing 0.05em |
| Body text | 12–13px | 400 | `#bbb`–`#ddd` | Cue rows, inspector fields |
| Section labels | 10px | 600–700 | `#555`–`#666` | UPPERCASE, letter-spacing 0.06–0.08em |
| Column headers | 10px | 600 | `#666` | UPPERCASE, letter-spacing 0.06em |
| Status / tags | 10–11px | 400–600 | varies | Badges, pills |
| Monospace (times) | 11px | 400 | `#4a9eff` | Tabular nums, waveform timecodes |
| Transport buttons | 14px | 700 | white | Letter-spacing 0.05em |

**No Google Fonts or custom fonts are used.** `Segoe UI` (Windows) / `-apple-system` (macOS) are the intended targets.

### Spacing & Layout

- **Grid:** 4px base unit. Gaps of 4, 6, 8, 10, 12, 16px.
- **Toolbar height:** 44px
- **Cue row height:** 32px
- **Cue list header:** 26px
- **Waveform panel:** 110px total (24px header + canvas)
- **Transport bar:** 52px
- **Inspector width:** 320px (fixed)
- **Inspector body padding:** 12px
- **Scrollbar:** 6px wide, `#444` thumb, `#1a1a1a` track

### Borders & Radius

- **Border color:** `#333` (panel dividers), `#444` (input/button borders), `#2a2a2a` (subtle)
- **Border width:** 1px everywhere
- **Radius:** 2–5px. Inputs: 3px. Buttons: 3–4px. File menu: 5px. Color dots: 3px. Cue color bar: 2px. Running badge: 10px (pill).
- **No large or decorative radii.** Everything is tight and utilitarian.

### Backgrounds & Surfaces

- **No background images or illustrations.** Pure flat color.
- **No gradients** (except the waveform has a subtle one from played/unplayed coloring).
- **No textures.** The UI is entirely flat color blocks divided by 1px borders.
- **Panels are distinguished by subtle steps** in background darkness (111→1a1a1a→1e1e1e→252525→2a2a2a).

### Animation & Interaction

- **Transitions are fast and minimal:** 0.05–0.1s on background/color. No bounces, springs, or elaborate easing.
- **Playing cue row:** subtle `pulse` animation (background oscillates between `#1a2a1a` ↔ `#1e3a1e`), 2s ease-in-out infinite.
- **Hover states:** background lightens by one step (e.g. `#2a2a2a` → `#3a3a3a`). No scale transforms, no opacity.
- **Active/press states:** background darkens (e.g. GO button `#2d7a2d` → `#1e5a1e`).
- **Focus ring:** replaced by a blue border (`#4a9eff`) on inputs.
- **Drop indicator:** blue 2px line with a blue glow (`box-shadow: 0 0 6px rgba(74,158,255,0.6)`).
- **Drag opacity:** dragged rows fade to 35% opacity.

### Shadows & Elevation

- **Flat UI with one exception:** the file-menu dropdown has `box-shadow: 0 8px 24px rgba(0,0,0,0.5)`.
- **No inner shadows, no card shadows.** Elevation is communicated purely through background color steps.

### Cards

- Cards (MIDI message blocks, group child rows) have `background: #252525`, `border-radius: 3–4px`, no border, no shadow.

### Imagery

- **No imagery.** No photos, illustrations, or icons beyond ASCII/Unicode glyphs used as type icons.

---

## ICONOGRAPHY

### Approach
Winslab uses **no icon library** and **no icon font**. All icons are Unicode characters or ASCII symbols used inline as text:

| Cue Type | Icon char | Notes |
|---|---|---|
| audio | ♪ | Music note |
| midi | M | Letter |
| osc | O | Letter |
| wait | ⏱ | Unicode stopwatch |
| fade | ↘ | Arrow |
| stop | ■ | Filled square |
| group | ▤ | Grid symbol |
| network | ⊕ | Circled plus |
| script | `{ }` | Braces |

| Transport | Icon |
|---|---|
| GO | ▶ |
| STOP | ■ |
| PANIC | ✕ |

Other glyphs used: `▾` (dropdown arrow in brand button), `●` (dirty dot), `↻` (refresh), `✕` (remove/close).

**No SVGs, no PNGs, no icon fonts.** Iconography is entirely text-based.

---

## FILE INDEX

```
README.md                   — This file
SKILL.md                    — Agent skill definition
colors_and_type.css         — CSS custom properties for all colors + type tokens

assets/                     — No binary assets; all iconography is Unicode text

preview/                    — Design system card previews
  colors-base.html          — Base background color ramp
  colors-fg.html            — Foreground / text colors
  colors-accent.html        — Accent colors (amber, blue, states)
  colors-cue-labels.html    — Cue color label swatches
  type-scale.html           — Typography scale specimen
  type-tokens.html          — Type token reference
  spacing-tokens.html       — Spacing & layout tokens
  component-toolbar.html    — Toolbar component
  component-cuelist.html    — Cue list + cue row
  component-inspector.html  — Inspector panel tabs
  component-transport.html  — Transport bar (GO/STOP/PANIC)
  component-waveform.html   — Waveform panel
  component-buttons.html    — Button states (cue-type, transport, menu)
  component-inputs.html     — Form fields (input, select, checkbox, textarea)
  component-badges.html     — State pills, running badge

ui_kits/
  app/
    README.md               — App UI kit notes
    index.html              — Full interactive prototype
    Toolbar.jsx             — Toolbar component
    CueList.jsx             — Cue list + cue row components
    Inspector.jsx           — Inspector panel
    TransportBar.jsx        — Transport bar
    WaveformPanel.jsx       — Waveform panel
```
