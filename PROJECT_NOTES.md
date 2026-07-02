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

## Action Declaration System (refactored Jul 2026)

**DO NOT add `if (action.id === 'xyz')` blocks to `locationEngine.js`.**

Action-specific logic lives **in the action definition** via callbacks + declarative fields:

### Callbacks

| Callback | When it runs | Return value |
|---|---|---|
| `onStart(ctx)` | Early in `startAction()`, before `requiresItem` check | `{ block: true }` to stop the action |
| `getResultKey(ctx)` | When setting `activeAction._resultKey` (legacy) | A locale key string or `null` |
| `onComplete(ctx)` | In `completeActiveAction()`, all loops | Nothing |
| `onCompleteLoop1(ctx)` | Loop 1+ (první smrt — pochyby) | Nothing |
| `onCompleteLoop2(ctx)` | Loop 2+ (jistota smyčky — zkratky) | Nothing |
| `onCompleteLoop3(ctx)` | Loop 3+ (maximum awareness) | Nothing |

### Deklarativní fieldy (PREFEROVANÉ pro unlocks/hides)

| Field | Typ | Co dělá |
|---|---|---|
| `results` | `{ default, loop1, loop2, loop3 }` | Loop-aware result key — nahrazuje `getResultKey` |
| `unlocks` | `string[]` | `flagActionAsNew()` — odemkne akce (všechny loopy) |
| `unlocksLoop2` | `string[]` | `flagActionAsNew()` — jen loop 2+ |
| `unlocksLoop3` | `string[]` | `flagActionAsNew()` — jen loop 3+ |
| `hides` | `string[]` | `_completed = true` — skryje akce v aktuální lokaci (všechny loopy) |
| `hidesLoop2` | `string[]` | `_completed = true` — jen loop 2+ |
| `hidesLoop3` | `string[]` | `_completed = true` — jen loop 3+ |

### Vzorová akce (nový formát)

```js
{
  id: 'new_action',
  nameKey: 'action_new_action',
  descKey: 'action_new_action_desc',
  drain: [{ resource: 'Stamina', amount: 3 }],
  durationSeconds: 15,
  oneTime: true,

  // === VIDITELNOST ===
  isAvailable(ctx) {
    return !!ctx.getUnlockState(ctx.getCurrentLocationId())['wake_up'];
  },

  // === LOOP-AWARE VÝSLEDKY ===
  results: {
    default: 'result_new_action',       // loop 0 (první život)
    loop1: 'result_new_action_loop1',   // loop 1 (pochyby)
    loop2: 'result_new_action_loop2',   // loop 2+ (jistota)
  },

  // === CO ODEMKNE / SKRYJE (deklarativně) ===
  unlocks: ['next_action'],              // odemknout po dokončení
  hides: ['old_action'],                 // skrýt po dokončení
  unlocksLoop2: ['shortcut_action'],     // odemknout až od loop 2+
  hidesLoop2: ['tutorial_action'],       // skrýt od loop 2+

  // === SIDE EFFECTY ===
  onComplete(ctx) {                      // VŠECHNY loopy
    setMilestone('new_action_done', () => ctx.persistLoopKnowledge());
    ctx.setFullRebuildNeeded(true);
  },
  onCompleteLoop2(ctx) {                 // JEN loop 2+
    ctx.addLogEntry(ctx.t('log_new_action_loop2'), LogType.SUCCESS);
  },
}
```

**No changes to `locationEngine.js` are needed** when adding new actions.

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

### Helper: ctx.persistLoopKnowledge() (refactored — single source of truth)

**Dříve** měl každý definiční soubor (`scoutShipCrewQuarters.js`, `bridge.js`, `mainArea.js`, `scoutShipWorkshop.js`)
svou vlastní lokální kopii funkce `persistLoopKnowledge(ctx)`. To bylo riziko — 4 kopie stejné logiky,
snadno se rozjedou, snadno se na jednu zapomene při refaktoru.

**Nyní** je `persistLoopKnowledge()` jediná exportovaná funkce v `engine/gameFlags.js` a je součástí `ctx`
objektu, který dostávají všechny action callbacky. Definiční soubory ji volají jako `ctx.persistLoopKnowledge()`
— **žádnou lokální kopii už nikdy nepřidávej.**

