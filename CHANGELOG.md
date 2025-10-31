# [0.1.7] - 2025-10-31

- Added: Two‑stage “Search: Power Core”. Stage 1 reports reinforced doors; Stage 2 requires and consumes 1 Makeshift Explosive, then opens the core and yields rewards. Stage‑specific costs now supported in UI and engine.
- Added: New resources — Chemicals and Makeshift Explosive (hidden until discovered).
- Added: Repeatable “Collect Chemicals” action (unlocked by Labs).
- Added: “Assemble Makeshift Explosive” craft action. Auto‑unlocks when both Fabric and Chemicals are discovered (via centralized unlock rules).
- Added: Upgrade “Install Purification Unit” (+20% Clean Water from Purify Water; +20% Water Collection job). Unlocks after “Search: Labs”.
- Added: Central upgrade effects system (upgradeEffects.js) with:
  - computeRewardMultiplier and computeRewardEffects (math + labels).
  - Tooltips now use the same function as runtime, so previews match actual rewards.
- Added: Centralized block/unlock rules (unlockRules.js):
  - getBlockedStatus for action gating (e.g., corridors/bridge require Investigate Sound + Base Camp).
  - evaluateEventUnlocks for resource‑based unlocks (e.g., Fabric + Chemicals ➜ Assemble Explosive).
- Added: actionUtils.js with documented helpers (pure, stateless): stage merge for tooltips, affordability/shortfalls, effective duration (debuffs), RNG, lsGet.

- Changed: Tooltips are stage‑aware (show stage.cost like Makeshift Explosive on Power Core stage 2; stage duration/reward overrides).
- Changed: North corridor story updated to point to Labs + Power Core, survivor is sent back to base, and hints that restoring core power would boost search & rescue.
- Changed: Generic completion logging is now opt‑out via suppressGenericLog on actions or stages (used by Establish Base Camp, Purification Unit installs).

- Fixed: Power Core stage 2 properly blocked without Makeshift Explosive and shows correct tooltip cost; cost is consumed on start.
- Fixed: Purify Water and Clean Water job tooltips reflect the Purification Unit’s +20% bonus.
- Fixed: Removed duplicate green “complete/gained” log for actions that set suppressGenericLog.

- Refactor: Split Upgrade actions into data/upgrades.js and added data/allActions.js aggregator; updated imports (Crash Site, Colony, Save/Load).
- Refactor: crashSite.js trimmed; shared helpers moved to actionUtils.js; removed duplicate getRandomInt; resource‑discovery unlocks and action blocking now delegated to unlockRules.js.
- Refactor: tooltip.js aligned to upgradeEffects (removed hard‑coded cases; unused helpers trimmed).

---

# [0.1.5] - 2025-10-29

- **Added:** Tooltip ETA — tooltips now show estimated time-to-availability (ETA) for missing resources when there is a positive net production for that resource.
- **Added:** Tooltip missing-cost highlighting — cost/drain lines that the player is short on are highlighted in red for immediate clarity.
- **Added:** Tooltip auto-refresh — tooltips now refresh in-place every 1s while visible so ETAs and live rates stay up-to-date.
- **Added:** Tooltip API — exported refreshCurrentTooltip() so modules can force an immediate tooltip rebuild after resource changes.
- **Added:** Crash Site action-state updater — action affordances are recalculated each main-loop tick so buttons reflect real-time resource changes.

- **Changed:** Tooltip rendering refactor — moved tooltip HTML generation into a single build function used for initial render and refresh.
- **Changed:** Tooltip positioning — chosen screen coordinates are persisted on first layout and reused while refreshing to avoid jumps.
- **Changed:** Resource display logic — per-second generation only shows when there is a non-zero production/consumption (avoids "0.0/s" noise) and uses explicit +/- formatting.
- **Changed:** Scrap Metal resource flagged as non-producible by default to match Food/Clean Water layout and prevent misalignment.
- **Changed:** Action/button behavior — stopped using native title attributes for shortfall/blocked messages; messages are stored in data-* attributes and shown via the custom tooltip.

