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
];

// This is the "live" state of buildings that the game will modify.
export let buildings = JSON.parse(JSON.stringify(initialBuildings));

// This function will be called to properly reset the live data from the master copy.
export function resetBuildings() {
    buildings.length = 0;
    buildings.push(...JSON.parse(JSON.stringify(initialBuildings)));
    console.log("Building data has been reset.");
}