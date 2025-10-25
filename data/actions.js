export const salvageActions = [
{
    id: 'scoutSurroundings',
    name: 'Scout Surroundings',
    description: 'Explore the immediate area around the crash site.',
    duration: 1,
    category: 'Exploration',
    isUnlocked: false,        // locked at start, unlocked by Attempt Re-entry
    cancelable: false,
    drain: [ 
        { resource: 'Energy', amount: 15 },
        { resource: 'Clean Water', amount: 5 }
    ],
    stage: 0,
    stages: [
        { story: 'foundBerries', unlocks: ['forageFood'], logText: 'You have discovered a source of food. (Click to read)' },
        { story: 'foundRiver', unlocks: ['purifyWater'], logText: 'You have discovered a source of water. (Click to read)' },
        { story: 'foundCave', unlocks: ['rest', 'attemptAlternateAccess'], logText: 'You have discovered a sheltered area. (Click to read)' }
    ]
},
    {
    id: 'attemptReentry',
    name: 'Attempt Re-entry',
    description: 'Try to force a way back into the forward hull to look for survivors or salvage. Risk of collapse and fire.',
    duration: 1,
    category: 'Exploration',
    isUnlocked: true,           // start available (only action at start)
    cancelable: false,
    drain: [
        { resource: 'Energy', amount: 15 },
        { resource: 'Food Rations', amount: 4 },
        { resource: 'Clean Water', amount: 6 },
    ],
    stage: 0,
    stages: [
        {
            story: 'reentryFailed',
            // unlock Scout Surroundings after Attempt Re-entry completes
            unlocks: ['scoutSurroundings'],
            logText: 'A forward section collapsed during your re-entry attempt; the hull is impassable and still burning. (Click to read)'
        }
    ]
    },
    {
        id: 'forageFood',
        name: 'Forage for Food',
        description: 'Search the surrounding area for edible plants.',
        duration: 2,
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
        duration: 2,
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
    duration: 2,
    category: 'Survival',
    isUnlocked: false, // make available by default
    repeatable: true, // allow infinite uses (stages run only once)
    reward: [ { resource: 'Energy', amount: [20, 30] } ],
    // stage kept so completing Rest can unlock follow-ups, but action remains usable
    stage: 0,
    stages: [
        {
            story: null,
            unlocks: [],
            logText: 'Having rested, you feel ready to try a different route back to the ship.'
        }
    ]
    },

    {
        id: 'attemptAlternateAccess',
        name: 'Attempt Alternate Access',
        description: 'With basic needs addressed, try to find an alternate route into the ship — maintenance tunnels, vents or a collapsed access way.',
        duration: 10,
        category: 'Exploration',
        isUnlocked: false,      // unlocked after Rest completes
        cancelable: true,
        drain: [
            { resource: 'Energy', amount: 15 }
        ],
        // single-stage action that triggers a story popup on completion
        stage: 0,
        stages: [
            {
                story: 'alternateAccessFound',
                unlocks: ['scavengeDebris', 'makeCrudePrybar'],
                logText: 'You find indications of a maintenance route that may lead back to the ship.'
            }
        ]
    },
    {
        id: 'scavengeDebris',
        name: 'Scavenge Debris Field',
        description: 'Search the scattered debris field for some basic materials.',
        duration: 3,
        category: 'Materials',
        isUnlocked: false, 
        cost: [ { resource: 'Energy', amount: 10 }, 
				{ resource: 'Food Rations', amount: 6 },
                { resource: 'Clean Water', amount: 7 } 
            ],
		reward: [ { resource: 'Scrap Metal', amount: [3, 5] } ]
    },

        {
        id: 'makeCrudePrybar',
        name: 'Make Crude Prybar',
        description: 'Use scavenged metal to fashion a crude prybar that can be used to lever open hull seams.',
        duration: 4,
        category: 'Crafting',
        isUnlocked: false,
        cancelable: true,
        repeatable: true,
        cost: [
            { resource: 'Scrap Metal', amount: 15 },
            { resource: 'Energy', amount: 10 }
        ],
        reward: [
            { resource: 'Crude Prybar', amount: 1 }
        ],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: ['pryOpenHull'],
                logText: 'You fashion a crude prybar from scavenged metal. This may let you lever open hull seams.'
            }
        ],
    },
    {
        id: 'pryOpenHull',
        name: 'Pry Open Hull Section',
        description: 'Use a prybar and brute force to open a sealed section of the ship\'s hull and get inside.',
        duration: 10,
        category: 'Exploration',
        isUnlocked: false,
        cost: [
            { resource: 'Energy', amount: 60 },
            { resource: 'Crude Prybar', amount: 1 },
            { resource: 'Food Rations', amount: 6 },
            { resource: 'Clean Water', amount: 7 } 
        ],
        stage: 0,
        stages: [
            {
                // show a choice-style popup describing three possible routes
                story: 'enteredShipChoices',
                // unlock three distinct follow-up actions + investigateSound
                unlocks: ['searchSouthCorridor','searchNorthCorridor','investigateBridge','investigateSound'],
                logText: 'You pry open the hull and climb inside. The corridors branch—three routes present themselves. Something else stirs in the dark; you hear a faint sound nearby. (Click to read)'
            }
        ]
    },

       // New one-time action: Investigate Nearby Sound
    {
        id: 'investigateSound',
        name: 'Investigate Nearby Sound',
        description: 'Move quietly toward the faint sound and check whether anyone needs help.',
        duration: 6,
        category: 'Exploration',
        isUnlocked: false,
        cancelable: false,      // one-time, non-cancelable
        drain: [
            { resource: 'Energy', amount: 8 }
        ],
        // immediate survivors reward (one-time)
        reward: [
            { resource: 'Survivors', amount: 2 }
        ],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: 'investigate_sound_found',
                unlocks: [],
                logText: 'You follow the sound and find survivors huddled in a dark alcove. (Click to read)'
            }
        ]
    },

    {
    id: 'searchSouthCorridor',
    name: 'Search South Corridor',
    description: 'Move cautiously down the south corridor. Risk of collapsed panels but may lead to engineering or power nodes.',
    duration: 12,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 20 }
    ],
    reward: [
        { resource: 'Ship Components', amount: [6, 12] },
        { resource: 'Insight', amount: [1, 2] }
    ],
    stage: 0,
    stages: [
        {
            story: 'south_found_power',
            // completing south corridor should allow restoring emergency power
            unlocks: ['restoreEmergencyPower'],
            logText: 'You find damaged power conduits and salvageable components that could be used to get emergency lighting back online. (Click to read)'
        }
    ]
},

