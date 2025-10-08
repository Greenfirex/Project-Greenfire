// A private, unchangeable "master copy" of the original building data.
const initialBuildings = [
    {
        name: 'Quarry',
        produces: 'Stone',
        rate: 0.1,
        count: 0,
        cost: [{ resource: 'Stone', amount: 10 }],
        description: 'Construct a Quarry to begin automatic Stone extraction.',
        isUnlocked: true // Available from the start
    },
    {
        name: 'Extractor',
        produces: 'Xylite',
        rate: 0.05,
        count: 0,
        cost: [{ resource: 'Stone', amount: 20 }],
        description: 'Build an Extractor to mine the rare resource Xylite.',
        isUnlocked: false // Will be unlocked when Xylite is discovered
    },
    {
        name: 'Stone Stockpile',
        count: 0,
        cost: [{ resource: 'Stone', amount: 50 }],
        effect: { type: 'storage', resource: 'Stone', value: 100 },
        description: 'Increases the maximum storage capacity for Stone.',
        isUnlocked: false // Will be unlocked by research
    },
    {
        name: 'Xylite Silo',
        count: 0,
        cost: [{ resource: 'Stone', amount: 100 }, { resource: 'Xylite', amount: 20 }],
        effect: { type: 'storage', resource: 'Xylite', value: 75 },
        description: 'Construct a high-tech silo to increase Xylite storage.',
        isUnlocked: false // Will be unlocked by research
    },
    {
        name: 'Laboratory',
		produces: 'Insight', // ADD THIS
		rate: 0.1,           // ADD THIS (0.1 per second)
		count: 0,
		cost: [{ resource: 'Stone', amount: 15 }],
		description: 'A basic facility that generates Insight required for scientific research.',
		isUnlocked: false
    }
];

// This is the "live" state of buildings that the game will modify.
export let buildings = JSON.parse(JSON.stringify(initialBuildings));

// This function will be called to properly reset the live data from the master copy.
export function resetBuildings() {
    buildings.length = 0;
    buildings.push(...JSON.parse(JSON.stringify(initialBuildings)));
    console.log("Building data has been reset.");
}