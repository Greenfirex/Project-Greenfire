export const upgradeActions = [
    {
        id: 'installForagingTools',
        name: 'Crude Foraging Tools',
        description: 'Equip foragers with improved crude tools to increase yield.',
        duration: 5,
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Scrap Metal', amount: 6 },
            { resource: 'Crude Prybar', amount: 1 },
            { resource: 'Wire', amount: 10 }
        ],
        drain: [
            { resource: 'Stamina', amount: 17 },
            { resource: 'Food Rations', amount: 3 },
            { resource: 'Clean Water', amount: 4 }
        ],
        repeatable: false,
        suppressGenericLog: true,
        hideRewardPreview: true,
    reward: [],
    // Tooltip-only effects for clarity
    tooltipEffects: ['Foraging job: +25% permanent bonus'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
            }
        ]
    },
    {
        id: 'planFoodLarder',
        name: 'Plan Food Larder',
        description: 'Design storage layout and salvage parts to enable building a Food Larder.',
        duration: 4,
        category: 'Upgrade',
        isUnlocked: false, // unlocked when Fabric is discovered
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 2 },
            { resource: 'Scrap Metal', amount: 4 },
            { resource: 'Wire', amount: 4 }
        ],
        drain: [
            { resource: 'Stamina', amount: 15 },
            { resource: 'Food Rations', amount: 2 },
            { resource: 'Clean Water', amount: 3 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Unlocks building: Food Larder'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'Plans finalized for a Food Larder. Construction can begin in the Colony.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'planWaterReservoir',
        name: 'Plan Water Reservoir',
        description: 'Draft reservoir layout and fittings so a Water Reservoir can be constructed.',
        duration: 4,
        category: 'Upgrade',
        isUnlocked: false, // unlocked when Fabric is discovered
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 2 },
            { resource: 'Scrap Metal', amount: 4 },
            { resource: 'Wire', amount: 4 }
        ],
        drain: [
            { resource: 'Stamina', amount: 15 },
            { resource: 'Food Rations', amount: 2 },
            { resource: 'Clean Water', amount: 3 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Unlocks building: Water Reservoir'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'Plans finalized for a Water Reservoir. Construction can begin in the Colony.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'lightCampfire',
        name: 'Light Campfire',
        description: 'Build and tend a safe campfire at base camp to lift spirits and morale.',
        duration: 4,
        category: 'Upgrade',
        isUnlocked: false, // unlocked after Base Camp is established
        cancelable: true,
        cost: [
            { resource: 'Scrap Metal', amount: 5 }
        ],
        drain: [
            { resource: 'Stamina', amount: 11 },
            { resource: 'Food Rations', amount: 15 },
            { resource: 'Clean Water', amount: 10 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Morale: +5%'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'A steady campfire crackles at the center of camp. Spirits lift a little.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'installScavengerKit',
        name: 'Scavenger Kit',
        description: 'Harnesses, ties, and cable trays to organize salvage runs and improve scrap recovery.',
        duration: 5,
        category: 'Upgrade',
        isUnlocked: false, // will unlock after Base Camp is established
        cancelable: true,
        cost: [
            { resource: 'Wire', amount: 16 },
            { resource: 'Scrap Metal', amount: 12 }
        ],
        drain: [
            { resource: 'Stamina', amount: 17 },
            { resource: 'Food Rations', amount: 3 },
            { resource: 'Clean Water', amount: 4 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Scrap Collector job: +20% Permanent Bonus'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'You rig cable harnesses and trays. Scrap runs get faster and tidier.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'organizeWireScavenging',
        name: 'Organize Wire Scavenging',
        description: 'Establish systematic wire salvage operations. Train survivors to identify and extract usable wire from wreckage efficiently.',
        duration: 5,
        category: 'Upgrade',
        isUnlocked: false, // Will be unlocked by Base Camp establishment
        cancelable: true,
        cost: [
            { resource: 'Scrap Metal', amount: 8 },
            { resource: 'Wire', amount: 12 }
        ],
        drain: [
            { resource: 'Stamina', amount: 17 },
            { resource: 'Food Rations', amount: 3 },
            { resource: 'Clean Water', amount: 4 }
        ],
        repeatable: false,
        suppressGenericLog: true,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Unlocks Wire Collector job (unlimited assignments)'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'Wire scavenging operations organized. Survivors can now be assigned to wire collection.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'salvageCookingEquipment',
        name: 'Salvage Cooking Equipment',
        description: 'We could salvage working cooking equipment if we can manage to take it out of the wreckage. This would help provide food and water for the crew at the base camp.',
        duration: 8,
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Crude Prybar', amount: 2 }
        ],
        drain: [
            { resource: 'Stamina', amount: 23 },
            { resource: 'Food Rations', amount: 5 },
            { resource: 'Clean Water', amount: 6 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: [
        'Forage for Food: +40% Bonus',
        'Purify Water: +40% Bonus'
    ],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'Salvaged cooking equipment installed at base camp. Food and water gathering operations are now more effective.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'makeTents',
        name: 'Make Tents (Base Camp)',
        description: 'Use salvaged fabric and parts to construct simple tents at the base camp. Increases effectiveness of resting.',
        duration: 6,
        category: 'Upgrade',
        isUnlocked: false,
        showUnlocks: false,
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 6 },
            { resource: 'Scrap Metal', amount: 4 },
            { resource: 'Crude Prybar', amount: 1 }
        ],
        drain: [
            { resource: 'Stamina', amount: 23 },
            { resource: 'Food Rations', amount: 4 },
            { resource: 'Clean Water', amount: 5 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Rest: +20% Bonus'],
        stage: 0,
        stages: [
            {
                story: 'tents_installed',
                unlocks: ['insulateShelters'],
                logText: 'You construct several simple tents for the base camp. Resting will now be more effective. (Click to read)',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'insulateShelters',
        name: 'Insulate Shelters',
        description: 'Add insulation to tents to improve recovery during rest.',
        duration: 4,
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 20 },
            { resource: 'Scrap Metal', amount: 6 },
            { resource: 'Crude Prybar', amount: 2 }
        ],
        drain: [
            { resource: 'Stamina', amount: 17 },
            { resource: 'Food Rations', amount: 3 },
            { resource: 'Clean Water', amount: 4 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Rest: +10% Bonus'],
        stage: 0,
        stages: [
            {
                story: 'shelter_insulated',
                unlocks: [],
                logText: 'You upgrade the tents with added insulation. Resting restores a bit more stamina now.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'installRainCatchers',
        name: 'Install Rain Catchers',
        description: 'Set up tarps and channels to collect rain and funnel it to storage.',
        duration: 5,
        category: 'Upgrade',
        isUnlocked: false, // unlocked when Water Station built AND Fabric is discovered
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 4 },
            { resource: 'Scrap Metal', amount: 4 },
            { resource: 'Wire', amount: 8 }
        ],
        drain: [
            { resource: 'Stamina', amount: 19 },
            { resource: 'Food Rations', amount: 3 },
            { resource: 'Clean Water', amount: 4 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Water Collection job: +25% Bonus'],
        tooltipUnlocks: ['Rain Tarp'],
        stage: 0,
        stages: [
            {
                story: 'rain_catchers',
                unlocks: [],
                logText: 'Catchment arrays gather rain and feed storage.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'installPurificationUnit',
        name: 'Install Purification Unit',
        description: 'Set up a compact chemical purification unit to improve water purification and recycling efficiency.',
        duration: 6,
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Scrap Metal', amount: 12 },
            { resource: 'Chemicals', amount: 6 },
            { resource: 'Fabric', amount: 4 }
        ],
        drain: [
            { resource: 'Stamina', amount: 23 },
            { resource: 'Food Rations', amount: 4 },
            { resource: 'Clean Water', amount: 5 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Water Collection job: +25% Bonus',
                     'Purify Water: +20% Bonus'
    ],
        stage: 0,
        stages: [
            {
                story: 'purification_unit_installed',
                unlocks: [],
                logText: 'A small purification unit is installed. Water purification results are improved and water collection is more effective.',
                suppressGenericLog: true
            }
        ]
    }
];
