# [0.2.7] - 2026-02-06

### Added

- **Crafting:** Recipes are now grouped into categories (Weapons / Accessory / Armor / Quest / Consumables).
- **Consumables:** New craftable item — **First Aid Kit** (unlocks after discovering **Fabric**).
- **Compact header:** Added a compact-mode **Morale** pill with tooltip details.

### Changed

- **Crash Site Local Map:** Improved tile backing alignment and reduced edge cut-off issues.
- **Base Camp tile (Local Map):** Base camp art is now blended/overlaid on the tile background (stretched, no black matte).
- **Campsite economy:** Scrap/Wire collector jobs now consume upkeep resources (Provisions/Water) and auto-cancel when upkeep hits 0.
- **Campsite resources UI:** Resource indicators now use a vertical fill column style.
- **Phone-landscape (Crafting):** Crafting panel sizing/padding tuned so it doesn’t feel overly wide under collapsed rails; crafting buttons are smaller to match Campsite sizing.

### Fixed

- **Mobile (Campsite upgrades):** Fixed a bug where buying one upgrade could cause subsequent upgrades to stop responding until save+reload.
- **Action start feedback:** Starting an action while another action is active now logs clear feedback instead of failing silently.

---

# [0.2.6] - 2026-02-04

### Added

- **Character (mobile):** Touch drag-and-drop for moving/swapping items between Bag and Equipment.
- **Character (mobile):** Double-tap quick actions: bag items auto-equip; equipped items auto-unequip to the first empty bag slot.

### Changed

- **Log Options popup:** Restyled to match the Options menu visual treatment and made the content scroll internally.
- **Crash Site Local Map:** Fog-of-war is stricter; blocked tiles and crash-site interior visuals are no longer revealed through fog before discovery.
- **Local Map Tile panel:** Added a clear tile status label and color-coding (Explored = green, Unexplored = yellow, Unknown/Blocked = red).

### Fixed

- **Mobile layout stability:** Prevented long footer “latest log” lines from widening the layout.
- **Log Options popup (mobile):** Prevented overflow/clipping on small landscape screens.

---

# [0.2.5] - 2026-01-28

### Changed

- **Phone-landscape UX:** Side panels behave as overlay drawers and the center game area is inset so collapsed rails don’t cover section content.
- **Crash Site / Journal tabs (mobile):** In-section tabs are hidden in compact mode and accessible via the left icon-rail popover.
- **Popups (mobile):** Options popup layout and styling were tuned to match the story popup treatment and fit small landscape screens.
- **Tab styling:** Crash Site and Journal tab buttons now render with a more opaque background.

### Fixed

- **Crash Site right edge:** Prevented the right drawer chevron tab from covering the Local Map tile panel / Campsite right-side content.
- **Journal tab switching (mobile):** Selecting the Journal tab via the popover no longer flashes then snaps back to Objectives.

---

# [0.2.4] - 2026-01-27

### Added

- **Crash Site: Campsite tab:** The Crash Site screen now includes a Campsite tab with embedded **Jobs / Upgrades / Buildings** panels.
- **Workbench → Crafting panel:** Completing **Workbench** unlocks a new **Crafting** panel in Campsite.
- **Journal replay links:** Journal entry titles are now clickable to re-open the original story popup.
- **Stable story ids + stored outcomes:** Story events now have stable ids and journal entries store the outcome payload so replayed popups match what you saw originally.
- **Local Map: Tile panel collapse:** Added a chevron on the Local Map **Tile** panel to collapse it to a slim strip (widening the map). State persists.

### Changed

