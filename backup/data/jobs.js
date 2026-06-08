// Job definitions
export const jobs = [
    {
        id: 'foraging',
        name: 'Forager',
        building: 'Foraging Camp',
        slots: 0,
        assigned: 0,
        // production: Provisions per second per assigned crew
        produces: 'Provisions',
        rate: 0.08,
        description: 'Gather edible supplies and basic camp provisions.'
    },
    {
        id: 'water_collection',
        name: 'Water Collector',
        building: 'Water Station',
        slots: 0,
        assigned: 0,
        // production: Water per second per assigned crew
        produces: 'Water',
        rate: 0.105,
        description: 'Collect and process clean water for the camp.'
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
        description: 'Salvage useful metal parts from wreckage and debris.',
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
        description: 'Recover wire and cabling for repairs and construction.',
        // Camp upkeep per assigned crew (per second)
        consumes: [
            { resource: 'Provisions', rate: 0.04 },
            { resource: 'Water', rate: 0.04 },
        ],
        unlimited: false
    },

    // Labs Scavenger — unlocked when Chemicals are first discovered; unlimited assignments once unlocked
    {
        id: 'labs_scavenger',
        name: 'Labs Scavenger',
        building: 'Base Camp',
        slots: 0,
        assigned: 0,
        produces: 'Chemicals',
        rate: 0.02,
        description: 'Scavenge lab reagents and usable compounds from the wreckage.',
        consumes: [
            { resource: 'Provisions', rate: 0.03 },
            { resource: 'Water', rate: 0.03 },
        ],
        unlimited: false
    },

    // Textile Salvager — unlocked when Fabric is first discovered; unlimited assignments once unlocked
    {
        id: 'textile_salvager',
        name: 'Textile Salvager',
        building: 'Base Camp',
        slots: 0,
        assigned: 0,
        produces: 'Fabric',
        rate: 0.025,
        description: 'Recover usable cloth and textiles for repairs and shelter building.',
        consumes: [
            { resource: 'Provisions', rate: 0.03 },
            { resource: 'Water', rate: 0.03 },
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
