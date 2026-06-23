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

## Locations Module Structure

| File | Purpose |
|------|---------|
| `sections/locations/locationEngine.js` | Core engine — action state, start/complete/cancel logic, save/load helpers, unlock/POI state persistence. ~825 lines |
| `sections/locations/locationUi.js` | UI rendering & event wiring — tile/card/button HTML generation, POI grouping, debuff tooltips, action button handlers. ~595 lines |
| `sections/locations/locationData.js` | Location registry, `switchToLocation()`, `getCurrentLocationId()` |
| `sections/locations/definitions/` | Location and action data definitions (bridge, workshop, crewQuarters, mainArea, gammaSite/...) |

### Why the split?
`locationEngine.js` grew to 1418 lines mixing three concerns:
1. **UI rendering** (HTML generation, event binding) → `locationUi.js`
2. **Core logic** (action timing, drain rates, completion handlers) → stayed in `locationEngine.js`
3. **State persistence** (unlockState, poiCollapse localStorage helpers) → kept in engine (small, tightly coupled)

`locationUi.js` imports mutable state and setter functions from `locationEngine.js`, while `locationEngine.js` imports `refreshUI()` and `updateActionButtonsDynamic()` from `locationUi.js`. The circular ES module dependency is safe because all imports are used inside functions (not at module eval time).

### Removed dead code
- `renderActionsTile()` legacy branch (all locations now have POIs)
- `drainCostHtml()` — unused helper, cost rendering is inline

## Key Files

| File | Purpose |
|------|---------|
| `engine/resources.js` | Resource state, info panel, passive drain, `computeResourceRates()` |
| `engine/time.js` | In-game clock (1 real sec = 1 in-game min) |
