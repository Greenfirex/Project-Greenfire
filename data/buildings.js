// A private, unchangeable "master copy" of the original building data.
const initialBuildings = [
    {
        name: 'Quarry',
        produces: 'Stone',
        rate: 0.1,
        count: 0,
        cost: [{ resource: 'Stone', amount: 10 }],
        costMultiplier: 1.15, // Costs 15% more each time
        description: 'Construct a Quarry to begin automatic Stone extraction.',
        isUnlocked: true 
    },
    {
        name: 'Extractor',
        produces: 'Xylite',
        rate: 0.05,
        count: 0,
        cost: [{ resource: 'Stone', amount: 20 }],
        costMultiplier: 1.15,
        description: 'Build an Extractor to mine the rare resource Xylite.',
        isUnlocked: false 
    },
    {
        name: 'Stone Stockpile',
        count: 0,
        cost: [{ resource: 'Stone', amount: 50 }],
        costMultiplier: 1.25, // Storage can scale a bit faster
        effect: { type: 'storage', resource: 'Stone', value: 100 },
        description: 'Increases the maximum storage capacity for Stone.',
        isUnlocked: false
    },
    {
        name: 'Xylite Silo',
        count: 0,
        cost: [{ resource: 'Stone', amount: 100 }, { resource: 'Xylite', amount: 20 }],
        costMultiplier: 1.25,
        effect: { type: 'storage', resource: 'Xylite', value: 75 },
        description: 'Construct a high-tech silo to increase Xylite storage.',
        isUnlocked: false
    },
    {
        name: 'Laboratory',
        produces: 'Insight',
        rate: 0.1,
        count: 0,
        cost: [{ resource: 'Stone', amount: 50 }],
        costMultiplier: 1.15,
        description: 'A basic facility that generates Insight required for scientific research.',
        isUnlocked: false
    },

    // For Crash Site builds (locked until survivors are found / investigateSound completes)
    {
        name: 'Foraging Camp',
        // This building unlocks a "Foraging" job slot per built camp.
        effect: { type: 'job', jobId: 'foraging' },
        count: 0,
        cost: [{ resource: 'Scrap Metal', amount: 8 }],
        costMultiplier: 1.3,
        description: 'A basic camp where survivors can be organized to forage for food.',
        isUnlocked: false
    },
    {
        name: 'Water Station',
        // This building unlocks a "Water Collection" job slot per built station.
        effect: { type: 'job', jobId: 'water_collection' },
        count: 0,
        cost: [{ resource: 'Scrap Metal', amount: 10 }],
        costMultiplier: 1.3,
        description: 'A makeshift station to collect and purify water.',
        isUnlocked: false
    },
    {
        name: 'Food Larder',
        count: 0,
        cost: [{ resource: 'Scrap Metal', amount: 15 }, { resource: 'Fabric', amount: 4 }],
        costMultiplier: 1.2,
        effect: { type: 'storage', resource: 'Food Rations', value: 100 },
        description: 'A basic insulated larder that increases food storage capacity.',
        isUnlocked: false
    },
    {
        name: 'Water Reservoir',
        count: 0,
        cost: [{ resource: 'Scrap Metal', amount: 18 }],
        costMultiplier: 1.2,
        effect: { type: 'storage', resource: 'Clean Water', value: 120 },
        description: 'A small covered reservoir that increases water storage capacity.',
        isUnlocked: false
    },
    {
        name: 'Rain Tarp',
        // Passive effect: yields Clean Water per second per built rain tarp
        effect: { type: 'passive', resource: 'Clean Water', rate: 0.02 },
        count: 0,
        cost: [{ resource: 'Fabric', amount: 6 }, { resource: 'Scrap Metal', amount: 6 }],
        costMultiplier: 1.2,
        description: 'Tarped catchments and troughs that funnel rainwater into storage.',
        isUnlocked: false
    }
];

// This is the "live" state of buildings that the game will modify.
export let buildings = JSON.parse(JSON.stringify(initialBuildings));

export function getInitialBuildings() {
    return JSON.parse(JSON.stringify(initialBuildings));
}

// This function will be called to properly reset the live data from the master copy.
export function resetBuildings() {
    buildings.length = 0;
    buildings.push(...JSON.parse(JSON.stringify(initialBuildings)));
    console.log("Building data has been reset.");
}