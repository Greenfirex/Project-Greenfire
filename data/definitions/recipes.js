// Crafting / recipe-like actions kept separate from exploration/survival actions.
// These are aggregated in `data/definitions/allActions.js`.

const initialRecipeActions = [
    {
        id: 'createBasicTorch',
        name: 'Create Basic Torch',
        description: 'Use dry materials from the shelter to assemble a simple torch you can carry into darker terrain.',
        duration: 2,
        category: 'Crafting',
        isUnlocked: false,
        cancelable: true,
        repeatable: false,
        drain: [
            { resource: 'Stamina', amount: 4 }
        ],
        reward: [],
        suppressGenericLog: true,
    },

    {
        id: 'craftFirstAidKit',
        name: 'Craft First Aid Kit',
        description: 'Use fabric to assemble a basic first aid kit for treating injuries.',
        duration: 3,
        category: 'Crafting',
        isUnlocked: false,
        cancelable: true,
        repeatable: true,
        showUnlocks: false,
        cost: [
            { resource: 'Fabric', amount: 3 }
        ],
        drain: [
            { resource: 'Stamina', amount: 6 }
        ],
        reward: [],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                grantItems: ['first_aid_kit'],
                grantItemsPreferEquip: false,
                logText: 'You assemble a first aid kit you can use later.'
            }
        ]
    },

    {
        id: 'craftHerbTea',
        name: 'Brew Herb Tea',
        description: 'Brew a soothing herbal tea that helps your Stamina recover faster for several hours.',
        duration: 2,
        category: 'Crafting',
        // Available immediately once the Crafting menu exists.
        isUnlocked: true,
        cancelable: true,
        repeatable: true,
        showUnlocks: false,
        cost: [
            { resource: 'Provisions', amount: 1 },
            { resource: 'Water', amount: 1 }
        ],
        drain: [
            { resource: 'Stamina', amount: 4 }
        ],
        reward: [],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                grantItems: ['herb_tea'],
                grantItemsPreferEquip: false,
                logText: 'You brew herb tea and bottle it for later.'
            }
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
            { resource: 'Metal Parts', amount: 15 }
        ],
        drain: [
            { resource: 'Stamina', amount: 10 },
            { resource: 'Provisions', amount: 3 },
            { resource: 'Water', amount: 4 }
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
        id: 'craftMetalSpear',
        name: 'Craft Metal Spear',
        description: 'Use salvaged metal and wire to craft a sturdy spear — better than improvised weapons.',
        duration: 5,
        category: 'Crafting',
        isUnlocked: false,
        cancelable: true,
        repeatable: true,
        showUnlocks: false,
        cost: [
            { resource: 'Metal Parts', amount: 12 },
            { resource: 'Wire', amount: 4 }
        ],
        drain: [
            { resource: 'Stamina', amount: 12 },
            { resource: 'Provisions', amount: 3 },
            { resource: 'Water', amount: 3 }
        ],
        reward: [],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                grantItems: ['metal_spear'],
                grantItemsPreferEquip: true,
                logText: 'You lash a sharpened metal head onto a reinforced shaft. It feels balanced and reliable.'
            }
        ]
    },

    {
        id: 'craftCanteen',
        name: 'Craft Canteen',
        description: 'Use salvaged metal and fabric to craft a canteen you can carry and refill at camp.',
        duration: 3,
        category: 'Crafting',
        isUnlocked: false,
        cancelable: true,
        repeatable: true,
        showUnlocks: false,
        cost: [
            { resource: 'Metal Parts', amount: 8 },
            { resource: 'Fabric', amount: 2 }
        ],
        drain: [
            { resource: 'Stamina', amount: 8 },
            { resource: 'Provisions', amount: 2 },
            { resource: 'Water', amount: 2 }
        ],
        reward: [],
        hideRewardPreview: true,
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                grantItems: ['canteen'],
                grantItemsPreferEquip: true,
                logText: 'You assemble a sturdy canteen and strap it on — more water for longer trips.'
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
            { resource: 'Metal Parts', amount: 8 },
            { resource: 'Wire', amount: 14 }
        ],
        drain: [
            { resource: 'Stamina', amount: 13 },
            { resource: 'Provisions', amount: 3 },
            { resource: 'Water', amount: 3 }
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
        id: 'fixLongRangeRadio',
        name: 'Fix Long-Range Radio',
        description: 'Scavenge the damaged comms panel and rewire it to a power cell using insulated fabric and salvaged wiring to attempt contacting Starfleet Command.',
        duration: 12,
        category: 'Quest',
        isUnlocked: false,
        // Tile-bound (base camp) action; suppress noisy generic unlock logs.
        suppressUnlockLog: true,
        showUnlocks: false,
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

    {
        id: 'craftPowerCells',
        name: 'Craft Power Cells',
        description: 'Rebuild damaged power cells using salvaged parts and chemical stabilizers. Expensive — but it can keep critical systems running.',
        duration: 10,
        category: 'Crafting',
        isUnlocked: false,
        cancelable: true,
        repeatable: true,
        showUnlocks: false,
        cost: [
            { resource: 'Metal Parts', amount: 40 },
            { resource: 'Wire', amount: 60 },
            { resource: 'Chemicals', amount: 12 }
        ],
        drain: [
            { resource: 'Stamina', amount: 18 },
            { resource: 'Provisions', amount: 4 },
            { resource: 'Water', amount: 4 }
        ],
        reward: [
            { resource: 'Power Cells', amount: 1 }
        ],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'You carefully rebuild a functional power cell from salvaged components.'
            }
        ]
    },
];

// Live actions that will be mutated during gameplay
export let recipeActions = JSON.parse(JSON.stringify(initialRecipeActions));

export function getInitialRecipeActions() {
    return JSON.parse(JSON.stringify(initialRecipeActions));
}

export function resetRecipeActions() {
    recipeActions.length = 0;
    recipeActions.push(...JSON.parse(JSON.stringify(initialRecipeActions)));
    console.log('Recipe actions have been reset.');
}
