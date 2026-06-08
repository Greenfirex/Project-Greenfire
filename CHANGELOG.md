# Changelog

## v0.1.0 — Ground-Up Restart (2026-06-08)

### Core Architecture
- Stripped legacy idle-game systems (buildings, jobs, technologies, research, colony, shipyard, galaxy map)
- Rewrote save/load with legacy detection — incompatible old saves auto-discarded, game starts fresh
- Clean folder structure: `core/` (runtime), `features/character/` (character/inventory), `sections/` (game screens), `ui/` (chrome / mobile / screens / system / panels)
- All legacy code preserved in `backup/`

### Game Loop
- New timeloop hub: 3 test actions (Investigate, Stabilize, Scan) with resource drain and XP rewards
- Resource depletion triggers loop reset — partial resource restoration and persistent XP/level tracking across loops
- 5 resources: Health, Stamina, XP, Food Rations, Drinking Water
- Passive regeneration for Health and Stamina; hunger/thirst debuff system

### UI Shell
- Full layout preserved: header (clock, nav links), left menu, game area, right info panel, footer
- Glow effects with 12 color presets + intensity slider
- Compact/mobile mode with icon rail and log-to-footer swap
- Options menu: background run, glow toggle, reduce motion, combat paused, confirm load/reset, language select, save management
- Changelog popup, log options (timestamps, typewriter, filters, colors), objectives panel

### Character & Inventory
- Equipment paperdoll: head, chest, legs, boots, weapon, offhand, 2 accessory slots
- 12×2 inventory grid with drag-and-drop, touch drag/drop, double-tap equip/unequip
- Consumables: Stimpack (heal 30 HP), Herb Tea (stamina regen buff)
- XP-based leveling system: 100 XP per level, 3 stat points per level
- Upgradeable stats: Health, Stamina, Hit Chance, Crit Chance, Attack Speed, Evasion
- Equipment modifies all combat stats; detailed tooltips with modifiers and survival debuff impact

### Journal
- Two-tab layout: Objectives + Journal entries
- Story log with reverse-chronological display

### Quality of Life
- Title screen: Continue / New Game / Settings / Changelog
- Title button in header to return to title screen at any time
- Save/export/import via encrypted AES-GCM clipboard export
- Autosave every 5 minutes
- Pause overlay with click/Escape to resume
- Speed control: 1× / 2× / 5× / 10×

### Technical
- PowerShell execution policy fixed for npm
- Service worker cache-bypass on localhost for dev ergonomics
- ES module import graph fully resolved — zero 404s