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
            hitChance: 78,
            portrait: 'assets/images/enemies/enemyrat1.png',
            stats: {
                // Display-only (and future-proof for per-enemy tuning)
                hitChance: 78,
                critChance: 0,
                evasion: 2,
                armor: 1,
                damageMin: 1,
                damageMax: 2,
                // avg(1..2)=1.5; 1.5 * 0.8 = 1.2 DPS
                attackSpeed: 0.8,
            },
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