- **Fixed:** Removed duplicate native tooltip by stripping title attributes and observing mutations on registered tooltip elements.
- **Fixed:** Prevented duplicate small tooltips by suppressing resource-row candidates while a non-resource tooltip is active.
- **Fixed:** Debuff icons no longer register their own tooltip and are non-interactive so they don't steal hover.
- **Fixed:** Tooltip refresh robustness — auto-refresh now persists while the tooltip is visible and stops cleanly on hide.
- **Fixed:** Immediate tooltip updates — refreshCurrentTooltip() calls added to action/building/job handlers so tooltips update right after costs/rewards/refunds are applied.
- **Fixed:** Action click handlers recompute affordability/blocked state on click (no stale closures) so log messages and prevention are reliable.

- **Notes:** ETA calculations use computeResourceRates() for live netPerSecond values. The tooltip refresher is lightweight and defensive (swallows errors) to avoid impacting the main loop. If you want additional modules wired to refreshCurrentTooltip or different refresh frequency, indicate target files and desired cadence.

---

# [0.1.1] - 2025-10-25

- Fix: debuff icon tooltip reliably shows (hit-test priority, direct icon handlers) and properly transitions icon ↔ row without races.
- Fix: removed stray event handlers and runtime errors that prevented tooltip logic from running.
- Change: tooltip hide is triggered when story popups open (dispatches request-hide-tooltip).
- UI: story popup is now a fixed-size dialog with a scrollable content area so Next/Previous buttons do not move; dialog size increased (~50% larger).
- UX: added Esc key support to close story popup; handler is attached when popup opens and removed on close.
- Style: popup navigation uses the shared menu-button styling and buttons constrained to ~20% width for consistent layout.
- Misc: removed temporary debug helpers (TIME_SCALE) and trimmed nonessential tooltip workarounds while keeping minimal, robust fixes.

---

# [0.1.0] - 2025-10-22

This update introduces the foundational elements of **Chapter 1: Fall From the Sky**, shifting the game's start to a narrative-driven survival scenario before the colony-building phase. It also includes various quality-of-life improvements and bug fixes based on initial development.

### ✨ New Features

- **Chapter 1 Implemented:** The game now begins at a crash site. Players start as a lone survivor and must explore, scavenge, and manage basic needs before establishing a colony.
- **New "Crash Site" Section:** Replaces the initial "Colony" view as the starting area. Features unique actions focused on survival and salvaging.
- **New Survival Mechanics:**
    - **Energy Resource:** Added a new resource required for performing most actions. Drains over time during strenuous tasks.
    - **Food Rations & Clean Water Costs:** Actions now consume Food and Water directly, representing the player's personal needs.
    - **New Survival Actions:** Added "Rest" (restores Energy), "Forage for Food", and "Purify Water".
- **New Salvage & Exploration Mechanics:**
    - **New Resources:** Added "Scrap Metal" and "Ship Components" gathered from the wreckage.
    - **Multi-Stage Scouting:** The "Scout Surroundings" action is now a three-stage quest that progressively unlocks survival and scavenging actions and reveals story elements via unique, clickable log entries.
- **Action Categories:** Actions in the Crash Site are now organized into "Survival", "Materials", "Exploration", and "Objectives".
- **In-Game Time:** A clock displaying the current time has been added to the header.
- **Encrypted Save Export/Import:** Added functionality in the **Options** menu to export and import saves securely.

### 🔄 Changes & Improvements

- **Action System Overhaul:**
    - Actions can now have costs paid upfront (`cost`) or drained over time (`drain`).
    - Actions can now unlock other actions or trigger story events upon completion.
    - Added random variance (`[min, max]`) to resource rewards for actions.
    - Action progress bars are now displayed inside the action button, including a countdown timer.
    - Actions in progress can now be cancelled with a two-click confirmation ("Abort?"), refunding 50% of spent/drained resources.
