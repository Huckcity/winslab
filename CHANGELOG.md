## [0.4.1](https://github.com/Huckcity/winslab/compare/v0.4.0...v0.4.1) (2026-07-11)


### Bug Fixes

* **inspector:** Fade cue properties Target dropdown overflow ([#15](https://github.com/Huckcity/winslab/issues/15)) ([#16](https://github.com/Huckcity/winslab/issues/16)) ([8cdbe21](https://github.com/Huckcity/winslab/commit/8cdbe21ffbaaa42a564ad3be32397271cab593bf))

# [0.4.0](https://github.com/Huckcity/winslab/compare/v0.3.0...v0.4.0) (2026-05-03)


### Bug Fixes

* post-wait runs once per cue, not twice when advance=on-end ([7721fd7](https://github.com/Huckcity/winslab/commit/7721fd7233b859d9f1b81fbbec3a7fbf0d1acced))
* seek detects playing state via audioPlayer.isPlaying, not just timers ([4218e1b](https://github.com/Huckcity/winslab/commit/4218e1be163439ee8d23f6133933992bf47fdaae))
* timeline seek correctly resumes in-progress audio/wait cues ([df93328](https://github.com/Huckcity/winslab/commit/df93328c6da036ea1b07c9035c03b56f350020d1))


### Features

* clear seek offset when navigating away from a timeline group ([f0db90a](https://github.com/Huckcity/winslab/commit/f0db90a4dfe2ea28396e130321848f2dd6c492cd))
* functional timeline seek — ruler click jumps playback position ([f98bfcc](https://github.com/Huckcity/winslab/commit/f98bfcc61975c848af2c14ca5dafa6a4b44ffd6c))

# [0.3.0](https://github.com/Huckcity/winslab/compare/v0.2.0...v0.3.0) (2026-05-03)


### Bug Fixes

* require Cmd+Backspace to delete a cue (plain Backspace no longer deletes) ([843a0b2](https://github.com/Huckcity/winslab/commit/843a0b2311e7e261f35aab0246fe89059750c1c2))


### Features

* add right-click context menu on cue rows ([acf12be](https://github.com/Huckcity/winslab/commit/acf12be630a35fbc60c989c7deedbe000b8d7e3b))
* add undo/redo for cue editing (Cmd+Z / Cmd+Shift+Z) ([334ce04](https://github.com/Huckcity/winslab/commit/334ce04b0c8e641f642e995b41716e0f97af1cd6))

# [0.2.0](https://github.com/Huckcity/winslab/compare/v0.1.1...v0.2.0) (2026-05-03)


### Bug Fixes

* **e2e:** resolve strict mode violations in settings tests ([945dceb](https://github.com/Huckcity/winslab/commit/945dceb11de65df7359c37cef424d80031e51eb2))
* range slider track padding and focus blocking transport shortcuts ([1803669](https://github.com/Huckcity/winslab/commit/18036697b085d71fd99ba8c8e36fa016fc67b654))


### Features

* real-time vol/pan updates and pan fade support ([bbe4d38](https://github.com/Huckcity/winslab/commit/bbe4d3827733cd803598d78138549b1fcfb3823f))
* settings dialog with audio output device and MIDI port config ([6c15a07](https://github.com/Huckcity/winslab/commit/6c15a07ef4f9c47020b374cec1aa55dd5db28403))
