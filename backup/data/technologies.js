// A private, unchangeable "master copy" of the original technology data.
// Keep this list intentionally small and fully game-relevant (no placeholders).
// NOTE: Several systems currently key off technology *names* (e.g. Colony storage gating,
// Shipyard/Galaxy Map unlocks), so we keep those names stable.
const initialTechnologies = [
    // --- Mining Tech ---
    {
        name: 'Basic Storage',
        duration: 30,
        isResearched: false,
        prerequisites: [],
        category: 'Mining Tech',
        cost: [{ resource: 'Insight', amount: 25 }],
        description: 'Blueprints for simple storage. Unlocks the Crystal Stockpile.'
    },
    {
        name: 'Crystal Analysis',
        duration: 45,
        isResearched: false,
        prerequisites: ['Basic Storage'],
        category: 'Mining Tech',
        cost: [
            { resource: 'Crystal', amount: 1 },
            { resource: 'Insight', amount: 10 }
        ],
        bonus: {
            type: 'production',
            resource: 'Crystal',
            multiplier: 0.10
        },
        description: 'Study lattice structures and fracture patterns to improve extraction efficiency.'
    },
    {
        name: 'Xylite Storage',
        duration: 75,
        isResearched: false,
        prerequisites: ['Crystal Analysis'],
        category: 'Mining Tech',
        cost: [{ resource: 'Insight', amount: 120 }],
        description: 'Containment designs for volatile Xylite. Unlocks the Xylite Silo.'
    },

    // --- Social Tech ---
    {
        name: 'Workforce',
        duration: 60,
        isResearched: false,
        prerequisites: [],
        category: 'Social Tech',
        cost: [{ resource: 'Insight', amount: 40 }],
        description: 'There may be drones in the Cargo Bay that could help with basic tasks — we just need to figure out a way to get there.'
    },
    {
        name: 'Starship Construction',
        duration: 120,
        isResearched: false,
        prerequisites: ['Xylite Storage'],
        category: 'Social Tech',
        cost: [{ resource: 'Insight', amount: 900 }],
        description: 'Unlocks the Shipyard.'
    },
    {
        name: 'Stellar Cartography',
        duration: 180,
        isResearched: false,
        prerequisites: ['Starship Construction'],
        category: 'Social Tech',
        cost: [{ resource: 'Insight', amount: 1100 }],
        description: 'Unlocks the Galaxy Map.'
    }
];

// This is the "live" state of technologies that the game will modify.
export let technologies = JSON.parse(JSON.stringify(initialTechnologies));

// This function will be called to properly reset the live data from the master copy.
export function resetTechnologies() {
    technologies.length = 0;
    technologies.push(...JSON.parse(JSON.stringify(initialTechnologies)));
    console.log("Technology data has been reset.");
}