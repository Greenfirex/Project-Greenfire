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
            { resource: 'Crude Prybar', amount: 1 }
        ],
        repeatable: false,
        suppressGenericLog: true,
        hideRewardPreview: true,
        reward: [],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
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
            { resource: 'Crude Prybar', amount: 3 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        stage: 0,
        stages: [
            {
                story: 'cafeteria_salvage',
                unlocks: [],
                logText: 'You salvage a compact cooking rig and parts from the mess hall wreckage. With this at the base camp food and water gathering will be more effective. (Click to read)'
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
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 6 },
            { resource: 'Scrap Metal', amount: 4 },
            { resource: 'Crude Prybar', amount: 1 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        stage: 0,
        stages: [
            {
                story: 'tents_installed',
                unlocks: ['insulateShelters'],
                logText: 'You construct several simple tents for the base camp. Resting will now be more effective. (Click to read)'
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
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        stage: 0,
        stages: [
            {
                story: 'shelter_insulated',
                unlocks: [],
                logText: 'You upgrade the tents with added insulation. Resting restores a bit more energy now.'
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
            { resource: 'Fabric', amount: 6 },
            { resource: 'Scrap Metal', amount: 4 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        stage: 0,
        stages: [
            {
                story: 'rain_catchers',
                unlocks: [],
                logText: 'Catchment arrays gather rain and feed storage.'
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
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
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