```js
// engine/gameFlags.js
export function persistLoopKnowledge() {
    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        state.gameFlags.loopKnowledge = { milestones: { ...gameFlags.loopKnowledge?.milestones } };
        localStorage.setItem('gameState', JSON.stringify(state));
    } catch { /* ignore */ }
}
```

Použití v definici akce:
```js
onComplete(ctx) {
    setMilestone('book_read', () => ctx.persistLoopKnowledge());
}
```

Volej po každé změně `gameFlags.loopKnowledge` polí, která mají přežít smrt loop.

### Debug-mode logging pro action callbacky (safeInvokeActionCallback)

Všechny callbacky (`onStart`, `getResultKey`, `onComplete`, `isAvailable`) se volají přes
`safeInvokeActionCallback(fn, ctx, action, callbackName)` v `locationEngine.js`. Chyba uvnitř callbacku
se odchytí a **neshodí celý engine** — ale ve výchozím stavu se tiše ignoruje (produkční chování).

Pokud řešíš bug typu *„po loopu mi to vypsalo špatný text"* nebo *„akce se nezobrazila, i když měla"*,
zapni v konzoli:
```js
window.DEBUG_ACTIONS = true;
```
Od tohoto okamžiku se každý thrown error uvnitř `onStart`/`getResultKey`/`onComplete`/`isAvailable`
vypíše do konzole i s ID akce a jménem callbacku — `[action:wake_up] onComplete() threw: ...`.
Toto je nejrychlejší způsob, jak odhalit tiché selhání callbacku, které by jinak vypadalo jako "engine bug".


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

## isAvailable systém — jediný zdroj pravdy pro viditelnost akcí (refactored Jun 2026)

**Viditelnost akce v UI řídí VÝHRADNĚ `isAvailable(ctx)` callback** v definici akce.
Volá se při každém `refreshUI()`, takže je vždy aktuální — žádné zastaralé cache.

```js
{
  id: 'nova_akce',
  isAvailable(ctx) {
    const us = ctx.getUnlockState(ctx.getCurrentLocationId());
    if (!us['wake_up']) return false;
    if (ctx.gameFlags.loopCount < 2) return false;
    if (!ctx.hasMilestone('nejaky_milestone')) return false;
    return true;
  },
}
```

`ctx` pro `isAvailable` obsahuje: `gameFlags`, `getCurrentLocationId`, `getUnlockState`, `hasLogin`,
`hasMilestone`, `countItemInBag`, `t`.

- **Akce bez `isAvailable`** jsou vždy viditelné (pokud nejsou `_completed`).
- **NEPOUŽÍVEJ** `unlockedBy` pro řízení viditelnosti — slouží jen pro `unlocksAll` "new" badge.
- **NEPOUŽÍVEJ** `loopAvailable` / `loopAvailablePoi` — byly odstraněny.
- **NIKDY NEPŘIDÁVEJ** `if (action.id === '...')` bloky do `locationUi.js`.
- `isAvailable` se volá přes `safeInvokeActionCallback` — chyba uvnitř nezhroutí render, jen se
  (v debug módu) zaloguje a akce se v tom tiku bude chovat jako neviditelná (`false`).

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

Cline MCP server pro automatickou validaci projektu. Poskytuje 5 nástrojů.

### Nástroje

| Nástroj | Popis |
|---|---|
| `validate_locales` | Porovná `cs/ui.json` ↔ `en/ui.json` a embedovanou EN v `locales.js`. Najde chybějící klíče a prázdné hodnoty. |
| `validate_actions` | Zkontroluje definice akcí — povinná pole, podezřelé `durationSeconds`, chybějící locale klíče. |
| `find_hardcoded` | Najde hardcodované anglické stringy v JS/HTML, které by měly používat `t()`. |
| `check_engine` | Ověří, že `locationEngine.js` neobsahuje zakázané `if (action.id === ...)`. |
| `validate_state_coverage` | **(nový)** Ověří, že každá location definice v `definitions/**/*.js` je skutečně importovaná a zaregistrovaná (`registerLocation()`) v `locationData.js`. Odhalilo to reálný osiřelý soubor `gammaSite/crewQuarters.js` (nahrazen `gammaCrewQuarters.js`, ale nikdy nesmazán) — nyní smazán. Spouštěj po každém přidání nové lokace. |


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