- **Objective / story presentation:** Key objective-completion popups now include explicit **Objective completed / Rewards / New objective** outcome sections where appropriate.
- **Idle warnings:** Campsite `!` indicators now trigger at **1+ idle** survivors/crew (instead of 2+).
- **Beyond the Perimeter progression:** “Investigate Distant Smoke” is now a **tile-bound** action on **J2**, with a fog-visible `!` marker until completed.
- **Perimeter route unlock:** When the distant smoke story triggers, a corridor of tiles is unblocked to allow reaching J2 (C4 → J2 path).
- **Base camp UX:** After Workbench, base camp tile actions are simplified and include a **Visit camp** utility button.
- **Crafting proximity rule:** Crafting actions are shown in Campsite but can only be started while standing on **Base Camp (B7)**.

### Fixed

- **Base camp improvement popup:** “Improve base camp” now reliably lists the completed objective and its rewards in the story popup footer.
- **Visit camp tooltip:** Fixed tooltip rendering for the Visit camp button.

---

# [0.2.3] - 2026-01-23

### Added

- **Crash Site: Local Map (v1):** New Local Map tab with an interactive tile grid for exploring around the crash site.
- **Tile Details Panel:** Selecting a tile shows its info (so the map is usable without guessing what each tile represents).
- **Fog of War + Visited Tiles:** Unexplored tiles are hidden/blackened; visited tiles render brighter for quick navigation.
- **Map Zoom Controls:** `+ / -` zoom controls (with sensible limits) to get a closer look at the crash zone.
- **Drag-to-Pan (When Zoomed):** When zoomed in, you can drag the map viewport to pan around without losing the selected tile.
- **Tile-Bound Action Panel:** Exploration actions are now shown contextually for the selected tile / player tile (instead of a long global list), matching the new map workflow.
- **Crash Wreckage Boundary (Map):** The crash site perimeter now behaves like a physical barrier on the map, with progression-driven access points.
- **New Torch Progression:** Added a craftable **Basic Torch** accessory and a torch-gated dark area on the map (including new story beats pointing you toward crafting/equipping one).

### Changed

- **Crash Zone Navigation:** Movement UX now enforces “no diagonals” and provides clearer blocked feedback (including keeping Move visible and explaining why it’s blocked).
- **Crash Site Action Placement:** Key exploration actions are now map-driven (e.g., Rest/Forage/Purify/Hunt/Re-entry) and removed from the main Crash Site action list to reduce clutter.
- **Local Map Layout:** Map view and action layout were tuned so the map is the primary focus (larger map area, more compact tile/actions side panel).
- **Story / Gating Pass:** Several early exploration beats were moved onto the map (tile-triggered story popups and progression gates encountered by exploring, not just clicking a list).
- **Alternate Access Flow (Map):** The alternate access path is now an adjacent interaction on the map and transitions into the hull-pry path after completion.

### Fixed

- **Zoomed Tile Selection:** Fixed a bug where selecting tiles could fail when zoomed (panning no longer suppresses clicks incorrectly).
- **Repeatable Map Actions:** Progress bars and button state now remain reliable across repeated runs of the same map action.
- **Action Availability Refresh:** Map action buttons now refresh their affordability/capacity/blocked styling more consistently after resource changes.

---

# [0.2.2] - 2026-01-18

### Added

- **Options: Reduce Motion:** New toggle to disable most UI animations for a calmer / more accessible experience.
- **Options: Confirmation Toggles:** New toggles to control whether **Load** and **Reset** actions require confirmation.
- **Options: More UI Glow Colors:** Expanded UI glow palette with additional color choices.

### Changed

- **Stamina Progression (Chapter 2):** Once Chapter 2 begins (Colony unlocked), stamina now regenerates automatically — players no longer need to manually Rest to recover stamina.
- **Colony Buildings:** **Quarry** and **Extractor** are now locked by default and no longer appear in the Colony build list until unlocked.
- **Options Cleanup:** Removed **Number Formatting** and **Active Button Glow** settings for now.
- **Glow Intensity Control:** Reworked the glow intensity slider to a stable **0–100** scale with smoother visual mapping.
- **Unified Glow Behavior:** The “active” glow styling is now kept in sync with the main UI glow settings.
- **Load/Reset UX:** Load and Reset confirmations now use the in-game confirmation popup instead of browser dialogs.

