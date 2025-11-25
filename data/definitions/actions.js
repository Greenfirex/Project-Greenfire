// Duplicate leading block removed during automated rename of resource 'Energy' -> 'Stamina'.
const initialSalvageActions = [
    {
            id: 'scoutSurroundings',
            name: 'Scout Surroundings',
            description: 'Explore the immediate area around the crash site.',
            duration: 5,
            category: 'Exploration',
            isUnlocked: false,        // locked at start, unlocked by Attempt Re-entry
            cancelable: false,
            suppressGenericLog: true,
            drain: [ 
                { resource: 'Stamina', amount: 13 },
                { resource: 'Food Rations', amount: 4 },
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
            name: 'Go back inside',
            description: 'Try to force a way back into the forward hull to look for survivors or salvage. Risk of collapse and fire.',
            duration: 1,
            category: 'Exploration',
            isUnlocked: true,           // start available (only action at start)
            cancelable: false,
            drain: [
                { resource: 'Stamina', amount: 25 },
                { resource: 'Food Rations', amount: 9 },
                { resource: 'Clean Water', amount: 15 },
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
                // ADDED: This action now drains Stamina over time
                drain: [
                    { resource: 'Stamina', amount: 5 }
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
                // ADDED: This action now drains Stamina over time
                drain: [
                    { resource: 'Stamina', amount: 5 }
                ],
                reward: [ 
                    { resource: 'Clean Water', amount: [30, 50] }
                ]
            },
            {
            id: 'rest',
            name: 'Rest',
            description: 'Take a quick break to recover some stamina.',
            duration: 2,
            category: 'Survival',
            isUnlocked: false, // make available by default
            repeatable: true, // allow infinite uses (stages run only once)
            reward: [ { resource: 'Stamina', amount: [40, 60] } ],
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
                   { resource: 'Stamina', amount: 25 },
                   { resource: 'Food Rations', amount: 15 },
                   { resource: 'Clean Water', amount: 20 }
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
                drain: [ { resource: 'Stamina', amount: 10 }, 
                        { resource: 'Food Rations', amount: 6 },
                        { resource: 'Clean Water', amount: 7 } 
                    ],
                reward: [
                    { resource: 'Scrap Metal', amount: [9, 18] },
                    // 20% chance to find 1 Wire
                    { resource: 'Wire', amount: 1, chance: 0.2 }
                ]
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
                showUnlocks: false,
                cost: [
                    { resource: 'Scrap Metal', amount: 15 }
                ],
                drain: [
                    { resource: 'Stamina', amount: 10 },
                    { resource: 'Food Rations', amount: 3 },
                    { resource: 'Clean Water', amount: 4 }
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
                drain: [
                    { resource: 'Stamina', amount: 60 },
                    { resource: 'Food Rations', amount: 6 },
                    { resource: 'Clean Water', amount: 7 } 
                ],
                cost: [
                    { resource: 'Crude Prybar', amount: 1 }
                ],
                reward: [],
                hideRewardPreview: true,
                stage: 0,
                stages: [
                    {
                        // show a choice-style popup describing three possible routes
                        story: 'enteredShipChoices',
                        // unlock three distinct follow-up actions + investigateSound
                        unlocks: ['searchSouthCorridor','searchNorthCorridor','investigateBridge','investigateSound','stripWiring'],
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
                    { resource: 'Stamina', amount: 8 }
                ],
                reward: [
                    { resource: 'Survivors', amount: 3 }
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
                    { resource: 'Scrap Metal', amount: 25 },
                    { resource: 'Wire', amount: 12 }
                ],
                drain: [
                    { resource: 'Stamina', amount: 28 },
                    { resource: 'Food Rations', amount: 7 },
                    { resource: 'Clean Water', amount: 9 }
                ],
                reward: [],
                // Tooltip-only: some unlocks are applied elsewhere in game code; expose them here
                // for the tooltip so players can see what this action will ultimately enable.
                // Use internal ids (job ids, building names/ids or section ids) or plain labels.
                tooltipUnlocks: ['crewManagementSection', 'scrap_collector'],
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
            name: 'Search: South Corridor',
            description: 'Move cautiously down the south corridor. Risk of collapsed panels but this way should lead to junction leading to cafeteria and crew quarters.',
            duration: 12,
            category: 'Exploration',
            isUnlocked: false,
            cancelable: true,
            drain: [
                { resource: 'Stamina', amount: 40 },
                { resource: 'Food Rations', amount: 15 },
                { resource: 'Clean Water', amount: 19 }
            ],
            reward: [],
            hideRewardPreview: true,
            stage: 0,
            stages: [
                {
                    story: 'south_corridor_entry',
                    // completing south corridor should allow restoring emergency power
                    unlocks: ['exploreCafeteria', 'checkCrewQuarters'],
                    logText: 'You push through a buckled corridor and gain access to several side compartments — a mess hall and crew quarters lie ahead. Explore them to learn more. (Click to read)',
                    suppressGenericLog: true
                }
            ]
        },

        {
            id: 'stripWiring',
            name: 'Strip Wiring',
            description: 'Harvest salvageable wire from ruptured conduits, trays and damaged panels inside the wreck.',
            duration: 4,
            category: 'Materials',
            isUnlocked: false, // unlocked after entering the ship (Pry Open Hull)
            cancelable: true,
            repeatable: true,
            drain: [
                { resource: 'Stamina', amount: 12 },
                { resource: 'Food Rations', amount: 2 },
                { resource: 'Clean Water', amount: 3 }
            ],
            reward: [
                { resource: 'Wire', amount: [6, 12] }
            ],
            hideRewardPreview: false,
            stage: 0,
            stages: [
                {
                    story: null,
                    unlocks: [],
                    logText: 'You pull lengths of intact cable from shattered trays and scorched panels. Some insulation is charred, but most of the copper is usable.'
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
                { resource: 'Stamina', amount: 16 }
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
                { resource: 'Stamina', amount: 12 }
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
                { resource: 'Stamina', amount: 12 },
                { resource: 'Food Rations', amount: 2 },
                { resource: 'Clean Water', amount: 3 }
            ],
            reward: [
                { resource: 'Fabric', amount: [2, 3] }
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
                { resource: 'Stamina', amount: 30 }
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
            // no top-level reward; success is handled by completing stage 2
            stage: 0,
            stages: [
                {
                    // first attempt: you reach the door and try to force it open with crude tools
                    story: 'powercore_locked_attempt',
                    unlocks: [],
                    description: 'Follow the corridor to the ship\'s power core. The access is heavily reinforced — brute force alone might not be enough.',
                    logText: 'You reach a set of reinforced, locked doors protecting the power core. You try levering them with crude tools but the doors hold. With the ship without power, there is nothing to release the lockmechanism. (Click to read)',
                    suppressGenericLog: true,
                    drain: [
                        { resource: 'Stamina', amount: 20 },
                        { resource: 'Food Rations', amount: 25 },
                        { resource: 'Clean Water', amount: 25 },
            ],
                },
                {
                    // second attempt: requires and consumes a makeshift explosive to blast the lock
                    story: 'powercore_breached',
                    unlocks: ['restoreEmergencyPower'], // whatever follows opening the core
                    description: 'Return to the power core with makeshift explosives and breach the reinforced lock. Dangerous — but necessary to access the core systems.',
                    logText: 'Now that all survivors are accounted for, you risk breaching the power core with the explosive. The blast blows the seal and you can access the core systems. (Click to read)',
                    // stage-specific cost: this stage requires 3 Makeshift Explosives and will consume them on completion
                    cost: [
                        { resource: 'Makeshift Explosive', amount: 3 }
                    ],
                    drain: [
                        { resource: 'Stamina', amount: 50 },
                        { resource: 'Food Rations', amount: 35 },
                        { resource: 'Clean Water', amount: 30 },
                    ],
                    reward: [
                        { resource: 'Power Cells', amount: 3 },
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
                { resource: 'Stamina', amount: 24 },
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
                    unlocks: ['collectChemicals'],
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
                { resource: 'Stamina', amount: 12 },
                { resource: 'Food Rations', amount: 7 },
                { resource: 'Clean Water', amount: 6 }
            ],
            reward: [
                { resource: 'Chemicals', amount: [2, 3] }
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

        // New engineering action: restore emergency power after breaching the power core
        {
            id: 'restoreEmergencyPower',
            name: 'Restore Emergency Power',
            description: 'Route recovered cells into emergency busses and patch wiring to bring minimal ship systems online.',
            duration: 10,
            category: 'Exploration',
            isUnlocked: false, // unlocked by Search: Power Core (breached)
            cancelable: true,
            cost: [
                { resource: 'Power Cells', amount: 1 },
                { resource: 'Wire', amount: 25 }
            ],
            drain: [
                { resource: 'Stamina', amount: 28 },
                { resource: 'Food Rations', amount: 5 },
                { resource: 'Clean Water', amount: 6 }
            ],
            reward: [],
            hideRewardPreview: true,
            stage: 0,
            stages: [
                {
                    story: 'emergency_power_restored',
                    unlocks: [],
                    logText: 'You tie in power cells and patch lines. Emergency lighting flickers to life; lifts and ventilation hum weakly. (Click to read)',
                    suppressGenericLog: true
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
            repeatable: true,
            maxUses: 3,
            uses: 0,
            cost: [
                { resource: 'Chemicals', amount: 5 },
                { resource: 'Scrap Metal', amount: 8 },
                { resource: 'Wire', amount: 14 }
            ],
            drain: [
                { resource: 'Stamina', amount: 13 },
                { resource: 'Food Rations', amount: 3 },
                { resource: 'Clean Water', amount: 3 }
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
                // Base description will be stage-adaptive; we swap logic so if emergency power is already restored
                // when player first clicks, they skip directly to the powered stage.
                description: 'Assess access to the command deck. If power is offline the lift will be inert; with emergency power restored you can ride up.',
                duration: 8,
                category: 'Exploration',
                isUnlocked: false,
                cancelable: true,
                hideRewardPreview: true,
                stage: 0,
                stages: [
                    {
                        // Stage 1: Scout to the bridge access — discover an inaccessible lift without power
                        story: 'bridge_lift_no_power',
                        unlocks: [],
                        description: 'You reach the bridge access. Without emergency power the heavy lift is inert and blocks progress.',
                        drain: [
                            { resource: 'Stamina', amount: 15 },
                            { resource: 'Clean Water', amount: 6 },
                            { resource: 'Food Rations', amount: 4 }
                        ],
                        logText: 'You reach the bridge access. A heavy lift blocks the way — dead without power. Blasting through is not an option. (Click to read)',
                        suppressGenericLog: true
                    },
                    {
                        // Stage 2: Return after restoring emergency power (narrative follow-up)
                        story: 'bridge_after_power',
                        unlocks: ['fixLongRangeRadio'],
                        description: 'Emergency power is online: the lift cycles, granting limited access to the bridge. You can ride up and assess the situation.',
                        drain: [
                            { resource: 'Stamina', amount: 25 },
                            { resource: 'Clean Water', amount: 8 },
                            { resource: 'Food Rations', amount: 7 }
                        ],
                        logText: 'You reach the command deck. The bridge is a tomb — everyone you find is gone, and most equipment is beyond saving. One gutted comms panel might be salvageable. Your only chance is to scavenge it and try to rewire it to your last power cell to hail Starfleet Command. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },
            // New exploration lead revealed after improving base camp
            {
                id: 'investigateDistantSmoke',
                name: 'Investigate Distant Smoke',
                description: 'Head toward a pillar of smoke seen on the horizon — could be an escape pod landing site with survivors.',
                duration: 10,
                category: 'Exploration',
                isUnlocked: false,
                cancelable: true,
                hideRewardPreview: true,
                drain: [ { resource: 'Stamina', amount: 22 } ],
                reward: [ { resource: 'Survivors', amount: 2 } ],
                stage: 0,
                stages: [
                    {
                        story: 'investigate_distant_smoke',
                        unlocks: ['decryptRadioMessage'],
                        logText: 'You find two survivors at an escape pod site. Returning to camp, you learn the radio received an encrypted signal. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },
            {
                id: 'decryptRadioMessage',
                name: 'Decrypt Radio Message',
                description: 'Use your command-level clearance and officer training to decrypt the incoming signal from the repaired long-range radio.',
                duration: 8,
                category: 'Exploration',
                isUnlocked: false,
                cancelable: true,
                hideRewardPreview: true,
                drain: [
                    { resource: 'Stamina', amount: 18 },
                    { resource: 'Clean Water', amount: 5 },
                    { resource: 'Food Rations', amount: 4 }
                ],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: 'decrypt_radio_message',
                        unlocks: ['checkCaptainsQuarters'],
                        logText: 'You decrypt the transmission from Starfleet Command. The news is grim — and there are classified orders. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },
            {
                id: 'checkCaptainsQuarters',
                name: "Check Captain's Quarters",
                description: "Search the captain's quarters for the encrypted data drive mentioned in the classified transmission from Command.",
                duration: 10,
                category: 'Exploration',
                isUnlocked: false,
                cancelable: true,
                hideRewardPreview: true,
                tooltipUnlocks: ['encryptedDriveSection', 'colonySection'],
                drain: [
                    { resource: 'Stamina', amount: 25 },
                    { resource: 'Clean Water', amount: 7 },
                    { resource: 'Food Rations', amount: 6 }
                ],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: 'chapter2_intro',
                        unlocks: [],
                        logText: 'You search the captain\'s quarters and recover the encrypted drive. Chapter II begins. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },
            {
                id: 'fixLongRangeRadio',
                name: 'Fix Long-Range Radio',
                description: 'Scavenge the damaged comms panel and rewire it to a power cell using insulated fabric and salvaged wiring to attempt contacting Starfleet Command.',
                duration: 12,
                category: 'Exploration',
                isUnlocked: false,
                cancelable: true,
                hideRewardPreview: true,
                drain: [ { resource: 'Stamina', amount: 50 } ],
                cost: [
                    { resource: 'Power Cells', amount: 1 },
                    { resource: 'Wire', amount: 25 },
                    { resource: 'Fabric', amount: 6 }
                ],
                stage: 0,
                stages: [
                    {
                        story: 'comms_fixed_distress',
                        unlocks: [],
                        logText: '',
                        suppressGenericLog: true
                    }
                ]
            },
        ];

// Live actions that will be mutated during gameplay
export let salvageActions = JSON.parse(JSON.stringify(initialSalvageActions));

export function getInitialSalvageActions() {
    return JSON.parse(JSON.stringify(initialSalvageActions));
}

export function resetSalvageActions() {
    salvageActions.length = 0;
    salvageActions.push(...JSON.parse(JSON.stringify(initialSalvageActions)));
    console.log("Salvage actions have been reset.");
}