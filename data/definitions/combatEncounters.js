// Combat encounter definitions (v1)
// Pure data module: keep IDs stable for saves/story.

export const combatEncounters = [
    {
        id: 'wildlife_river',
        name: 'Aggressive Wildlife',
        description: 'Something darts from the underbrush as you approach the river.',
        xpReward: 5,
        enemy: {
            // Tuned for early-game pacing: should take ~10-25s with starter gear.
            maxHp: 40,
            dps: 1.2,
            hitChance: 78,
            portrait: 'assets/images/enemies/enemyrat1.png',
            // Some sprites read larger than the player silhouette; scale down slightly.
            portraitScale: 0.84,
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
    {
        id: 'maintenance_drone_south_corridor',
        name: 'Haywire Maintenance Drone',
        description: 'A damaged maintenance unit drops from a ceiling rail, optics flaring red as it locks onto you.',
        xpReward: 10,
        enemy: {
            // Slightly tougher than early wildlife; tuned for post-entry ship exploration.
            maxHp: 60,
            hitChance: 82,
            portrait: 'assets/images/enemies/maintenance_drone.svg',
            portraitScale: 0.9,
            stats: {
                hitChance: 82,
                critChance: 3,
                evasion: 4,
                armor: 2,
                damageMin: 2,
                damageMax: 4,
                // seconds per attack
                attackSpeed: 1.05,
            },
        },
        rules: {
            blocksProgress: true,
        },
    },
];

export function getCombatEncounter(id) {
    if (!id) return null;
    return combatEncounters.find(e => e && e.id === id) || null;
}
