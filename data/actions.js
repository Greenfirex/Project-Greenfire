export const salvageActions = [
{
    id: 'scoutSurroundings',
    name: 'Scout Surroundings',
    description: 'Explore the immediate area around the crash site.',
    duration: 1,
    category: 'Exploration',
    isUnlocked: false,        // locked at start, unlocked by Attempt Re-entry
    cancelable: false,
    suppressGenericLog: true,
    drain: [ 
        { resource: 'Energy', amount: 15 },
        { resource: 'Clean Water', amount: 5 }
    ],
    stage: 0,
    stages: [
        // new order: sheltered area (rest) first, then food, then water/alternate access
        { story: 'foundCave', unlocks: ['rest'], logText: 'You have discovered a sheltered area — someone can rest here. (Click to read)' },
        { story: 'foundBerries', unlocks: ['forageFood'], logText: 'You have discovered a source of food. (Click to read)' },
        { story: 'foundRiver', unlocks: ['purifyWater', 'attemptAlternateAccess'], logText: 'You have discovered a source of water. (Click to read)' },   
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
            logText: 'A forward section collapsed during your re-entry attempt; the hull is impassable and still burning. (Click to read)',
            suppressGenericLog: true
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
            { resource: 'Food Rations', amount: [20, 25] }
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
            { resource: 'Clean Water', amount: [30, 50] }
        ]
    },
    {
    id: 'rest',
    name: 'Rest',
    description: 'Take a quick break to recover some energy.',
    duration: 2,
    category: 'Survival',
    isUnlocked: false, // make available by default
    repeatable: true, // allow infinite uses (stages run only once)
    reward: [ { resource: 'Energy', amount: [40, 60] } ],
    // stage kept so completing Rest can unlock follow-ups, but action remains usable
    stage: 0,
    stages: [
        {
            story: null,
            unlocks: [],
            logText: 'Having rested, you feel ready to press on. Maybe there\'s another way into the ship. Lets try to find it.'
        }
    ]
    },

    {
        id: 'attemptAlternateAccess',
        name: 'Attempt Alternate Access',
        description: 'Now that you have scouted the area around the crash site, try to find an alternate route into the ship — maintenance tunnels, vents or a collapsed access way.',
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
                logText: 'You find indications of a maintenance route that may lead back to the ship.',
                suppressGenericLog: true
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
		reward: [ { resource: 'Scrap Metal', amount: [9, 18] } ]
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
                logText: 'You pry open the hull and climb inside. The corridors branch—three routes present themselves. Something else stirs in the dark; you hear a faint sound nearby. (Click to read)',
                suppressGenericLog: true
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
        cancelable: false,        
        drain: [
            { resource: 'Energy', amount: 8 }
        ],
        reward: [
            { resource: 'Survivors', amount: 2 }
        ],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: 'investigate_sound_found',
                // After investigating the sound the player can then establish a base camp
                unlocks: ['establishBaseCamp'],
                logText: 'You follow the sound and find survivors huddled in a dark alcove. (Click to read)',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'establishBaseCamp',
        name: 'Establish Base Camp',
        description: 'Set up a rudimentary base to organize survivors, assign work and improve coordination.',
        duration: 10,
        category: 'Survival', // <-- ensure this is in the Survival category
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Scrap Metal', amount: 12 }
        ],
        drain: [
            { resource: 'Energy', amount: 6 }
        ],
        reward: [],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: 'basecamp_established', // matches new storyEvents entry
                unlocks: [],
                logText: 'You establish a small base camp. Survivors can be organized here. (Click to read)',
                suppressGenericLog: true
            }
        ]
    },

    {
    id: 'searchSouthCorridor',
    name: 'Search South Corridor',
    description: 'Move cautiously down the south corridor. Risk of collapsed panels but this way should lead to junction leading to cafeteria and crew quarters.',
    duration: 12,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 40 }
    ],
    reward: [],
    hideRewardPreview: true,
    stage: 0,
    stages: [
        {
            story: 'south_corridor_entry',
            // completing south corridor should allow restoring emergency power
            unlocks: ['exploreCafeteria', 'checkCrewQuarters'],
            logText: 'You push through a buckled corridor and gain access to several side compartments — a mess hall and crew quarters lie ahead. Explore them to learn more. (Click to read)'
        }
    ]
},

{
    id: 'exploreCafeteria',
    name: 'Explore Cafeteria',
    description: 'Search the ship\'s mess hall for usable food and clean water among the wreckage.',
    duration: 6,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 16 }
    ],
    reward: [
        { resource: 'Food Rations', amount: [15, 25] },
        { resource: 'Clean Water', amount: [20, 40] },
        { resource: 'Survivors', amount: 2 }
    ],
    hideRewardPreview: true,
    stage: 0,
    stages: [
        {
            story: 'south_explore_cafeteria',
            unlocks: ['salvageCookingEquipment'],
            logText: 'In the mess hall you find preserved rations and salvageable water among the wreckage. (Click to read)'
        }
    ]
},


{
    id: 'checkCrewQuarters',
    name: 'Check Crew Quarters',
    description: 'Search the crew quarters for supplies, personal kits, and anything that might help survivors or crafts.',
    duration: 5,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 12 }
    ],
    reward: [   
        { resource: 'Fabric', amount: [1, 3] }
    ],
    hideRewardPreview: true,
    stage: 0,
    stages: [
        {
            story: 'south_check_quarters',
            unlocks: ['makeTents', 'collectFabric'],
            logText: 'You scavenge bunks and lockers; you find a few useful parts and personal items that might help survivors feel safer. (Click to read)'
        }
    ]
},