### Fixed

- **Confirm Popup Layout:** Increased confirm popup sizing and improved text wrapping so longer messages fit reliably.
- **Confirm Popup Scrolling:** Prevented odd scroll/flex clipping behavior and reset scroll position on open.
- **Crash Site → Colony Transition:** Fixed a bad unlock check that could cause incorrect section visibility after Colony unlock.

---

# [0.2.1] - 2026-01-12

### Added

- **Character Section (v1):** New main menu section with Equipment, Inventory, and Stats panels.
- **Inventory Interactions:** Drag-and-drop between bag and equipment, plus double-click quick equip/unequip.
- **Item Tooltips (Character):** Item tooltips on Character equipment/bag slots showing slot + stat modifiers.
- **Campsite Reminder:** Yellow `!` badge on the Campsite tab when there are idle survivors/crew to assign.

### Changed

- **Character Stats Defaults:**
    - Damage is now a range: **1 - 2**.
    - Crit Chance default is now **5%**.
    - Added **Attack Speed** stat (default **1.0**).
    - Stats ordering is now grouped: Damage → Attack Speed → Crit Chance → Armor → Carry Capacity.
- **Resource Panel Categories:**
    - Added spoiler-safe category headers (hidden when empty).
    - Reordered so **Materials** appears above **Tools**.
    - Category header text size increased to match Crash Site category headings.
- **Crash Site Category Headings:** Category headers now use the same green accent styling as Character/Journal section headers.

### Fixed

- **Crash Site Action Waste:** Certain Crash Site actions now become inactive when their reward would be fully wasted due to storage being at capacity (e.g., making a tool when its stock is full).

---

# [0.2.0] - 2025-11-20

### Added

- **Chapter 2 Story Event:** "Lost Signal" narrative event triggers when entering Chapter 2, introducing new story elements and setting up future content.
- **Chapter Progression System:** Added `chapter` flag to gameFlags to track story progression; persisted in save system.
- **Story Popup Visual Overhaul:**
  - Background image support with dark overlay for improved atmosphere.
  - Backdrop blur effect on the overlay for modern frosted-glass appearance.
  - Enhanced header with gradient background, glowing border, and prominent title text-shadow.
  - Category headers now feature gradient backgrounds, left border accent, and subtle glow effects matching objectives panel aesthetic.
  - Message text now includes subtle text-shadow for better readability and "screen glow" effect.
  - Removed redundant X close button; Close button now displays "Close (Esc)" to indicate keyboard shortcut.
  - New job: Wire Collector, unlocked by Organize Wire Scavenging upgrade.
  - Implemented Organize Wire Scavenging upgrade to enhance wire salvage operations.
  - Created Encrypted Drive section with tasks for decrypting military-grade transmissions.
  - Updated actions and objectives to include new tasks related to decrypting radio messages and checking captain's quarters.
  - Enhanced resource management and UI updates for new tasks and job assignments.
  - Improved game flags and action completion handlers to support new features.
  - Refactored existing objectives to accommodate new gameplay elements and ensure smooth progression.

### Changed

- **Story Popup Reimagined:**
  - Converted from multi-page pagination to single-page scrollable format for better content flow.
  - Fixed height set to 50vh with scrollable body area.
  - All pages from story events now display as distinct paragraphs in one view.
  - Outcome sections (objectives, unlocks, rewards) always visible at bottom when present.
  - Simplified navigation: removed Previous/Next buttons and page counter; single centered Close button.
  - Category sections (New Objective, Objective Completed, Upgrades Unlocked, Buildings Unlocked, etc.) now use consistent 20px spacing.
  - Custom scrollbar styling matches ingame log (12px width, dark track, semi-transparent green thumb).
  - Improved spacing: added gaps above and below scrollable content, pushed bottom border down for better visual balance.

### Fixed

- Story popup category spacing inconsistencies resolved with unified margin rules.
- Scrollbar positioning improved with proper padding in body and text areas.

