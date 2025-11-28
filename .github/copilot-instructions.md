# Copilot Instructions: Project Greenfire

Purpose: Single-page, data-driven survival/idle game. All logic runs fully client-side in the browser using ES modules (no build step aside from optionally running `npm start` which launches `http-server`).

## Architecture Overview
- Entry point: `index.html` loads many ES modules directly; order matters only for side-effect modules (e.g. `main.js` initializes game sections after DOMContentLoaded).
- Core game loop: `main.js` sets an interval (100ms) applying resource rate deltas via `computeResourceRates` from `resources.js`, plus an rAF-driven ingame time loop in `time.js` (separate pause handling).
- State containers follow a pattern: each data domain file exports (1) an initial factory (e.g. `getInitialResources()`), (2) a mutable live array/object (e.g. `resources`), and (3) reset / smart-load helpers in `saveload.js`.
- Save/Load: `saveload.js` serializes a composed state (resources, buildings, technologies, jobs, actions, flags, storyLog, time, UI state) into localStorage. Loading smart-merges into fresh defaults to protect forward compatibility. Uses AES-GCM for clipboard export; prefix `ENC2:`.
- Sections/UI: Each gameplay area is a dynamically created `<div class="game-section">` managed in `main.js`. Individual section modules (`sections/*.js`) expose `setupXSection` functions which render their DOM each time they are called (idempotent). `showSection` swaps visibility and can lazy-import journal.
- Activation gating: `activatedSections` object in `main.js` stores which sections are visible; persisted and mutated via `setActivatedSections()` and `enableSection()`.
- Data-driven actions: Crash site & progression actions defined in `data/actions.js` (and `data/allActions.js`). Each action includes id, drain array, optional cost, reward, stages unlocking other actions. Active action drain distribution uses duration and debuff calculation.
- Resource simulation: `resources.js` provides `computeResourceRates(name)` combining building outputs, job rates (`jobs.js`), technologies bonuses, action drains, passive survivor consumption. Net value applied in main loop. Tooltip pattern: call `setupTooltip(el, () => dynamicData)`.
- Buildings pattern: `data/buildings.js` (not read here but referenced) defines buildings with count, cost, effect. `colony.js` computes dynamic cost escalation via `costMultiplier` and presents build buttons with affordability classes.
- Event/flags: `data/gameFlags.js` holds booleans controlling one-off unlocks; manipulated directly and persisted via save.
- Objectives & Journal: Journal entries maintained by `storyLog` in `sections/journal.js`; objectives recomputed via `recomputeObjectives()` throttled in main loop.
- Time: `time.js` keeps logical minutes independent of main loop; responds to custom events `game-pause` / `game-resume`.

## Conventions & Patterns
- Mutable singletons: Arrays like `resources`, `buildings`, `technologies`, `jobs`, `storyLog` are mutated in place; do NOT replace references—other modules import them directly.
- Smart loading: When applying a save, always start from fresh defaults then merge per-entry by matching `name` or `id`. Preserves new properties added later.
- Unlock flows: Actions specify `stages[]` with `unlocks` listing other action ids; building first-build side effects also unlock upgrades or sections. Log unlocks using `addLogEntry(..., LogType.UNLOCK)`.
- Logging: Use `addLogEntry(message, LogType.<TYPE>, optionalMeta)`; story entries often include onClick handlers opening a popup (`showStoryPopup`). Keep unlock/important messages concise.
- Tooltip data provider: Pass a function returning a plain object snapshot; dynamic cost/rate calculations performed inside (e.g. building cost escalation, resource rate breakdown).
- Pausing: Check `localStorage.getItem('gamePaused') === 'true'` before executing manual or time-dependent actions (see `buildBuilding`, `mineCrystal`). Respect pause by halting intervals and rAF in `main.js` and `time.js`.
- Resource discovery: Setting `resource.isDiscovered = true` triggers UI reveal and may unlock dependent buildings/actions. Dispatches `resourceDiscovered` event via `window.dispatchEvent`.
- Performance throttling: Certain UI recomputations (e.g. `updateBuildingButtonsState`) debounce via short timeout; avoid adding heavy logic in every 100ms loop tick.
- DOM regeneration: Section setup functions fully rewrite container innerHTML; add new controls by editing the setup function rather than incremental patched DOM elsewhere.

## External Dependencies & Runtime
- Only external runtime library: `marked` (loaded via CDN) for markdown rendering in story popups (if used). `http-server` dev dependency used for local hosting. No bundler or transpilation.
- Start locally: `npm install` then `npm start` (opens static server). Alternatively open `index.html` directly (clipboard crypto requires secure context in some browsers).

## Common Extension Points
- Adding a Resource: Define in `getInitialResources()`, include capacity, flags (producible/integer/hidden). Update any building/job/technology referencing it. Ensure discovery logic either passive (amount>0) or explicit.
- Adding an Action: Extend array in `data/actions.js` (match existing shape). Provide `drain` values splitting consumption across duration; stage unlocks link by id.
- Adding a Building: Define in `data/buildings.js` with `cost`, `costMultiplier`, `effect` (storage/job/passive). UI auto-includes if section logic queries it; ensure `isUnlocked` gating logic triggers (often via resource discovery or action stage).
- Adding a Technology: Add to `data/technologies.js` with `bonus` multiplier or unlock flags; ensure research section displays it and `computeResourceRates` accounts for bonuses by resource name.
- Save Compatibility: When removing fields, guard merge (example: action `salvageCookingEquipment` cost removed with protective copy logic in `applyGameState`). Follow that pattern for future breaking changes.

## Example: Dynamic Building Cost
```
const currentCost = getCurrentBuildingCost(building);
currentCost.forEach(c => { /* check resources[c.resource] >= c.amount */ });
```
Escalation formula: `NewCost = BaseCost * (Multiplier ^ count)`.

## Example: Resource Rate Tooltip Provider
```
setupTooltip(rowEl, () => {
  const rates = computeResourceRates(resourceName);
  return { base: rates.base, jobContribution: rates.jobContribution, net: rates.netPerSecond };
});
```

## Cautions
- Never replace exported arrays; mutate in place so other imports stay live.
- Avoid long blocking computations in 100ms interval or rAF time loop.
- Always debounce or batch UI updates when iterating many DOM nodes.
- Keep localStorage writes minimal (already throttled for time and autosave).

## Open Questions for Maintainers
- Formal testing framework absent (`npm test` placeholder). Consider documenting manual test flows for critical save/load and unlock chains.
- Any planned migration to module bundler or build pipeline?

Please review and provide feedback on unclear sections or missing conventions specific to upcoming features.