{
    id: 'collectFabric',
    name: 'Collect Fabric',
    description: 'Search wreckage and clothing stores for scraps of fabric useful for making tents and repairs.',
    duration: 3,
    category: 'Materials',
    isUnlocked: false,
    cancelable: true,
    repeatable: true,
    drain: [
        { resource: 'Energy', amount: 12 }
    ],
    reward: [
        { resource: 'Fabric', amount: [1, 2] }
    ],
    stage: 0,
    stages: [
        {
            story: null,
            unlocks: [],
            logText: 'You gather usable fabric scraps from bunks and upholstery. Useful for shelter work.'
        }
    ]
},





{
    id: 'searchNorthCorridor',
    name: 'Search: North Corridor',
    description: 'Explore the northern hallways. The corridor opens toward a cluster of labs and also ships power core — you might find supplies or survivors.',
    duration: 15,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 30 }
    ],
    reward: [
         { resource: 'Survivors', amount: 1 }
    ],
    hideRewardPreview: true,
    stages: [
        {
            story: 'north_corridor_found_branches',
            unlocks: ['searchLabs', 'searchPowerCore'],
            logText: 'You find a corridor leading north — it splits toward labs and a power core. On your way you found a survivor. You send him back to the base camp. (Click to read)'
        }
    ]
},

{
    id: 'searchPowerCore',
    name: 'Search: Power Core',
    description: 'Follow the corridor to the ship\'s power core. The access is heavily reinforced — brute force alone might not be enough.',
    duration: 8,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 20 }
    ],
    // no top-level reward; success is handled by completing stage 2
    stage: 0,
    stages: [
        {
            // first attempt: you reach the door and try to force it open with crude tools
            story: 'powercore_locked_attempt',
            unlocks: [],
            logText: 'You reach a set of reinforced, locked doors protecting the power core. You try levering them with crude tools but the doors hold. With the ship without power, there is nothing to release the lockmechanism. (Click to read)'
            // no stage-level cost here — this is the reconnaissance / failed attempt stage
        },
        {
            // second attempt: requires and consumes a makeshift explosive to blast the lock
            story: 'powercore_breached',
            unlocks: ['restoreEmergencyPower'], // whatever follows opening the core
            logText: 'You rig a makeshift explosive and set it against the lock. The blast blows the seal and you can access the power core. (Click to read)',
            // stage-specific cost: this stage requires 1 Makeshift Explosive and will consume it on completion
            cost: [
                { resource: 'Makeshift Explosive', amount: 1 }
            ],
            reward: [
                { resource: 'Power Cells', amount: [1,2] },
                { resource: 'Ship Components', amount: [2,4] }
            ]
        }
    ]
},

{
    id: 'searchLabs',
    name: 'Search: Labs',
    description: 'Search the research labs for experimental components and data caches. Risk: hazardous environment and unstable equipment.',
    duration: 6,
    category: 'Exploration',
    isUnlocked: false,
    cancelable: true,
    drain: [
        { resource: 'Energy', amount: 14 },
        { resource: 'Food Rations', amount: 6 }
    ],
    reward: [
        { resource: 'Chemicals', amount: 3 },
        { resource: 'Survivors', amount: 2 }
    ],
    hideRewardPreview: true,
    stages: [
        {
            story: 'found_labs_cache',
            unlocks: ['installPurificationUnit', 'collectChemicals'],
            logText: 'You checked the labs and found the chief lab technician and his assistant. Also some intact equipment and chemical supplies. Laboratory seems to be in better shape than other sections of the ship. (Click to read)'
        }
    ]
},

{
    id: 'collectChemicals',
    name: 'Collect Chemicals',
    description: 'Gather chemical reagents and lab residues from the surrounding area. Repeatable — yields small amounts of Chemicals.',
    duration: 4,
    category: 'Materials',
    isUnlocked: false,
    cancelable: true,
    repeatable: true,
    drain: [
        { resource: 'Energy', amount: 8 }
    ],
    reward: [
        { resource: 'Chemicals', amount: [1, 3] }
    ],
    hideRewardPreview: false,
    stage: 0,
    stages: [
        {
            story: null,
            unlocks: [],
            logText: 'You collect some useful reagents and chemical scraps from lab waste and broken containers.'
        }
    ]
},

{
    id: 'assembleMakeshiftExplosive',
    name: 'Assemble Makeshift Explosive',
    description: 'Combine salvaged chemicals and scrap into a makeshift explosive. Dangerous work — requires caution and materials.',
    duration: 4,
    category: 'Crafting',
    isUnlocked: false,               
    cancelable: true,
    cost: [
        { resource: 'Chemicals', amount: 5 },
        { resource: 'Scrap Metal', amount: 8 },
        { resource: 'Clean Water', amount: 12 }
    ],
    reward: [
        { resource: 'Makeshift Explosive', amount: 1 }
    ],
    stage: 0,
    stages: [
        {
            story: 'assembled_explosive',
            unlocks: [],
            logText: 'You carefully combine reagents and scrap into a crude explosive device. Handle with care.'
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
            { resource: 'Survivors', amount: [0, 1] }
        ],
        hideRewardPreview: true,
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