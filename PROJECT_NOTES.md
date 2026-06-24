# Project Greenfire — Developer Notes

## Time System

- **1 real second = 1 in-game minute** (see `engine/time.js`)
- Time advances only during actions, not passively
- `TICK_SECONDS = 0.1` in the action timer

## Resource Drain/Gain Rates

- `DEFAULT_DRAIN` rates are **per real second** (e.g., `Stamina: 0.20` means 0.20 drained per real second)
- Displayed as "X/min" in UI but applied as `rate × realSeconds` each tick
- The `perMinRate` variable name is misleading — it's actually a per-second rate

### Reward-to-rate formula
```
rate = rewardAmount / durationSeconds
```
Example: Rest gives 5 Stamina over 15s → rate = 5/15 = 0.33/sec (displayed as +0.33/min)

### Action categories affecting drain
- `simple`: all resources drain at DEFAULT_DRAIN rates
- `taxing`: Stamina drains at 2× (TAXING_MULT)
- `rest`: Stamina **gains** (positive rate from rewards), Food/Water drain normally
- `refresh`: Drinking Water **gains** (positive rate from rewards), Stamina/Food drain normally

## Action Callback System (refactored Jun 2026)

**DO NOT add `if (action.id === 'xyz')` blocks to `locationEngine.js`.**

Instead, action-specific logic lives **in the action definition** via three optional callbacks:

| Callback | When it runs | Return value |
|---|---|---|
| `onStart(ctx)` | Early in `startAction()`, before `requiresItem` check | `{ block: true }` to stop the action |
| `getResultKey(ctx)` | When setting `activeAction._resultKey` | A locale key string or `null` |
| `onComplete(ctx)` | In `completeActiveAction()`, after unlockAll/repeatLimit, before areaResourceDrain | Nothing |

### Where to add new action logic

Go to `sections/locations/definitions/scoutShip/<location>.js` and add callbacks directly to the action object:

```js
{
  id: 'new_action',
  nameKey: 'action_new_action',
  // ...
  onStart(ctx) {
    // gate logic — return { block: true } to prevent starting
  },
  getResultKey(ctx) {
    // return dynamic locale key for completion message (or null)
    return someCondition ? 'result_variant_a' : 'result_variant_b';
  },
  onComplete(ctx) {
    // side effects after completion (flags, unlocks, UI rebuilds)
  }
}
```

**No changes to `locationEngine.js` are needed** when adding new actions with custom logic.

### Context object (ctx) fields

All engine dependencies are passed via `ctx` so definition files don't need imports:

| Field | Type | Usage |
|---|---|---|
| `ctx.gameFlags` | gameFlags ref | Read/write flags, loopKnowledge |
| `ctx.action` | action object | Reference to the action being started/completed |
| `ctx.addLogEntry` | function | Log to ingame log: `ctx.addLogEntry(msg, type)` |
| `ctx.LogType` | enum | `INFO`, `SUCCESS`, `ERROR`, `STORY`, `ACTION`, `UNLOCK` |
| `ctx.t` | function | Locale translation: `ctx.t('key', { params })` |
| `ctx.areaResources` | object | Area resources by location ID |
| `ctx.getLocation(id)` | function | Get location definition |
| `ctx.getCurrentLocationId()` | function | Current location ID |
| `ctx.getUnlockState(id)` | function | Get unlock state for location |
| `ctx.setUnlockState(id, state)` | function | Save unlock state to localStorage |
| `ctx.flagActionAsNew(id)` | function | Mark action as "new" (show badge) |
| `ctx.initAreaResources(id)` | function | Initialize area resources for location |
| `ctx.revealAreaResources(id)` | function | Reveal area resources in UI |
| `ctx.showAreaSuppliesPanel()` | function | Show area supplies panel |
| `ctx.refreshUI()` | function | Force UI rebuild |
| `ctx.setFullRebuildNeeded(v)` | function | Set `_fullRebuildNeeded` flag |

### Helper: persistLoopKnowledge(ctx)

