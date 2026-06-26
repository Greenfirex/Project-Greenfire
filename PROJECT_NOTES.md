# Project Greenfire — Developer Notes

## Time System

- **1 real second = 1 in-game minute** (see `engine/time.js`)
- Time advances only during actions, not passively
- `TICK_SECONDS = 0.1` in the action timer

## Časová smyčka — narativní uvědomování

Hráč si **není hned jistý**, že je v časové smyčce. Uvědomění přichází postupně:

| Loop | Název smrti | Psychologie hráče | Jak se to propisuje do akcí |
|---|---|---|---|
| **1** | — (první život) | Plné uvědomění, vše je nové | Objevuje, tápe, učí se |
| **2** | „Jen zlý sen" | Nejsilnější pochyby — byl to sen? | Pamatuje si věci, ale nedůvěřuje tomu. Texty: „Možná se ti to zdálo...", „Byl to vůbec sen?" |
| **3** | „Déjà Vu" | Silné podezření — něco je špatně | Začíná věřit svým vzpomínkám. Texty: „Už se nedivíš...", „To nemůže být náhoda." |
| **4+** | „Smyčka" | Jistota — toto se opakuje | Plná důvěra ve znalosti, racionální jednání. Texty: „Už víš.", rutina. |

**Důsledek pro design:**
- Loop 2 → `getResultKey`/`onComplete` texty by měly reflektovat pochyby („asi", „možná", „zdálo se ti")
- Loop 3 → přechod k jistotě („To není náhoda.", „Už víš.")
- Loop 4+ → rutina, žádné pochyby
- `loopCount` (z `ctx.gameFlags`) určuje, ve kterém loopu se hráč nachází
- Loop-aware texty už existují např. v `wake_up` (`result_wake_up_loop1`, `result_wake_up_loop2`, `result_wake_up_loop3`) a `check_terminal` — používej stejný pattern

## Memory vs Time-Reset — dvě kategorie stavu

| Kategorie | Kde | Přežije smrt | Význam | Příklady |
|---|---|---|---|---|
| **Memory** | `loopKnowledge.milestones` | ✅ Ano | Co hráč **VÍ** — znalosti, vzpomínky, objevy | `comms_diagnosed`, `book_read`, `login_note_found`, `gamma_coordinates_known` |
| **Time-Reset** | `gameFlags.X` | ❌ Ne | Co se **STALO** v aktuálním loopu — fyzické stavy | `reactorOptimized`, `recyclerFixed`, `commsInstalled`, `distressSignalSent` |

### Pravidlo
- **Zavzpomínal sis / zjistil jsi něco** → `setMilestone()` → v `loopKnowledge`
- **Fyzicky jsi něco nainstalovat / opravil / odeslal** → `ctx.gameFlags.X = true` → resetuje se při smrti

**Nikdy nepoužívej `hasMilestone()` pro řízení viditelnosti akcí, které závisí na fyzickém stavu v aktuálním loopu.**

### Implementace v `engine/gameFlags.js`

Flagy jsou rozděleny do dvou objektů:

```js
const INITIAL_PERSISTENT_FLAGS = {
    firstObjectiveComplete, loopCount, persistentProgress,
    loopStoryShown, uiSeen, loopKnowledge
};

const INITIAL_PER_LOOP_FLAGS = {
    recyclerFixed, reactorOptimized, recyclerAttempted,
    commsInstalled, distressSignalSent
};
```

`applySavedGameFlags()` obnovuje **pouze** persistent flagy — prochází `Object.keys(INITIAL_PERSISTENT_FLAGS)`. Per-loop flagy zůstanou vždy na výchozí hodnotě.

**Když přidáváš nový flag:**
- Resetuje se smrtí? → do `INITIAL_PER_LOOP_FLAGS`. Hotovo.
- Přežije smrt? → do `INITIAL_PERSISTENT_FLAGS`. Hotovo.

Žádné whitelisty, žádný manuální reset kód. Nic jiného neměň.

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

## MCP Server (`mcp-server/`)

Cline MCP server pro automatickou validaci projektu. Poskytuje 4 nástroje.

### Nástroje

| Nástroj | Popis |
|---|---|
| `validate_locales` | Porovná `cs/ui.json` ↔ `en/ui.json` a embedovanou EN v `locales.js`. Najde chybějící klíče a prázdné hodnoty. |
| `validate_actions` | Zkontroluje definice akcí — povinná pole, podezřelé `durationSeconds`, chybějící locale klíče. |
| `find_hardcoded` | Najde hardcodované anglické stringy v JS/HTML, které by měly používat `t()`. |
| `check_engine` | Ověří, že `locationEngine.js` neobsahuje zakázané `if (action.id === ...)`. |

### Setup na novém stroji

```bash
cd mcp-server
npm install
```

Pak v Cline MCP settings (`cline_mcp_settings.json`) přidat:

```json
{
  "mcpServers": {
    "project-greenfire": {
      "command": "node",
      "args": ["<cesta_k_projektu>\\mcp-server\\index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Sync embedované EN dictionary

Embedovaná EN dictionary v `locales.js` (řádky `loaded['en'] = {...}`) se musí ručně synchornizovat s `locales/en/ui.json`. K tomu slouží:

```bash
node mcp-server/sync_embed.js
```

Tento skript přepíše celou embedovanou dictionary podle aktuálního `en/ui.json`.

### `.gitignore`

`mcp-server/node_modules/` je v `.gitignore` — po `git clone` je potřeba `npm install`.
