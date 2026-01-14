// Combat encounter definitions (v1)
// Pure data module: keep IDs stable for saves/story.

export const combatEncounters = [
    {
        id: 'wildlife_river',
        name: 'Aggressive Wildlife',
        description: 'Something darts from the underbrush as you approach the river.',
        enemy: {
            // Tuned for early-game pacing: should take ~10-25s with starter gear.
            maxHp: 40,
            dps: 1.2,
        },
        // Optional knobs for tuning and UI.
        rules: {
            // If true, the player must win to proceed.
            blocksProgress: true,
            // Scales the simulation delta-time (0.25 = 4x slower combat).
            simSpeed: 0.25,
        },
    },
];

export function getCombatEncounter(id) {
    if (!id) return null;
    return combatEncounters.find(e => e && e.id === id) || null;
}
