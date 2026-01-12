// Job definitions
export const jobs = [
    {
        id: 'foraging',
        name: 'Foraging',
        building: 'Foraging Camp',
        slots: 0,
        assigned: 0,
        // production: Food Rations per second per assigned crew
        produces: 'Food Rations',
        rate: 0.09
    },
    {
        id: 'water_collection',
        name: 'Water Collection',
        building: 'Water Station',
        slots: 0,
        assigned: 0,
        // production: Clean Water per second per assigned crew
        produces: 'Clean Water',
        rate: 0.12
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
        unlimited: false
    }
];