---

# [0.1.13] - 2025-11-18

### Added

 New story events: `base_camp_improved` (base camp fully upgraded) and `stockpile_resources_secured` (resource thresholds achieved).
- Smoke sighting gating flag `smokeSightingShown` to ensure the distant smoke popup and action unlock fire only once.
- Fallback unlock logic for the `Investigate Distant Smoke` action and objective if earlier trigger paths were missed.

### Changed

- Objective completion flow: "Improve base camp" and "Stockpile resources" now each show their own dedicated story popup; distant smoke sighting triggers only when the second prerequisite objective finishes.
- Smoke sighting story event now explicitly lists: "New action unlocked: Investigate Distant Smoke." for clarity.
- Save/Load action merge narrowed to runtime fields (unlock state, stage, timing) to prevent old saves from overwriting design‑time definitions (e.g., `tooltipEffects`).
- Runtime merge expanded to persist limited‑use action fields (`uses`, `maxUses`, `completed`) so retired actions remain hidden across reloads.
- Tooltip data integrity: prevented legacy save data from clobbering updated split effect lines (e.g., Salvage Cooking Equipment).

### Fixed

- `Investigate Distant Smoke` objective failing to appear after new gating logic — fallback pass now guarantees unlock when both prerequisites met.
- `Assemble Makeshift Explosive` reappearing after reload despite reaching max uses — completion state now persists.
- Duplicate or premature distant smoke popups prevented via `smokeSightingShown` flag.
- Eliminated unlock regression where design-time `tooltipEffects` were overwritten by old save structures.

---

# [0.1.12] - 2025-11-13

### Added

- Objectives split: the combined objective "Make yourself comfortable and prepared" was split into two clearer objectives:
    - "Improve base camp" — focuses on completing base-camp upgrade actions.
    - "Hoard supplies" — focuses on accumulating resource thresholds (Food, Water, Scrap, Fabric, Chemicals, Wire).
- New planning upgrades to gate large storage buildings: `planFoodLarder` and `planWaterReservoir`.

### Changed

- Objectives and save/load: objectives are now included in the composite game state and restored on load to avoid footer/objective desync after restart. Objective XP for the original combined objective was split across the two new objectives.
- Story popup and unlock presentation: story popup now separates “Upgrades Unlocked” from “Actions Unlocked”, and the completion pipeline captures unlocks produced by completion handlers and centralized unlock rules before building the popup outcome.
- Unlock rules and gating: centralized rules adjusted so some upgrades (e.g., Purification Unit, Assemble Makeshift Explosive) require the correct combination of discoveries (Fabric + Chemicals) before unlocking.
- Buildings and tooltips: Foraging Camp and Water Station now provide small local storage effects and building/tooltips were updated to render `effects[]` entries; Food Larder and Water Reservoir costs and storage values were adjusted.

### Fixed

- Prevented duplicate "Upgrade available" log lines by ensuring completed upgrades are not re-announced by unlock rules.
- UI rebuilds now trigger immediately after rule-based unlocks so newly unlocked actions/upgrades appear without extra interaction.
- Story popup reliably includes unlocks generated by completion handlers (no missing unlocks in outcome).

# [0.1.11] - 2025-11-12

## Added

- Collapsible side panels:
    - Added chevron buttons to main menu and info panel that allow collapsing panels to expand game area.
    - Panel collapse state persists in localStorage.
    - Game area dynamically expands: 80% when one panel collapsed, 100% when both collapsed.
    - Glowing separator lines animate smoothly to match collapsed panel positions.
- Objectives revamp and enhancements:
    - Expanded completion criteria and evaluation logic in the objectives engine.
    - Richer UI in the Objectives panel with improved state handling and visuals.
    - Story event integration and unlock rule updates to better reflect progression.
    - New/updated story events for early progression beats (Crash Site branches, power/bridge follow‑ups) with clickable log entries.

## Changed

