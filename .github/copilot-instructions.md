# Copilot instructions — Project Greenfire

## Clarifying questions (always do this)
- If any requirement is ambiguous or could be implemented in multiple reasonable ways, ask short clarifying questions before making code changes.
- If requirements are clear, implement directly without extra questions.

## Project shape (read this first)
- Browser idle game; **ES modules loaded directly by `index.html`** (no bundler).
- Main folders:
  - `core/` runtime systems (main loop, resources, save/load, time, settings)
  - `data/` mutable game state + rule helpers (flags, objectives, jobs, unlock rules)
  - `data/definitions/` “design-time” content (actions, buildings, tech, story)
  - `sections/` DOM-driven screens; each exposes `setup<Name>Section(sectionEl)`
  - `ui/` shared UI (header/footer, panels like tooltip/popup/objectives)
- Quick mental model lives in `docs/copilot-project-notes.md`.

## Local dev workflow
- Install: `npm install`
- Run: `npm run start` (uses `http-server -c-1`) then open the printed URL.
- No automated tests are configured (`npm test` exits 1).

## Entrypoints + loops
- Boot is in `core/main.js` on `DOMContentLoaded`.
- Resource tick: `setInterval(..., 100)` in `core/main.js` applies `computeResourceRates(name)` from `core/resources.js`.
- In-game clock: `core/time.js` uses `requestAnimationFrame` and respects `window.TIME_SCALE`.
- Pause/speed are controlled by `ui/footer.js` and broadcast via `game-pause` / `game-resume` events.

## State conventions (important)
- Many modules export **live mutable arrays/objects** (e.g., `resources`, `buildings`, `gameFlags`, `storyLog`, `allActions`).
- Prefer **mutating in place** (e.g., `array.length = 0; array.push(...)`) rather than reassigning exports.
- If you add new mutable fields that must persist, ensure they’re included in `core/saveload.js`.

## UI “New” badges (“!”)
- Any newly unlocked button/tech/building/action should show a `!` badge until the player notices it.
- Pattern: set `uiNew = true` on the underlying object when it becomes available.
  - Buildings: `building.uiNew = true`
  - Crash Site actions/upgrades: `action.uiNew = true`
  - Technologies: `tech.uiNew = true`
- Rendering/clearing is centralized via `ui/components/uiNew.js` (clears on hover/focus/touch and persists quietly).
- Also consider the main menu `!` badge:
  - `core/main.js` has a lightweight poller that sets section menu badges when there is any unseen `uiNew` content.
  - When adding a new kind of section-specific unlock (non-building/non-tech), ensure the poller covers it or explicitly set the section’s menu badge.

## Save/load + compatibility
- Primary save blob: `localStorage.gameState` (see `core/saveload.js`).
- Loader merges saved state into defaults for forward compatibility; when renaming concepts add a small migration (example: “Scrap Metal” → “Metal Parts” in `core/saveload.js`).
- Actions are definitions with **runtime fields**; only a whitelist is restored:
  - See `RUNTIME_ACTION_KEYS` in `core/saveload.js`. If you introduce a new runtime key (e.g., `completedAt`), add it there.
- Action aggregator `data/definitions/allActions.js` keeps a stable array reference; call `refreshAllActions()` after resets/loads.

## Actions system (Crash Site)
- Definitions: `data/definitions/actions.js` + `data/definitions/upgrades.js`.
- Stage-specific overrides are applied via helpers in `data/actionsManager.js` (e.g., `tooltipDataForAction`, `getCurrentStage`).
- Only one crash-site action runs at a time (`data/activeActions.js`).
- **Drain is applied by the main resource loop** (via `computeResourceRates()`); the crash-site loop in `sections/crashSite.js` mainly handles progress/UX.
- Completion side-effects (unlocks/flags) live in `data/gameFlags.js` via `registerActionCompletionHandler`.

## Adding content (follow existing patterns)
- New resource: extend `getInitialResources()` in `core/resources.js`.
- New building: add to `data/definitions/buildings.js` and ensure its `effect`/`effects` are handled (storage/job/passive).
- New crash-site action/upgrade: add to definitions; use `stages[].unlocks` + a completion handler in `data/gameFlags.js` for side effects.
- New section: add `sections/<name>.js` with `setup<Name>Section`; wire the section element + menu ID in `core/main.js`, and add the module tag in `index.html` (or use dynamic import like Journal does).