{
    id: 'searchNorthCorridor',
    name: 'Search North Corridor',
    description: 'Sweep the north corridor. Narrow access, possible armory or supply caches — higher risk, higher reward.',
    duration: 14,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 24 }
    ],
    reward: [
        { resource: 'Scrap Metal', amount: [8, 14] },
        { resource: 'Survivors', amount: 1 } 
    ],
    stage: 0,
    stages: [
        {
            story: 'north_found_armory',
            // completing north corridor may unlock crafting options / tools
            unlocks: ['makeCrudePrybar','scavengeDebris'],
            logText: 'In a collapsed storage alcove you find a cache of tool parts and fasteners — useful for crafting. (Click to read)'
        }
    ]
},
{
        id: 'investigateBridge',
        name: 'Investigate Bridge',
        description: 'Head toward the bridge. High priority for comms and navigation, but likely complex and risky.',
        duration: 16,
        category: 'Exploration',
        isUnlocked: false,
        cancelable: true,
        drain: [
            { resource: 'Energy', amount: 28 }
        ],
        cost: [
            { resource: 'Ship Components', amount: 6 }
        ],
        reward: [
            { resource: 'Insight', amount: [2, 4] },
            { resource: 'Survivors', amount: [0, 1] }
        ],
        stage: 0,
        stages: [
            {
                story: 'bridge_dark',
                unlocks: ['restoreEmergencyPower'],
                logText: 'You make for the bridge; it is dark and cluttered but may hold crucial systems. (Click to read)'
            }
        ]
    },
	
];