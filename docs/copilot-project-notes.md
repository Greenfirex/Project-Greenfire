# Project Greenfire — Copilot Notes (Handoff)

Last updated: 2026-01-12

These notes summarize how the project is structured and how the main gameplay loops and persistence work. The goal is to preserve a working mental model if chat history is lost.

## Quick start (local)

- Install deps: `npm install`
- Run a local static server: `npm run start`
  - Uses `http-server -c-1` (no caching). Open the URL it prints (typically `http://127.0.0.1:8080`).

Hosted build referenced in README: https://greenfirex.github.io/Project-Greenfire/

## High-level architecture

This is a browser-based idle game using ES modules loaded directly by `index.html`.

- `core/`: game runtime systems (main loop, resources, save/load, time, settings, formatting, log)
- `data/`: game state + rules + definitions (actions/buildings/jobs/tech/story, morale, objectives, flags)
- `sections/`: “screens” (crash site, colony, research, etc.) that build/update DOM
- `ui/`: header/footer + panels (tooltip/popup/changelog/objectives), small UI components
- `styles/`: CSS

## Entrypoint + boot flow

`index.html` loads many modules directly. The primary bootstrap is `core/main.js`:

- On `DOMContentLoaded`: hide preloader, call `startGame()`.
- On `beforeunload`: `saveGameState()`.
- `startGame()`:
  - Initializes options + tooltips.
  - Initializes time manager in “load-only” mode (so clock doesn’t tick before save is applied).
  - Applies saved UI glow settings.
  - Loads save (unless a reset is in progress).
  - Creates DOM section containers and calls each section’s `setup...Section()`.
  - Builds the left menu buttons and restores the current section.
  - Starts:
    - main loop (resource ticking + UI refresh) at 100ms
    - autosave every 30s
  - Handles `visibilitychange` depending on the “run in background” option.

### Sections + navigation

- Menu buttons are generated in `core/main.js` from a fixed list of section IDs.
- Visibility is controlled by `activatedSections` (persisted in localStorage and in the main save).
- `showSection(sectionId)` hides all `.game-section` elements and shows the chosen one.

## Core loops

### Main resource loop (`core/main.js`)

Every 100ms:

- Computes per-resource net rate via `computeResourceRates(resourceName)` from `core/resources.js`.
- Applies `netPerSecond * deltaTime` to each resource (clamped to [0, capacity]).
- Updates UI:
  - `updateResourceInfo()`
  - survival debuff badge
  - crew section UI
  - condition checks/unlocks
  - button state updates (crash site actions, buildings, tech)
- Dispatches `resources-updated` event (best-effort).
- Throttles objective recompute to once/second.

### In-game time (`core/time.js`)

- Stored as `ingameTimeMinutes` in localStorage.
- Advances using `requestAnimationFrame` and real delta.
- Mapping: `totalIngameMinutes += realSeconds * 5 * TIME_SCALE`.
- Listens to `game-pause` / `game-resume` events.

### Pause/speed (`ui/footer.js`)

- Pause stops the main loop via callbacks registered from `core/main.js`.
- Speed changes set `window.TIME_SCALE` and persist to `gameTimeScale`.

## Actions system (Crash Site)

### Definitions

- Action definitions live in `data/definitions/actions.js` (salvage) and `data/definitions/upgrades.js`.
- There is an aggregator `data/definitions/allActions.js` which exports “all actions” for UI.
- Actions can have `stages[]` that unlock follow-up actions or show story events.

### Runtime state

- Only ONE crash-site action can be active at a time.
- Active action runtime lives in `data/activeActions.js` (`activeActionsState.crashSite`).
- When an action starts, `sections/crashSite.js` takes a snapshot and overlays stage-specific fields.

### Progress + drain model

- `sections/crashSite.js` runs a 100ms progress loop for the active action.
- The crash-site loop DOES NOT apply drain; drain is applied by the main resource loop via `computeResourceRates()`.
- Crash-site progress loop only cancels if a drained resource hits 0.

### Completion

On completion (`handleActionCompletion`):

- Applies rewards (with optional chance, upgrade multipliers, and debug multiplier).
- Advances stage; may mark the action locked unless repeatable.
- Runs completion handlers from `data/gameFlags.js` (these mutate flags and may unlock jobs/buildings/upgrades/sections).
- Recomputes narrative objectives and includes objective changes in popup payload.
- Optionally shows story popup with an “outcome payload” listing rewards/unlocks/objectives.

## Persistence (save/load)

### Local saves

- Main save blob is JSON stored in localStorage under `gameState`.
- Autosave: every 30 seconds.
- Manual save: header “Save” link.

### Save contents (`core/saveload.js`)

Saved game state includes (at least):

- resources
- technologies
- jobs
- buildings
- salvageActions + upgradeActions (runtime fields only are merged back into definitions)
- activatedSections
- gameFlags
- storyLog
- ingameTimeMinutes
- timeScale + paused
- activeCrashSiteAction
- moraleModifiers
- encrypted drive tasks
- objectivesStatus

Apply uses a “merge with defaults” strategy for resources and buildings to preserve forward compatibility.

### Export/import

- Export puts an encrypted blob into the clipboard.
- Format: `ENC2:` + base64(iv + cipher)
- Encryption: AES-GCM with an embedded 256-bit key constant in `core/saveload.js`.
- Import auto-detects `ENC2:` and decrypts; legacy path treats input as base64-encoded JSON.
- After import, the page reloads to ensure all UI is rebuilt against the imported state.

## Where to add things (quick guide)

- New resource: `core/resources.js` (`getInitialResources`) + any producers/consumers + UI/tooltips are auto-driven.
- New building: `data/definitions/buildings.js` + ensure the relevant section creates buttons + ensure effects (storage/job/passive) are handled.
- New crash-site action: `data/definitions/actions.js` + ensure any special behavior is in `data/gameFlags.js` completion handlers or unlock rules.
- New research tech: `data/definitions/technologies.js` (and ensure costs/prereqs).
- New section/screen: create `sections/<name>.js` with `setup<Name>Section`, then wire it into `core/main.js` menu list and `index.html` script tags.

## Notable conventions / gotchas

- Most "state" is module-level arrays/objects that are mutated in place and saved as JSON.
- Some systems depend on globals for convenience:
  - `window.TIME_SCALE`
  - `window.DEBUG_RESOURCE_GAIN`
  - `window.enableSection`, etc. are exported by `core/main.js`.
- The project is DOM-driven; sections often rebuild DOM trees in `setup...Section()`.

---

If you want: next good step is to write a short CONTRIBUTING-style doc (how to add an action/building/tech) and/or add a simple “dev checklist” for safe changes (save schema, forward-compat merging, etc.).