- UI Layout:
    - Log section height adjusted to align collapse chevrons at screen center for visual balance.
    - Log header height now matches footer height (40px) for consistency.
    - Side panels (main menu and info panel) now render above game area (z-index: 10) to prevent clipping of collapse buttons.
- Info Panel & Resources:
    - Survivors now has a dedicated display: always listed directly under Morale, shows only the count (no cap or rate), right-aligned, with an always‑full background bar.
    - Morale percent moved to the far right for consistent alignment with other values.
    - Unified numeric font weight (600) across resource values and Morale; negative rates use the same weight for consistency.
- Journal:
    - Active tab glow reduced; inactive tabs further dimmed for a clearer visual hierarchy.
- Objectives UI polish:
    - Objectives panel and styles refined alongside the backend revamp; tooltip alignment improved.
 - Story & HUD polish:
    - Story popup and header/footer styles refined; copy and states aligned to new objective/stage flows.
    - Tooltip behavior updated to stay consistent with new objective states.
 - Main Menu:
    - Reverted a short grid experiment; kept the original flex layout with a fixed 50% log section height to avoid vertical shifts.
- Actions & Unlocks:
    - Tuned action data (durations, costs, and unlock chains) to better sequence early game steps.
    - Consolidated gating rules (unlockRules) so corridors/bridge/base-camp interactions are enforced consistently.
- Upgrades & Tooltips:
    - Refreshed upgrade definitions and labels; tooltips aligned with data for preview vs. runtime parity.

## Fixed

- Collapse chevron buttons now properly visible on both sides (fixed z-index stacking issues with game area).
- Glowing separator lines now correctly positioned when panels are collapsed, accounting for 3px flex gaps.
- Survivors row no longer shows capacity or generation rate.
- Morale percent no longer appears visually misaligned in the middle of the row.
- Overly strong journal tab glow that distracted from content has been toned down.
- Main menu log section no longer jumps when new entries arrive (fixed-height log with internal scrolling).
 - Objectives panel updates no longer lag after certain story event transitions (more reliable recompute hooks).

---

# [0.1.10] - 2025-11-07

## Added

- Story popup Outcome now includes Objectives:
    - "Objective Completed" section listing just-finished objectives with their rewards inline.
    - "New Objective" section listing newly active objectives.
- Objective transition tracking inside the Objectives engine to power UI (exposed via a lightweight accessor).
- Experience Points (XP) as a meta resource:
    - Added hidden resource "XP" with very large capacity and integer display.
    - Compact XP meter in the first footer column (right side): shows total XP and a thin progress bar (progress toward next 100 XP).

## Changed

- All objective rewards now grant XP instead of survival resources.
- Outcome footer merges objective rewards into the Rewards list, so totals reflect XP gains alongside any other rewards.

## Fixed

- Popup sometimes omitted objective updates due to recompute timing. Hardened with engine-side delta capture plus a local snapshot fallback; also includes a last‑minute check using objective completion timestamps.

---

# [0.1.9] - 2025-11-05

## Added

- Current Objectives system (spoiler‑lite, curated narrative beats):
    - Objectives engine with states (locked/active/completed), timestamps, and minor resource rewards on completion.
    - Persistence via localStorage and safe recompute hooks on action completion and key lifecycle events.
    - Footer Objectives panel: a compact toggle in the center footer opens a slide‑up drawer listing up to 5 terse objectives (read‑only, no click‑through).
- Weather v1 with morale effects and HUD:
    - Dynamic weather types (Clear, Overcast, Rain, Storm, Heatwave, Cold Snap) with in‑game durations, temperature sampling (°C), and morale deltas.
    - Header weather capsule shows icon, type, and °C; tooltip includes PDA forecast, morale impact, and ETA to next change.

## Changed

