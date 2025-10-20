export const salvageActions = [
    {
        id: 'scoutSurroundings',
        name: 'Scout Surroundings',
        description: 'Explore the immediate area around the crash site.',
        duration: 15,
        category: 'Exploration',
        isUnlocked: true,
        cost: [ { resource: 'Energy', amount: 15 } ],
        stage: 0, // ADDED: Tracks the current stage of this action
        // MODIFIED: 'unlocks' and 'story' are now in a stages array
        stages: [
            { story: 'foundBerries', unlocks: ['forageFood'] },
            { story: 'foundRiver', unlocks: ['purifyWater'] },
            { story: 'foundCave', unlocks: ['rest'] }
        ]
    },
    {
        id: 'forageFood',
        name: 'Forage for Food',
        description: 'Search the surrounding area for edible plants.',
        duration: 8,
        category: 'Survival',
        isUnlocked: false, // Starts locked
        reward: [ { resource: 'Food Rations', amount: [8, 12] } ]
    },
    {
        id: 'purifyWater',
        name: 'Purify Water',
        description: 'Boil and filter water from a nearby stream.',
        duration: 6,
        category: 'Survival',
        isUnlocked: false, // Starts locked
        reward: [ { resource: 'Clean Water', amount: [10, 15] } ]
    },
    {
        id: 'rest',
        name: 'Rest',
        description: 'Take a break to recover some energy.',
        duration: 10,
        category: 'Survival',
        isUnlocked: false, // Starts locked
        reward: [ { resource: 'Energy', amount: [20, 30] } ]
    },
    {
        id: 'scavengeDebris',
        name: 'Scavenge Debris Field',
        description: 'Search the scattered debris field for basic materials.',
        duration: 3,
        category: 'Materials',
        isUnlocked: true, // Unlocked at the start
        cost: [ { resource: 'Energy', amount: 10 } ],
        reward: [ { resource: 'Scrap Metal', amount: [3, 7] } ]
    },
    {
        id: 'pryOpenHull',
        name: 'Pry Open Hull Section',
        description: 'Use scrap metal as a lever to pry open a sealed section of the ship\'s hull.',
        duration: 10,
        category: 'Materials', // ADDED
		isUnlocked: false,
        cost: [
            { resource: 'Scrap Metal', amount: 10 }
        ],
        unlockThreshold: { resource: 'Scrap Metal', amount: 75 },
        reward: [
            { resource: 'Scrap Metal', amount: [15, 25] },
            { resource: 'Ship Components', amount: [1, 3] }
        ]
    },
	{
        id: 'exploreForwardWreckage',
        name: 'Explore Forward Wreckage',
        description: 'A difficult and draining task. Explore the precarious forward section of the crashed ship.',
        duration: 15,
        category: 'Exploration',
		isUnlocked: false,
        cost: [
            { resource: 'Energy', amount: 50 },
            { resource: 'Food Rations', amount: 10 },
            { resource: 'Clean Water', amount: 10 }
        ],
        reward: [
            { resource: 'Ship Components', amount: [2, 4] }
        ]
    },
    {
        id: 'repairComms',
        name: 'Repair Long-Range Comms',
        description: 'Use salvaged parts to repair the primary communication array.',
        duration: 30,
        category: 'Objectives', // ADDED
		isUnlocked: false,
        cost: [
            { resource: 'Scrap Metal', amount: 150 },
            { resource: 'Ship Components', amount: 20 }
        ],
        unlockThreshold: { resource: 'Ship Components', amount: 15 } 
    }
];