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

## Key Files

| File | Purpose |
|------|---------|
| `engine/resources.js` | Resource state, info panel, passive drain, `computeResourceRates()` |
| `engine/time.js` | In-game clock (1 real sec = 1 in-game min) |
| `sections/locations/locationEngine.js` | Action start/resume/complete/detail rendering |
| `sections/locations/definitions/` | Location and action data definitions |