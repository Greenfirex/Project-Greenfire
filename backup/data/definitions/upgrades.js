const initialUpgradeActions = [
    {
        id: 'installForagingTools',
        name: 'Crude Foraging Tools',
        description: 'Equip foragers with improved crude tools to increase yield.',
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Metal Parts', amount: 6 },
            { resource: 'Wire', amount: 10 }
        ],
        drain: [
            { resource: 'Provisions', amount: 3 },
            { resource: 'Water', amount: 4 }
        ],
        repeatable: false,
        suppressGenericLog: true,
        hideRewardPreview: true,
    reward: [],
    // Tooltip-only effects for clarity
    tooltipEffects: ['Forager job: +25% bonus'],
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
        category: 'Upgrade',
        isUnlocked: false, // unlocked when Fabric is discovered
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 2 },
            { resource: 'Metal Parts', amount: 4 },
            { resource: 'Wire', amount: 4 }
        ],
        drain: [
            { resource: 'Provisions', amount: 3 },
            { resource: 'Water', amount: 4 }
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
        category: 'Upgrade',
        isUnlocked: false, // unlocked when Fabric is discovered
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 2 },
            { resource: 'Metal Parts', amount: 4 },
            { resource: 'Wire', amount: 4 }
        ],
        drain: [
            { resource: 'Provisions', amount: 3 },
            { resource: 'Water', amount: 4 }
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
        category: 'Upgrade',
        isUnlocked: false, // unlocked after Base Camp is established
        cancelable: true,
        cost: [
            { resource: 'Metal Parts', amount: 5 }
        ],
        drain: [
            { resource: 'Provisions', amount: 10 },
            { resource: 'Water', amount: 10 }
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
        category: 'Upgrade',
        isUnlocked: false, // will unlock after Base Camp is established
        cancelable: true,
        cost: [
            { resource: 'Wire', amount: 6 },
            { resource: 'Metal Parts', amount: 10 }
        ],
        drain: [
            { resource: 'Provisions', amount: 5 },
            { resource: 'Water', amount: 5 }
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Scrap Collector job: +20% Bonus'],
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
        id: 'workbench',
        name: 'Workbench',
        description: 'Assemble a sturdy workbench at base camp so you can craft and repair equipment more reliably.',
        category: 'Upgrade',
        isUnlocked: false, // unlocked after Base Camp is established
        cancelable: true,
        cost: [
            { resource: 'Metal Parts', amount: 4 },
            { resource: 'Wire', amount: 2 },
        ],
        repeatable: false,
        hideRewardPreview: true,
        reward: [],
        tooltipEffects: ['Unlocks Crafting menu'],
        stage: 0,
        stages: [
            {
                story: null,
                unlocks: [],
                logText: 'A sturdy workbench is assembled at base camp. Crafting options are now available in the Crafting menu.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'organizeWireScavenging',
        name: 'Organize Wire Scavenging',
        description: 'Establish systematic wire salvage operations. Train survivors to identify and extract usable wire from wreckage efficiently.',
        category: 'Upgrade',
        isUnlocked: false, // Will be unlocked by Base Camp establishment
        cancelable: true,
        cost: [
            { resource: 'Metal Parts', amount: 8 },
        ],
        drain: [
            { resource: 'Provisions', amount: 6 },
            { resource: 'Water', amount: 7 }
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
        description: 'Salvage working cafeteria equipment which will make food and water gathering operations more effective.',
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Metal Parts', amount: 20 },
            { resource: 'Wire', amount: 10 }             
        ],
        drain: [
            { resource: 'Provisions', amount: 7 },
            { resource: 'Water', amount: 8 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: [
        'Outdoor yields: +40% (Food & Water channeled actions)',
        'Forager job: +10% bonus',
        'Water Collector job: +10% bonus'
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
        name: 'Personal tents',
        description: 'Use salvaged fabric and parts to construct simple tents at the base camp. Increases effectiveness of sleeping.',
        category: 'Upgrade',
        isUnlocked: false,
        showUnlocks: false,
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 6 },
            { resource: 'Metal Parts', amount: 4 },
            { resource: 'Wire', amount: 2 }
        ],
        drain: [
            { resource: 'Provisions', amount: 5 },
            { resource: 'Water', amount: 7 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Sleep Recovery: +20%'],
        stage: 0,
        stages: [
            {
                story: 'tents_installed',
                unlocks: ['insulateShelters'],
                logText: 'You construct several simple tents for the base camp. Sleeping will now be more effective. (Click to read)',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'insulateShelters',
        name: 'Insulate Shelters',
        description: 'Add insulation to tents to improve recovery during sleep and improve crew morale.',
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 20 },
            { resource: 'Metal Parts', amount: 6 },
        ],
        drain: [
            { resource: 'Provisions', amount: 4 },
            { resource: 'Water', amount: 5 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Sleep Recovery: +10%', 'Morale: +5%'],
        stage: 0,
        stages: [
            {
                story: 'shelter_insulated',
                unlocks: [],
                logText: 'You upgrade the tents with added insulation. Spirits are lifted and sleeping will now be more effective.',
                suppressGenericLog: true
            }
        ]
    },
    {
        id: 'installRainCatchers',
        name: 'Install Rain Catchers',
        description: 'Set up improvised tarps to collect rain and funnel it to storage.',
        category: 'Upgrade',
        isUnlocked: false, // unlocked when Water Station built AND Fabric is discovered
        cancelable: true,
        cost: [
            { resource: 'Fabric', amount: 4 },
            { resource: 'Metal Parts', amount: 4 },
            { resource: 'Wire', amount: 4 }
        ],
        drain: [
            { resource: 'Provisions', amount: 4 },
            { resource: 'Water', amount: 5 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Water Collector job: +25% Bonus'],
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
        name: 'Water Purification Unit',
        description: 'Set up a compact chemical purification unit to improve water purification and recycling efficiency.',
        category: 'Upgrade',
        isUnlocked: false,
        cancelable: true,
        cost: [
            { resource: 'Metal Parts', amount: 12 },
            { resource: 'Chemicals', amount: 8 },
            { resource: 'Fabric', amount: 2 }
        ],
        drain: [
            { resource: 'Provisions', amount: 5 },
            { resource: 'Water', amount: 15 }
        ],
        repeatable: false,
        hideRewardPreview: true,
    reward: [],
    tooltipEffects: ['Water Collector job: +15% Bonus'],
        stage: 0,
        stages: [
            {
                story: 'purification_unit_installed',
                unlocks: [],
                logText: 'A small water purification unit is installed. Water purification results are improved and water collection is more effective.',
                suppressGenericLog: true
            }
        ]
    }
];

function mergeResourceEntries(primary = [], secondary = []) {
    const out = [];
    const byRes = new Map();
    const order = [];

    const add = (entry) => {
        if (!entry || !entry.resource) return;
        const resource = String(entry.resource);
        const amount = Number(entry.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;

        if (!byRes.has(resource)) {
            byRes.set(resource, 0);
            order.push(resource);
        }
        byRes.set(resource, byRes.get(resource) + amount);
    };

    (Array.isArray(primary) ? primary : []).forEach(add);
    (Array.isArray(secondary) ? secondary : []).forEach(add);

    for (const resource of order) {
        out.push({ resource, amount: byRes.get(resource) });
    }
    return out;
}

function normalizeUpgradeAction(action) {
    if (!action || action.category !== 'Upgrade') return;

    // Spec: upgrades are always quick, non-cancelable actions.
    action.duration = 2;
    action.cancelable = false;

    // Spec: all costs are upfront (no per-action drains shown/ticked).
    if (Array.isArray(action.drain) && action.drain.length) {
        action.cost = mergeResourceEntries(action.cost, action.drain);
        action.drain = [];
    } else {
        if (!Array.isArray(action.cost)) action.cost = [];
        action.drain = [];
    }

    // Defensive: stage overrides should not reintroduce drains or durations.
    if (Array.isArray(action.stages)) {
        for (const st of action.stages) {
            if (!st || typeof st !== 'object') continue;
            st.duration = 2;
            if (Array.isArray(st.drain) && st.drain.length) {
                st.cost = mergeResourceEntries(st.cost, st.drain);
                st.drain = [];
            }
        }
    }
}

for (const a of initialUpgradeActions) normalizeUpgradeAction(a);

// Live actions that will be mutated during gameplay
export let upgradeActions = JSON.parse(JSON.stringify(initialUpgradeActions));

export function getInitialUpgradeActions() {
    return JSON.parse(JSON.stringify(initialUpgradeActions));
}

export function resetUpgradeActions() {
    upgradeActions.length = 0;
    upgradeActions.push(...JSON.parse(JSON.stringify(initialUpgradeActions)));
    console.log("Upgrade actions have been reset.");
}
