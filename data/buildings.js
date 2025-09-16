// A private, unchangeable "master copy" of the original building data.
const initialBuildings = [
    {
        name: 'Quarry',
        produces: 'Stone',
        rate: 0.1,
        count: 0,
        cost: [{ resource: 'Stone', amount: 10 }]
    },
    {
        name: 'Extractor',
        produces: 'Xylite',
        rate: 0.05,
        count: 0,
        cost: [{ resource: 'Stone', amount: 20 }]
    },
    // --- NEW STORAGE BUILDINGS ---
    {
        name: 'Stone Stockpile',
        count: 0,
        cost: [{ resource: 'Stone', amount: 50 }],
        // The new "effect" property describes what the building does.
        effect: { 
            type: 'storage',      // What kind of effect is it?
            resource: 'Stone',    // What resource does it affect?
            value: 100            // How much capacity does it add?
        }
    },
    {
        name: 'Xylite Silo',
        count: 0,
        cost: [
            { resource: 'Stone', amount: 100 },
            { resource: 'Xylite', amount: 20 }
        ],
        effect: {
            type: 'storage',
            resource: 'Xylite',
            value: 75
        }
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