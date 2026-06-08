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
                damageMin: 3,
                damageMax: 4,
                // avg(3..4)=3.5; 3.5 * 0.8 = 2.8 DPS
                attackSpeed: 0.9,
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
            hitChance: 60,
            portrait: 'assets/images/enemies/maintenance_drone.svg',
            portraitScale: 0.9,
            stats: {
                hitChance: 60,
                critChance: 3,
                evasion: 4,
                armor: 2,
                damageMin: 5,
                damageMax: 7,
                // seconds per attack
                attackSpeed: 1.05,
            },
        },
        rules: {
            blocksProgress: true,
        },
    },

    // Additional early-game encounters (Crash Site / nearby forest)
    {
        id: 'wildlife_thorncrawler',
        name: 'Thorncrawler',
        description: 'A segmented shape pushes through the brush, dorsal spines scraping against bark as it closes in.',
        xpReward: 7,
        enemy: {
            maxHp: 48,
            hitChance: 76,
            portrait: 'assets/images/enemies/thorncrawler.svg',
            portraitScale: 0.9,
            stats: {
                hitChance: 76,
                critChance: 1,
                evasion: 3,
                armor: 2,
                damageMin: 3,
                damageMax: 5,
                // seconds per attack
                attackSpeed: 0.95,
            },
        },
        rules: {
            blocksProgress: false,
        },
    },
    {
        id: 'wildlife_spore_hound',
        name: 'Spore Hound',
        description: 'A low, steady growl carries through the canopy. Bioluminescent growths pulse as it lunges.',
        xpReward: 9,
        enemy: {
            maxHp: 62,
            hitChance: 80,
            portrait: 'assets/images/enemies/spore_hound.svg',
            portraitScale: 0.9,
            stats: {
                hitChance: 80,
                critChance: 2,
                evasion: 4,
                armor: 2,
                damageMin: 6,
                damageMax: 8,
                attackSpeed: 1.05,
            },
        },
        rules: {
            blocksProgress: false,
        },
    },
    {
        id: 'wildlife_razor_mites',
        name: 'Razor Mites',
        description: 'The ground seems to move. A swarm of hard-shelled parasites fans out, edges glinting as they rush you.',
        xpReward: 8,
        enemy: {
            maxHp: 52,
            hitChance: 78,
            portrait: 'assets/images/enemies/razor_mites.svg',
            portraitScale: 0.9,
            stats: {
                hitChance: 78,
                critChance: 0,
                evasion: 6,
                armor: 0,
                damageMin: 3,
                damageMax: 5,
                attackSpeed: 0.9,
            },
        },
        rules: {
            blocksProgress: false,
            // Slightly slower UI pace helps readability for a "swarm" feel.
            simSpeed: 0.28,
        },
    },
    {
        id: 'ship_shard_sentry',
        name: 'Shard Sentry',
        description: 'A fractured security node stirs in the wreckage. Its core flares to life and it pivots toward you.',
        xpReward: 11,
        enemy: {
            maxHp: 70,
            hitChance: 82,
            portrait: 'assets/images/enemies/shard_sentry.svg',
            portraitScale: 0.9,
            stats: {
                hitChance: 82,
                critChance: 3,
                evasion: 2,
                armor: 2,
                damageMin: 6,
                damageMax: 8,
                attackSpeed: 1.15,
            },
        },
        rules: {
            blocksProgress: false,
        },
    },
];

export function getCombatEncounter(id) {
    if (!id) return null;
    return combatEncounters.find(e => e && e.id === id) || null;
}