- “Investigate Bridge” now has stage‑aware descriptions (pre‑power vs post‑emergency power) and tooltips reflect the current stage.
- New upgrade: “Light Campfire” (+5% Morale) available after Base Camp; cost set to Scrap 5, Provisions 15, Water 10; sets campfireLit flag on completion.
- “Install Rain Catchers” tooltip now explicitly lists the Rain Tarp building unlock.
- HUD/UX refinements:
    - Moved Pause/Speed controls from header to footer; standardized active highlight that doesn’t grow/shrink buttons; ~20% smaller sizing.
    - Time and Weather capsules are fixed‑width, aligned, and non‑resizing; ETA removed from the capsule (now tooltip‑only) to prevent layout shifts.
    - Objectives button made larger/more prominent; removed the game speed HUD label from the footer center.
- Header tooltips:
    - Time tooltip shows elapsed since crash and real‑time ↔ in‑game time mapping at current speed.
    - Weather tooltip shows PDA forecast, morale effect, and ETA.

## Fixed

- Reset now fully clears Objectives status and re‑initializes them for a fresh game.
- Weather capsule no longer expands/shrinks with content; fixed‑width prevents jitter.
- Action tooltips and stage merges: stage‑specific cost/duration/description appear correctly (e.g., Power Core stage 2 and Bridge stages).

---

# [0.1.8] - 2025-11-04

## Added

- Global Morale system (additive, percent-based) that scales job outputs only.
    - New Morale row at the top of the info panel with color tinting and a detailed tooltip that lists sources and remaining days for time-based effects.
    - Morale appears in Modifiers for jobs and producing items (tooltips show Morale as a ±X% delta from baseline).
- In-game time-based decays for Morale sources:
    - Crashlanded: −50% decays linearly to 0 over 7 in-game days; auto-clears when fully decayed.
    - Base Camp Established: +10% decays linearly to 0 over 7 in-game days after establishment.
- Campsite job tooltips now include a unified Modifiers section (Morale + relevant upgrade effects).

## Changed

- Renamed “Energy” to “Stamina” across data, UI, tooltips, and styles.
- Unified tooltip cost and ETA logic; Buildings and Research now show affordability/shortfalls and ETA consistent with Actions.
- Info panel polish: capped resources no longer render as red; all rates use explicit +/− signs; fixed missing space for negative lines.

## Fixed

- Purification Unit upgrade correctly surfaces +20% for the Water Collection job in tooltips (effect mapping).
- Action progress bars reset to 0% instantly on completion/cancel (temporarily disable transition to avoid flicker).
- Disabled auto-save on pause by removing the pause-triggered save listener in the save system.

---

# [0.1.7] - 2025-10-31

- Added: Two‑stage “Search: Power Core”. Stage 1 reports reinforced doors; Stage 2 requires and consumes 1 Makeshift Explosive, then opens the core and yields rewards. Stage‑specific costs now supported in UI and engine.
- Added: New resources — Chemicals and Makeshift Explosive (hidden until discovered).
- Added: Repeatable “Collect Chemicals” action (unlocked by Labs).
- Added: “Assemble Makeshift Explosive” craft action. Auto‑unlocks when both Fabric and Chemicals are discovered (via centralized unlock rules).
- Added: Upgrade “Install Purification Unit” (+20% Drinking Water from Purify Water; +20% Water Collection job). Unlocks after “Search: Labs”.
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
- Fixed: Purify Water and Water Collection job tooltips reflect the Purification Unit’s +20% bonus.
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
- **Changed:** Scrap Metal resource flagged as non-producible by default to match Food Rations/Drinking Water layout and prevent misalignment.
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
    - **Stamina Resource:** Added a new resource required for performing most actions. Drains over time during strenuous tasks.
    - **Food Rations & Drinking Water Costs:** Actions now consume Food and Water directly, representing the player's personal needs.
    - **New Survival Actions:** Added "Rest" (restores Stamina), "Forage for Food", and "Purify Water".
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
    - Non-producible resources (Scrap, Components, Stamina, etc.) no longer show a `/s` rate and have adjusted layouts.
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
    - Resources like Crystal, Scrap, and Components are now **hidden** until discovered/acquired.
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