A helper function defined in each definition file that persists `loopKnowledge` to localStorage:

```js
function persistLoopKnowledge(ctx) {
    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
        state.gameFlags.loopKnowledge = { ...ctx.gameFlags.loopKnowledge };
        localStorage.setItem('gameState', JSON.stringify(state));
    } catch { /* ignore */ }
}
```

Call this after modifying `ctx.gameFlags.loopKnowledge` fields that should survive death loops.

### Current callback distribution

| Action | File | `onStart` | `getResultKey` | `onComplete` |
|---|---|---|---|---|
| `wake_up` | `scoutShipCrewQuarters.js` | — | ✅ | ✅ (fuel/O2 reveal, loop 2+) |
| `check_terminal` | `scoutShipCrewQuarters.js` | — | ✅ | ✅ (unlockState) |
| `hack_terminal` | `scoutShipCrewQuarters.js` | — | — | ✅ (terminalLogin, unlocks, mutual exclusion) |
| `use_terminal_login` | `scoutShipCrewQuarters.js` | — | — | ✅ (same as hack_terminal) |
| `read_book` | `scoutShipCrewQuarters.js` | — | — | ✅ (bookRead = true) |
| `check_reactor_status` | `bridge.js` | — | ✅ (null) | ✅ (fuel scan, resultKey in log) |
| `repair_recycler` | `mainArea.js` | ✅ (gate + log) | ✅ | ✅ (recyclerFixed, repairCount) |

## Locations Module Structure

| File | Purpose |
|------|---------|
| `sections/locations/locationEngine.js` | Core engine — action state, start/complete/cancel logic, save/load helpers, unlock/POI state persistence. Generic; no action-specific logic. |
| `sections/locations/locationUi.js` | UI rendering & event wiring — tile/card/button HTML generation, POI grouping, debuff tooltips, action button handlers. ~595 lines |
| `sections/locations/locationData.js` | Location registry, `switchToLocation()`, `getCurrentLocationId()` |
| `sections/locations/definitions/` | Location and action data definitions **including callback logic** |

### Why the split?
`locationEngine.js` grew to 1418 lines mixing three concerns:
1. **UI rendering** (HTML generation, event binding) → `locationUi.js`
2. **Core logic** (action timing, drain rates, completion handlers) → stayed in `locationEngine.js`
3. **State persistence** (unlockState, poiCollapse localStorage helpers) → kept in engine (small, tightly coupled)
4. **Action-specific handlers** → moved to action definitions in Jun 2026 (callback system)

`locationUi.js` imports mutable state and setter functions from `locationEngine.js`, while `locationEngine.js` imports `refreshUI()` and `updateActionButtonsDynamic()` from `locationUi.js`. The circular ES module dependency is safe because all imports are used inside functions (not at module eval time).

### Removed dead code
- `renderActionsTile()` legacy branch (all locations now have POIs)
- `drainCostHtml()` — unused helper, cost rendering is inline

## Key Files

| File | Purpose |
|------|---------|
| `engine/resources.js` | Resource state, info panel, passive drain, `computeResourceRates()` |
| `engine/time.js` | In-game clock (1 real sec = 1 in-game min) |
| `engine/gameFlags.js` | Game flags including per-loop `recyclerFixed` and persistent `loopKnowledge` |
| `engine/effects.js` | Active effects system (hungry, thirsty, exhausted, etc.) |
| `locales/cs/ui.json` | Czech locale — all action names, descriptions, results, log messages |
| `locales/en/ui.json` | English locale — mirror of CS file |
| `sections/character/items.js` | Item definitions (equipment, consumables, quest items) |

## Area Resources

| Location | Resources | Init | Reveal |
|---|---|---|---|
| `scout_ship_main_area` | `area_water` (15, cap 99) | `assess_supplies` | `assess_supplies` |
| `scout_ship_bridge` | `area_fuel` (300, cap 600), `area_o2` (200, cap 200) | `wake_up` (loop 2+) | `wake_up` (loop 2+) |