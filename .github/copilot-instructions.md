# Copilot instructions — Project Greenfire

## Current focus: phone landscape UX (important)
- We are actively optimizing the UI for phone gameplay in landscape.
- Primary test target: iPhone 12 Pro emulation at 844 x 390 (Chrome device mode).
- Keep desktop/PC behavior and layout unchanged; scope mobile changes behind responsive CSS (media queries) and minimal, additive JS.
- Prefer incremental, top-to-bottom improvements (Header → main layout → panels → footer).

## Compact mode (critical: cross-device consistency)
- Compact phone-landscape UI is driven by a centralized detector in `ui/compactMode.js`.
  - It toggles root classes on `<html>`, especially `html.is-compact`.
  - `html.is-compact` is the *source of truth* for “phone landscape” layout because some devices/PWA contexts report desktop-ish viewports where legacy `max-width` queries fail.
- Styling strategy:
  - Put forced compact overrides in `styles/base/compact-mode.css` under `html.is-compact ...`.
  - If you add/modify any phone-landscape `@media` rules, **mirror them under `html.is-compact`** (or refactor so `html.is-compact` is the only gate).
  - Avoid using only `max-width` breakpoints to define “mobile”; wide phones in landscape (e.g. ~915px) may miss them.

### Tooltips on mobile (docked)
- In compact mode, tooltips are docked bottom-right (above footer, offset left of the right info panel) to avoid obstructing gameplay.
  - Logic: `ui/panels/tooltip.js` (adds `.tooltip-docked`, computes right offset from `#infoPanel`).
  - Styling: `styles/base/compact-mode.css` (rules for `.tooltip.tooltip-docked`, including scrollbar styling).
- When touching tooltip placement, ensure resets/reloads don’t push the dock off-screen (layout can be transient right after reset).

## Clarifying questions (always do this)
- If any requirement is ambiguous or could be implemented in multiple reasonable ways, ask short clarifying questions before making code changes.
- Alwazs ask for clarification if you’re unsure about the intent of a requirement or how to prioritize it against other work.

## Keep changes lean (important)
- Prefer the smallest change that solves the root cause.
- When a fix supersedes an older attempt, **remove the old/unused code** (don’t leave dead helpers, stale branches, or duplicate pathways).
- Avoid adding one-off special cases if there’s an existing mechanism that can be extended cleanly.
- If a large file is touched (e.g., `sections/crashSite.js`), do a quick pass for obvious unused imports/helpers introduced by the change.

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

## Agent workflow (important)
- Do NOT start the local dev server (e.g., don’t run `npm run start` / `http-server`). The user runs the game and verifies changes manually.

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
