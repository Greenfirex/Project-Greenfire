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

---

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