- **UI & UX:**
    - **Info Panel:**
        - Improved layout for resource rows (slimmer height, adjusted column spacing, text forced to single line).
        - Non-producible resources (Scrap, Components, Energy, etc.) no longer show a `/s` rate and have adjusted layouts.
        - Negative resource rates (e.g., from drains) now display in **red**.
        - Resources at zero amount now display their name and amount in **red**.
        - "Insight" resource text is now **yellow**.
        - Tooltips for resources now provide a detailed breakdown including Production, Consumption, Drain, and Net Change.
    - **Tooltips:**
        - Tooltips for Crash Site actions now display duration, costs (upfront and total drain), and reward ranges.
    - **Crash Site:** Added a full-section semi-transparent content panel to improve text readability over the background image.
    - **Story Log:** Log entries for completing scouting stages are now unique and **clickable**, allowing players to revisit the story popups.
    - **Footer:** Correctly implemented the three-column layout with consistent glowing dividers.
- **Progression:**
    - Game start significantly reworked around the Chapter 1 narrative.
    - Resources like Stone, Scrap, and Components are now **hidden** until discovered/acquired.
    - Survivor count starts at `0` and is hidden initially.

### 🐛 Bug Fixes

- Fixed numerous issues related to saving and loading game state, particularly regarding multi-stage action progress (**Scout Surroundings**).
- Resolved CSS conflicts and layout problems in the footer and info panel (text wrapping, inconsistent row heights).
- Fixed JavaScript errors related to module exports (`showSection`) and incorrect variable references during action completion.
- Corrected tooltip display logic to reliably differentiate between actions and technologies.

# [0.0.1] - 2025-10-15

This is the initial non-public release of Project Greenfire. This version establishes the core gameplay mechanics, a polished user interface, and a variety of customization options.

### ✨ New Features

- **Core Gameplay:** Implemented the foundational gameplay loop for resource gathering, building construction, and technology research.
- **Building System:** Added a variety of buildings, including resource producers (**Quarry, Extractor**), storage facilities (**Stockpile, Silo**), and the **Laboratory**.
- **Cost Scaling:** Building costs now increase exponentially with each purchase, creating a balanced progression curve.
- **Research System:** A full technology tree with prerequisites and resource costs has been implemented, unlocking new game features.
- **Advanced Tooltips:** Hovering over a resource in the info panel now shows a detailed breakdown of its production rate, including base generation from buildings and percentage bonuses from research.
- **Story System:** A multi-page story popup system has been added to deliver narrative events to the player.
- **Interactive Log:** Story events are recorded in the log and can be **re-opened by clicking** on the corresponding entry.
- **Save/Load System:** Full game state can be saved and loaded. The system is robust and handles the addition of new game content without breaking old saves.
- **Offline Progress:** The game now accurately calculates all progress made while the tab is in the background, thanks to a "delta time" game loop.

### 🎨 UI & Styling Improvements

- **Complete UI Overhaul:** The entire game now features a consistent **dark, sci-fi theme**.
- **Animated Glow Effect:** All main UI panels are framed with a subtle, animated "**pulse-glow**" effect.
- **Custom Buttons:** All default HTML buttons have been replaced with custom, image-based buttons for a more professional look.
- **Polished Info Panel:** The resource panel has been redesigned with a multi-column layout, dynamic progress bars for storage, and stable hover effects.
- **Custom Popups:** All popups (Story, Options, Log Options) have been custom-styled to match the game's theme.
- **Custom Scrollbars:** The log panel now features a custom-styled scrollbar that fits the dark theme.
- **Extensive Options Menu:**
    - Choose a custom color for the main UI glow and the active menu button glow.
    - Adjust the intensity and size of the glow effects with a slider.
    - Toggle offline progress on or off.
    - Choose between **Standard, Scientific, and Short Scale** number formatting.
- **Log Customization:** A dedicated log options menu allows players to filter out specific message types.