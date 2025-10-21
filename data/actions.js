export const salvageActions = [
	{
        id: 'scoutSurroundings',
        name: 'Scout Surroundings',
        description: 'Explore the immediate area around the crash site.',
        duration: 15,
        category: 'Exploration',
        isUnlocked: true,
        // MODIFIED: Changed from 'cost' to 'drain'
        drain: [ { resource: 'Energy', amount: 15 },
				 { resource: 'Clean Water', amount: 5 }
		],
        stage: 0,
        stages: [
            { story: 'foundBerries', unlocks: ['forageFood'], logText: 'You have discovered a source of food. (Click to read)' },
            { story: 'foundRiver', unlocks: ['purifyWater'], logText: 'You have discovered a source of water. (Click to read)' },
            { story: 'foundCave', unlocks: ['rest', 'scavengeDebris'], logText: 'You have discovered a sheltered area. (Click to read)' }
        ]
    },
    {
        id: 'forageFood',
        name: 'Forage for Food',
        description: 'Search the surrounding area for edible plants.',
        duration: 8,
        category: 'Survival',
        isUnlocked: false,
        // ADDED: This action now drains Energy over time
        drain: [
            { resource: 'Energy', amount: 5 }
        ],
        reward: [ 
            { resource: 'Food Rations', amount: [8, 12] }
        ]
    },
    {
        id: 'purifyWater',
        name: 'Purify Water',
        description: 'Boil and filter water from a nearby stream.',
        duration: 6,
        category: 'Survival',
        isUnlocked: false,
        // ADDED: This action now drains Energy over time
        drain: [
            { resource: 'Energy', amount: 5 }
        ],
        reward: [ 
            { resource: 'Clean Water', amount: [10, 15] }
        ]
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
        isUnlocked: false, // Unlocked at the start
        cost: [ { resource: 'Energy', amount: 10 }, 
				{ resource: 'Food Rations', amount: 2 }
		],
		
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
        duration: 60,
        category: 'Exploration',
        // MODIFIED: Changed 'cost' to 'drain'. The amount is the TOTAL that will be drained over the duration.
        drain: [
            { resource: 'Energy', amount: 50 },
            { resource: 'Food Rations', amount: 10 },
            { resource: 'Clean Water', amount: 10 }
        ],
        reward: [
            { resource: 'Ship Components', amount: [5, 10] }
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