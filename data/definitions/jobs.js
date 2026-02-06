// Job definitions
export const jobs = [
    {
        id: 'foraging',
        name: 'Foraging',
        building: 'Foraging Camp',
        slots: 0,
        assigned: 0,
        // production: Provisions per second per assigned crew
        produces: 'Provisions',
        rate: 0.08
    },
    {
        id: 'water_collection',
        name: 'Water Collection',
        building: 'Water Station',
        slots: 0,
        assigned: 0,
        // production: Water per second per assigned crew
        produces: 'Water',
        rate: 0.105
    },
    // Scrap Collector — unlocked by Establish Base Camp; unlimited assignments once unlocked
    {
        id: 'scrap_collector',
        name: 'Scrap Collector',
        building: 'Base Camp',
        slots: 0,
        assigned: 0,
        produces: 'Metal Parts',
        rate: 0.06,
        // Camp upkeep per assigned crew (per second)
        consumes: [
            { resource: 'Provisions', rate: 0.04 },
            { resource: 'Water', rate: 0.04 },
        ],
        unlimited: false
    },
    // Wire Collector — unlocked by Organize Wire Scavenging upgrade; unlimited assignments once unlocked
    {
        id: 'wire_collector',
        name: 'Wire Collector',
        building: 'Base Camp',
        slots: 0,
        assigned: 0,
        produces: 'Wire',
        rate: 0.07,
        // Camp upkeep per assigned crew (per second)
        consumes: [
            { resource: 'Provisions', rate: 0.04 },
            { resource: 'Water', rate: 0.04 },
        ],
        unlimited: false
    },
    // Scientist — unlocked once the first Field Lab is built
    {
        id: 'scientist',
        name: 'Scientist',
        building: 'Field Lab',
        slots: 0,
        assigned: 0,
        produces: 'Insight',
        rate: 0.03,
        description: 'Conducts research work to generate Insight.'
    }
];
