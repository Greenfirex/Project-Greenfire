# [0.0.1] - 2025-10-15

This is the initial non public release of Project Greenfire. This version establishes the core gameplay mechanics, a polished user interface, and a variety of customization options.

### ✨ New Features

- **Core Gameplay:** Implemented the foundational gameplay loop for resource gathering, building construction, and technology research.
- **Building System:** Added a variety of buildings, including resource producers (Quarry, Extractor), storage facilities (Stockpile, Silo), and the Laboratory.
- **Cost Scaling:** Building costs now increase exponentially with each purchase, creating a balanced progression curve.
- **Research System:** A full technology tree with prerequisites and resource costs has been implemented, unlocking new game features.
- **Advanced Tooltips:** Hovering over a resource in the info panel now shows a detailed breakdown of its production rate, including base generation from buildings and percentage bonuses from research.
- **Story System:** A multi-page story popup system has been added to deliver narrative events to the player.
- **Interactive Log:** Story events are recorded in the log and can be re-opened by clicking on the corresponding entry.
- **Save/Load System:** Full game state can be saved and loaded. The system is robust and handles the addition of new game content without breaking old saves.
- **Offline Progress:** The game now accurately calculates all progress made while the tab is in the background, thanks to a "delta time" game loop.

### 🎨 UI & Styling Improvements

- **Complete UI Overhaul:** The entire game now features a consistent dark, sci-fi theme.
- **Animated Glow Effect:** All main UI panels are framed with a subtle, animated "pulse-glow" effect.
- **Custom Buttons:** All default HTML buttons have been replaced with custom, image-based buttons for a more professional look.
- **Polished Info Panel:** The resource panel has been redesigned with a multi-column layout, dynamic progress bars for storage, and stable hover effects.
- **Custom Popups:** All popups (Story, Options, Log Options) have been custom-styled to match the game's theme.
- **Custom Scrollbars:** The log panel now features a custom-styled scrollbar that fits the dark theme.
- **Extensive Options Menu:**
    - Choose a custom color for the main UI glow and the active menu button glow.
    - Adjust the intensity and size of the glow effects with a slider.
    - Toggle offline progress on or off.
    - Choose between Standard, Scientific, and Short Scale number formatting.
- **Log Customization:** A dedicated log options menu allows players to filter out specific message types.