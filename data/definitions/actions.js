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
                { resource: 'Drinking Water', amount: 5 }
            ],
            stage: 0,
            stages: [
                // new order: sheltered area (rest) first, then food, then water/alternate access
                { story: 'foundCave', unlocks: ['rest', 'createBasicTorch', 'drinkCaveWater'], logText: 'You have discovered a sheltered area — someone can rest here. (Click to read)' },
                { story: 'foundBerries', unlocks: ['forageFood'], logText: 'You have discovered a source of food. (Click to read)' },
                // Water Source (H8): only unlock Purify Water here.
                // Other related actions are tile-bound and should not be unlocked/listed from this story popup.
                { story: 'foundRiver', unlocks: ['purifyWater'], encounter: 'wildlife_river', logText: 'You have discovered a source of water. (Click to read)' },
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
                { resource: 'Food Rations', amount: 8 },
                { resource: 'Drinking Water', amount: 12 },
            ],
            stage: 0,
            stages: [
                {
                    story: 'reentryFailed',
                    // unlock Scout Surroundings after Attempt Re-entry completes
                    unlocks: ['move'],
                    logText: 'A forward section collapsed during your re-entry attempt; the hull is impassable and still burning. (Click to read)',
                    suppressGenericLog: true
                }
            ]
            },
            {
                id: 'move',
                name: 'Explore',
                description: 'Explore an adjacent tile on the local map.',
                duration: 0.8,
                category: 'Exploration',
                isUnlocked: false,
                repeatable: true,
                cancelable: false,
                suppressGenericLog: true,
                drain: [
                    { resource: 'Stamina', amount: 2 }
                ]
            },
            {
                id: 'sitDown',
                name: 'Sit down',
                description: 'Catch your breath. While resting, you recover stamina and health over time.',
                duration: 60,
                category: 'Survival',
                isUnlocked: true,
                repeatable: true,
                cancelable: true,
                drain: [],
                reward: []
            },
            {
                id: 'burnThornyWall',
                name: 'Burn Thorny Wall',
                description: 'Use an equipped torch to burn through a dense wall of thorns and clear a path.',
                duration: 1.6,
                category: 'Exploration',
                isUnlocked: true,
                cancelable: false,
                repeatable: false,
                suppressGenericLog: true,
                drain: [
                    { resource: 'Stamina', amount: 8 }
                ],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: null,
                        unlocks: [],
                        logText: 'The thorny wall catches and collapses into ash, leaving a clear opening.',
                        suppressGenericLog: true,
                    }
                ]
            },
            {
                id: 'forageFood',
                name: 'Forage for Food',
                description: 'Search the surrounding area for edible plants. Food is gathered gradually while you forage.',
                duration: 60,
                category: 'Survival',
                isUnlocked: false,
                repeatable: true,
                cancelable: true,
                // ADDED: This action now drains Stamina over time
                drain: [
                    { resource: 'Stamina', amount: 30 }
                ],
                reward: []
            },
            {
                id: 'purifyWater',
                name: 'Purify Water',
                description: 'Boil and filter water from a nearby stream. Clean water is produced gradually while you work.',
                duration: 60,
                category: 'Survival',
                isUnlocked: false,
                repeatable: true,
                cancelable: true,
                // ADDED: This action now drains Stamina over time
                drain: [
                    { resource: 'Stamina', amount: 30 }
                ],
                reward: []
            },
            {
                id: 'huntWildlife',
                name: 'Hunt for Wildlife',
                description: 'Track and hunt nearby wildlife. Dangerous, but can provide a large amount of food.',
                duration: 4,
                category: 'Survival',
                isUnlocked: false,
                cancelable: true,
                repeatable: true,
                encounter: 'wildlife_river',
                encounterChance: 0.8,
                encounterFailLogText: 'You spend hours tracking signs, but find no prey.',
                drain: [
                    { resource: 'Stamina', amount: 30 },
                    { resource: 'Drinking Water', amount: 5 },
                    { resource: 'Food Rations', amount: 5 }
                ],
                reward: [
                    { resource: 'Food Rations', amount: [60, 90] },
                ]
            },
            {
                id: 'rest',
                name: 'Rest',
                description: 'Take a break. While resting, you recover stamina and health over time.',
                duration: 60,
                category: 'Survival',
                isUnlocked: false,
                repeatable: true,
                cancelable: true,
                drain: [],
                reward: [],
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
                id: 'sleep',
                name: 'Sleep',
                description: 'Rest inside your tent at base camp. You wake up feeling far more recovered than a quick break in the wild.',
                duration: 60,
                category: 'Survival',
                isUnlocked: false,
                repeatable: true,
                cancelable: true,
                drain: [],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: null,
                        unlocks: [],
                        logText: 'You sleep in your tent and wake with renewed strength.'
                    }
                ]
            },

            {
                id: 'drinkCaveWater',
                name: 'Drink from Cave Stream',
                description: 'Sip from a small underground stream running through the cave. Drinking water is gathered gradually while you drink.',
                duration: 60,
                category: 'Survival',
                isUnlocked: false,
                cancelable: true,
                repeatable: true,
                drain: [
                    { resource: 'Stamina', amount: 30 },
                ],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: null,
                        unlocks: [],
                        logText: 'You find a narrow trickle of water in the cave wall and drink what you can.'
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
                   { resource: 'Food Rations', amount: 10 },
                   { resource: 'Drinking Water', amount: 12 }
                ],
                // single-stage action that triggers a story popup on completion
                stage: 0,
                stages: [
                    {
                        story: 'alternateAccessFound',
                        unlocks: ['scavengeDebris', 'makeCrudePrybar', 'pryOpenHull'],
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
                drain: [ { resource: 'Stamina', amount: 12 }, 
                        { resource: 'Food Rations', amount: 4 },
                        { resource: 'Drinking Water', amount: 6 } 
                    ],
                reward: [
                    { resource: 'Metal Parts', amount: [7, 8] }
                ]
            },
            {
                id: 'pryOpenHull',
                name: 'Pry Open Hull Section',
                description: 'Use a prybar and brute force to open a sealed section of the ship\'s hull and get inside.',
                duration: 10,
                category: 'Exploration',
                isUnlocked: false,
                drain: [
                    { resource: 'Stamina', amount: 40 },
                    { resource: 'Food Rations', amount: 6 },
                    { resource: 'Drinking Water', amount: 7 } 
                ],
                reward: [],
                hideRewardPreview: true,
                stage: 0,
                stages: [
                    {
                        story: 'enteredShipChoices',
                        // Ship interior branching happens later (E5 local map trigger)
                        unlocks: [],
                        logText: 'You pry open the hull and clear a way inside. (Click to read)',
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
                    { resource: 'Stamina', amount: 5 }
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
                    { resource: 'Metal Parts', amount: 12 }
                ],
                drain: [
                    { resource: 'Stamina', amount: 25 },
                    { resource: 'Food Rations', amount: 5 },
                    { resource: 'Drinking Water', amount: 8 }
                ],
                reward: [],
                // Tooltip-only: some unlocks are applied elsewhere in game code; expose them here
                // for the tooltip so players can see what this action will ultimately enable.
                // Use internal ids (job ids, building names/ids or section ids) or plain labels.
                tooltipUnlocks: ['campsiteSection', 'scrap_collector'],
                hideRewardPreview: true,
                stage: 0,
                stages: [
                    {
                        story: 'basecamp_established', // matches new storyEvents entry
                        unlocks: ['sleep', 'refillCanteen', 'packRations', 'haulWater', 'haulBerries'],
                        logText: 'You establish a small base camp. Survivors can be organized here. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },

            // Base camp utility actions (local-map tile actions at B7)
            {
                id: 'refillCanteen',
                name: 'Refill Canteen',
                description: 'Transfer camp Water into your canteen.',
                duration: 1,
                category: 'Survival',
                isUnlocked: false,
                cancelable: true,
                repeatable: true,
                cost: [
                    { resource: 'Water', amount: 25 }
                ],
                reward: [
                    { resource: 'Drinking Water', amount: 25 }
                ]
            },
            {
                id: 'packRations',
                name: 'Pack Rations',
                description: 'Transfer camp Provisions into your rations pack.',
                duration: 1,
                category: 'Survival',
                isUnlocked: false,
                cancelable: true,
                repeatable: true,
                cost: [
                    { resource: 'Provisions', amount: 25 }
                ],
                reward: [
                    { resource: 'Food Rations', amount: 25 }
                ]
            },

            // Post-base-camp hauling actions (tile-bound; feeds camp storage)
            {
                id: 'haulWater',
                name: 'Haul Water',
                description: 'Fill containers at the river and haul the water back to camp storage.',
                duration: 3,
                category: 'Survival',
                isUnlocked: false,
                cancelable: true,
                repeatable: true,
                drain: [
                    { resource: 'Stamina', amount: 35 },
                    { resource: 'Food Rations', amount: 3 },
                    { resource: 'Drinking Water', amount: 3 }
                ],
                reward: [
                    { resource: 'Water', amount: [20, 25] }
                ]
            },
            {
                id: 'haulBerries',
                name: 'Haul Berries',
                description: 'Gather berries and haul them back to camp provisions stores.',
                duration: 3,
                category: 'Survival',
                isUnlocked: false,
                cancelable: true,
                repeatable: true,
                drain: [
                    { resource: 'Stamina', amount: 25 },
                    { resource: 'Food Rations', amount: 3 },
                    { resource: 'Drinking Water', amount: 3 }
                ],
                reward: [
                    { resource: 'Provisions', amount: [16, 20] }
                ]
            },
            {
            id: 'searchSouthCorridor',
            name: 'Search: South Corridor',
            description: 'Move cautiously down the south corridor. Risk of collapsed panels but this way should lead to junction leading to cafeteria and crew quarters.',
            duration: 8,
            category: 'Exploration',
            isUnlocked: false,
            // This action is map-bound; suppress noisy generic "New action available" unlock logs.
            suppressUnlockLog: true,
            // Spoiler-free: keep the "?" badge until the player discovers the encounter (retreat/lose).
            spoilerFreeEncounter: true,
            encounterDiscovered: false,
            cancelable: true,
            drain: [
                { resource: 'Stamina', amount: 30 },
                { resource: 'Food Rations', amount: 10 },
                { resource: 'Drinking Water', amount: 12 }
            ],
            reward: [],
            hideRewardPreview: true,
            stage: 0,
            stages: [
                {
                    story: 'south_corridor_drone',
                    encounter: 'maintenance_drone_south_corridor',
                    // completing south corridor should allow restoring emergency power
                    unlocks: ['exploreCafeteria', 'checkCrewQuarters'],
                    // These follow-up actions are now map/tile-bound; don't list them in the story popup.
                    showUnlocks: false,
                    logText: 'A damaged maintenance drone ambushes you in the south corridor. After the fight, you push through to a junction leading to the mess hall and crew quarters. (Click to read)',
                    suppressGenericLog: true
                }
            ]
        },

        {
            id: 'stripWiring',
            name: 'Strip Wiring',
            description: 'Harvest salvageable wire from ruptured conduits, trays and damaged panels inside the wreck.',
            duration: 3,
            category: 'Materials',
            isUnlocked: false, // unlocked after entering the ship (Pry Open Hull)
            cancelable: true,
            repeatable: true,
            drain: [
                { resource: 'Stamina', amount: 12 },
                { resource: 'Food Rations', amount: 2 },
                { resource: 'Drinking Water', amount: 3 }
            ],
            reward: [
                { resource: 'Wire', amount: [8, 12] }
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
            description: 'Search the ship\'s mess hall for usable food and drinking water among the wreckage.',
            duration: 8,
            category: 'Exploration',
            isUnlocked: false,
            // Map-bound; suppress noisy generic unlock logs.
            suppressUnlockLog: true,
            cancelable: true,
            drain: [
                { resource: 'Stamina', amount: 25 },
                { resource: 'Food Rations', amount: 2 },
                { resource: 'Drinking Water', amount: 3 }
            ],
            reward: [
                { resource: 'Packaged Food', amount: 1 },
                { resource: 'Bottled Water', amount: 1 },
                { resource: 'Survivors', amount: 2 }
            ],
            hideRewardPreview: true,
            stage: 0,
            stages: [
                {
                    story: 'south_explore_cafeteria',
                    unlocks: ['salvageCookingEquipment', 'scavengeCafeteriaWater', 'scavengeCafeteriaFood', 'craftBottledWater'],
                    logText: 'In the mess hall you find preserved rations and salvageable water among the wreckage. (Click to read)'
                }
            ]
        },

        {
            id: 'scavengeCafeteriaWater',
            name: 'Scavenge Bottled Water',
            description: 'Search the kitchen and storage areas for any remaining bottled water.',
            duration: 3,
            category: 'Materials',
            isUnlocked: false,
            // Map-bound, tile-limited action: show on the cafeteria tile only.
            suppressUnlockLog: true,
            showUnlocks: false,
            cancelable: true,
            repeatable: true,
            drain: [
                { resource: 'Stamina', amount: 8 },
                { resource: 'Food Rations', amount: 3 },
                { resource: 'Drinking Water', amount: 4 }
            ],
            reward: [
                { resource: 'Bottled Water', amount: 1 }
            ],
            hideRewardPreview: false,
            stage: 0,
            stages: [
                {
                    story: null,
                    unlocks: [],
                    logText: 'You pry open lockers and salvage intact bottled water from the wreckage.'
                }
            ]
        },

        {
            id: 'scavengeCafeteriaFood',
            name: 'Scavenge Packaged Food',
            description: 'Search the kitchen and storage areas for any remaining packaged rations.',
            duration: 3,
            category: 'Materials',
            isUnlocked: false,
            // Map-bound, tile-limited action: show on the cafeteria tile only.
            suppressUnlockLog: true,
            showUnlocks: false,
            cancelable: true,
            repeatable: true,
            drain: [
                { resource: 'Stamina', amount: 8 },
                { resource: 'Food Rations', amount: 4 },
                { resource: 'Drinking Water', amount: 3 }
            ],
            reward: [
                { resource: 'Packaged Food', amount: 1 }
            ],
            hideRewardPreview: false,
            stage: 0,
            stages: [
                {
                    story: null,
                    unlocks: [],
                    logText: 'You salvage sealed packaged rations from crushed storage bins.'
                }
            ]
        },


        {
            id: 'checkCrewQuarters',
            name: 'Check Crew Quarters',
            description: 'Search the crew quarters for supplies, personal kits, and anything that might help survivors or crafts.',
            duration: 6,
            category: 'Exploration',
            isUnlocked: false,
            // Map-bound; suppress noisy generic unlock logs.
            suppressUnlockLog: true,
            cancelable: true,
            drain: [
                { resource: 'Stamina', amount: 20 },
                { resource: 'Food Rations', amount: 2 },
                { resource: 'Drinking Water', amount: 2 }
            ],
            reward: [   
                { resource: 'Fabric', amount: [3, 4] },
                { resource: 'Survivors', amount: 1 }
            ],
            hideRewardPreview: true,
            stage: 0,
            stages: [
                {
                    story: 'south_check_quarters',
                    unlocks: ['makeTents', 'collectFabric', 'craftFirstAidKit', 'craftCanteen', 'craftPackagedFood'],
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
                { resource: 'Stamina', amount: 14 },
                { resource: 'Food Rations', amount: 4 },
                { resource: 'Drinking Water', amount: 5 }
            ],
            reward: [
                { resource: 'Fabric', amount: [3, 4] }
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
            // This action is map-bound; suppress noisy generic "New action available" unlock logs.
            suppressUnlockLog: true,
            showUnlocks: false,
            cancelable: true,
            drain: [
                { resource: 'Stamina', amount: 20 },
                { resource: 'Food Rations', amount: 11 },
                { resource: 'Drinking Water', amount: 10 }
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
            // This action is map-bound; suppress noisy generic "New action available" unlock logs.
            suppressUnlockLog: true,
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
                        { resource: 'Food Rations', amount: 11 },
                        { resource: 'Drinking Water', amount: 15 }
            ],
                },
                {
                    // second attempt: requires and consumes a makeshift explosive to blast the lock
                    story: 'powercore_breached',
                    unlocks: ['restoreEmergencyPower', 'craftPowerCells'], // also unlock power-cell crafting after breach
                    description: 'Return to the power core with makeshift explosives and breach the reinforced lock. Dangerous — but necessary to access the core systems.',
                    logText: 'Now that all survivors are accounted for, you risk breaching the power core with the explosive. The blast blows the seal and you can access the core systems. (Click to read)',
                    // Requirement handled via unlockRules (must have 3 Makeshift Explosives in inventory).
                    // They are consumed on completion via gameFlags completion handler.
                    drain: [
                        { resource: 'Stamina', amount: 50 },
                        { resource: 'Food Rations', amount: 35 },
                        { resource: 'Drinking Water', amount: 30 },
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
            // This action is map-bound; suppress noisy generic "New action available" unlock logs.
            suppressUnlockLog: true,
            cancelable: true,
            drain: [
                { resource: 'Stamina', amount: 24 },
                { resource: 'Food Rations', amount: 6 },
                { resource: 'Drinking Water', amount: 8 }
            ],
            reward: [
                { resource: 'Chemicals', amount: 4 },
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
                { resource: 'Drinking Water', amount: 6 }
            ],
            reward: [
                { resource: 'Chemicals', amount: [2, 4] }
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
                { resource: 'Wire', amount: 20 }
            ],
            drain: [
                { resource: 'Stamina', amount: 28 },
                { resource: 'Food Rations', amount: 5 },
                { resource: 'Drinking Water', amount: 6 }
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
                id: 'investigateBridge',
                name: 'Investigate Bridge',
                // Base description will be stage-adaptive; we swap logic so if emergency power is already restored
                // when player first clicks, they skip directly to the powered stage.
                description: 'Assess access to the command deck. If power is offline the lift will be inert; with emergency power restored you can ride up.',
                duration: 8,
                category: 'Exploration',
                isUnlocked: false,
                // This action is map-bound; suppress noisy generic "New action available" unlock logs.
                suppressUnlockLog: true,
                cancelable: true,
                hideRewardPreview: true,
                stage: 0,
                stages: [
                    {
                        // Stage 1: Scout to the bridge access — discover an inaccessible lift without power
                        story: 'bridge_lift_no_power',
                        unlocks: [],
                        description: 'The lift looks it won\'t work without power, but you could investigate the access and see if there are any alternative ways onto the bridge.',
                        drain: [
                            { resource: 'Stamina', amount: 10 },
                            { resource: 'Drinking Water', amount: 3 },
                            { resource: 'Food Rations', amount: 2 }
                        ],
                        logText: 'You reach the bridge access. A heavy lift blocks the way — dead without power. Blasting through is not an option. (Click to read)',
                        suppressGenericLog: true
                    },
                    {
                        // Stage 2: Return after restoring emergency power (narrative follow-up)
                        story: 'bridge_after_power',
                        // Unlock the bridge exploration step (tile action on H6).
                        unlocks: ['exploreBridge'],
                        showUnlocks: false,
                        description: 'Emergency power is online: the lift cycles, granting limited access to the bridge. You can ride up and assess the situation.',
                        drain: [
                            { resource: 'Stamina', amount: 20 },
                            { resource: 'Drinking Water', amount: 7 },
                            { resource: 'Food Rations', amount: 7 }
                        ],
                        logText: 'Emergency power lets the bridge lift cycle again. You regain access to the command deck — but something is moving somewhere in the dark. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },

            {
                id: 'exploreBridge',
                name: 'Explore the Bridge',
                description: 'Search the bridge wreckage to see what can be salvaged — especially anything communications-related.',
                duration: 7,
                category: 'Exploration',
                isUnlocked: false,
                // Tile-bound bridge action; suppress noisy generic unlock logs.
                suppressUnlockLog: true,
                showUnlocks: false,
                cancelable: true,
                hideRewardPreview: true,
                drain: [
                    { resource: 'Stamina', amount: 20 },
                    { resource: 'Food Rations', amount: 4 },
                    { resource: 'Drinking Water', amount: 4 }
                ],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: 'bridge_explore_damage',
                        unlocks: ['scavengeCommsPanel'],
                        showUnlocks: false,
                        logText: 'You pick through the bridge wreckage and spot a comms panel that might still be salvageable. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },

            {
                id: 'scavengeCommsPanel',
                name: 'Scavenge Comms Panel',
                description: 'Salvage a damaged comms panel from the bridge — you can attempt to salvage it for a repair back at base camp.',
                duration: 6,
                category: 'Exploration',
                isUnlocked: false,
                // Tile-bound bridge action; suppress noisy generic unlock logs.
                suppressUnlockLog: true,
                showUnlocks: false,
                cancelable: true,
                hideRewardPreview: true,
                drain: [
                    { resource: 'Stamina', amount: 16 },
                    { resource: 'Food Rations', amount: 4 },
                    { resource: 'Drinking Water', amount: 4 }
                ],
                reward: [],
                stage: 0,
                stages: [
                    {
                        story: 'scavenged_comms_panel',
                        unlocks: ['fixLongRangeRadio'],
                        showUnlocks: false,
                        logText: 'You salvage a comms panel and intact components from the bridge. Back at the workbench, you can attempt a repair. (Click to read)',
                        suppressGenericLog: true
                    }
                ]
            },
            // New exploration lead revealed after improving base camp
            {
                id: 'investigateDistantSmoke',
                name: 'Check Pod Landing Site',
                description: 'Carefully investigate the area where the escape pod landed, maybe there are survivors.',
                duration: 10,
                category: 'Exploration',
                isUnlocked: false,
                cancelable: true,
                hideRewardPreview: true,
                drain: [ { resource: 'Stamina', amount: 22 },
                        { resource: 'Food Rations', amount: 4 },
                        { resource: 'Drinking Water', amount: 6 } 

                ],
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
                    { resource: 'Drinking Water', amount: 5 },
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
                    { resource: 'Drinking Water', amount: 7 },
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