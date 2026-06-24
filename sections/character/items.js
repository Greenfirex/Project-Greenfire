// Minimal item definitions for Character inventory/equipment.
// Pure data module: keep IDs stable for saves.

export const items = [
    {
        id: 'basic_helmet',
        name: 'Basic Helmet',
        slot: 'head',
        icon: 'assets/images/items/basic helmet.png',
        description: 'Standard issue SFC armor. Light head protection for field duty.',
        stats: { armor: 1 }
    },
    {
        id: 'field_armor',
        name: 'Basic Armor',
        slot: 'chest',
        icon: 'assets/images/items/basic chest armor.png',
        description: 'Standard issue SFC armor with embedded space for water and food supply.',
        // Also increases personal carryable supplies (Food/Water) capacity.
        stats: { armor: 2, stamina: -5, foodCapacity: 40, waterCapacity: 40 }
    },
    {
        id: 'utility_legs',
        name: 'Basic Legs',
        slot: 'legs',
        icon: 'assets/images/items/basic leg armor.png',
        description: 'Utility legwear designed for long marches and rugged terrain.',
        stats: { stamina: 5 }
    },
    {
        id: 'basic_boots',
        name: 'Basic Boots',
        slot: 'boots',
        icon: 'assets/images/items/basic boots.png',
        description: 'Reinforced boots with stable footing and quick movement.',
        stats: { evasion: 3 }
    },
    {
        id: 'spiked_branch',
        name: 'Spiked Branch',
        slot: 'weapon',
        icon: 'assets/images/items/spiked branch.png',
        description: 'A sharpened branch. Crude, but it gets the job done.',
        stats: { damage: 2, attackSpeed: 0.1 }
    },
    {
        id: 'metal_spear',
        name: 'Metal Spear',
        slot: 'weapon',
        icon: 'assets/images/items/metal spear.png',
        description: 'A balanced spear with a metal tip. Reliable and easy to handle.',
        // Slightly better than Spiked Branch
        stats: { damage: 3, attackSpeed: 0.1 }
    },
    {
        id: 'stimpack',
        name: 'Stimpack',
        slot: 'consumable',
        icon: 'assets/images/items/stimpack.png',
        description: 'A quick injector that restores health in a pinch.',
        // Consumables are used via UI buttons (e.g., combat popup)
        consumable: { type: 'heal', resource: 'Health', amount: 25 }
    },
    {
        id: 'first_aid_kit',
        name: 'First Aid Kit',
        slot: 'consumable',
        icon: 'assets/images/items/first aid kit.png',
        description: 'Bandages and meds for treating minor injuries.',
        consumable: { type: 'heal', resource: 'Health', amount: 15 }
    },
    {
        id: 'herb_tea',
        name: 'Herb Tea',
        slot: 'consumable',
        icon: 'assets/images/items/herb tea.png',
        description: 'A warm herbal brew that boosts Stamina regeneration for a while.',
        consumable: { type: 'buff', buff: 'staminaRegen', bonusPerSec: 0.2, durationMinutes: 720 }
    },
    {
        id: 'basic_torch',
        name: 'Basic Torch',
        slot: 'accessory',
        icon: 'assets/images/items/basic torch.png',
        description: 'A simple torch for light and confidence in the dark.',
        stats: { evasion: 0, hitChance: 1 }
    },
    {
        id: 'canteen',
        name: 'Canteen',
        slot: 'accessory',
        icon: 'assets/images/items/canteen.png',
        description: 'A durable canteen for carrying extra drinking water.',
        // Increases personal carryable Drinking Water capacity.
        stats: { waterCapacity: 15 }
    },

    // Chapter 1 tools / quest items (stored in inventory, not resources)
    {
        id: 'crude_prybar',
        name: 'Crude Prybar',
        slot: 'weapon',
        icon: 'assets/images/items/crude prybar.png',
        description: 'A bent prybar for forcing stubborn hatches and crates.',
        stats: { damage: 3, attackSpeed: 0.2 }
    },
    {
        id: 'makeshift_explosive',
        name: 'Makeshift Explosive',
        slot: 'inventory',
        icon: 'assets/images/items/makeshift explosive.png',
        description: 'A volatile charge cobbled together from salvage and hope.',
    },
    {
        id: 'power_cell',
        name: 'Power Cell',
        slot: 'inventory',
        icon: 'assets/images/items/power cell.png',
        description: 'A compact energy cell used to power damaged systems.',
        stackable: true,
    }
    ,
    {
        id: 'bottled_water',
        name: 'Bottled Water',
        slot: 'consumable',
        icon: 'assets/images/items/bottled water.png',
        description: 'A sealed bottle of clean drinking water.',
        stackable: true,
        consumable: { type: 'heal', resource: 'Drinking Water', amount: 15 }
    },
    {
        id: 'packaged_food',
        name: 'Packaged Food',
        slot: 'consumable',
        icon: 'assets/images/items/packaged food.png',
        description: 'Packaged rations, safe to eat.',
        stackable: true,
        consumable: { type: 'heal', resource: 'Food Rations', amount: 25 }
    },

    // Quest items
    {
        id: 'terminal_login_note',
        name: 'Terminal Login Note',
        slot: 'inventory',
        icon: 'assets/images/items/stickynote.png',
        description: 'A sticky note with scribbled login credentials. "Workshop terminal — user: crew01 / pass: vagabond47"',
        quest: true,
        tags: ['Quest'],
    },
    {
        id: 'repair_tools',
        name: 'Repair Tools',
        slot: 'inventory',
        icon: 'assets/images/items/toolbox.png',
        description: 'A basic set of repair tools. Useful for fixing ship systems.',
        quest: true,
        tags: ['Quest'],
    },

    // Quest / salvage items
    {
        id: 'scavenged_comms_panel',
        name: 'Scavenged Comms Panel',
        slot: 'inventory',
        icon: 'assets/images/items/commspanel.png',
        description: 'A battered comms panel with enough intact components to attempt a rebuild at the workbench.',
        quest: true,
        tags: ['Quest'],
    },

    // Craftable equipment
    {
        id: 'foldable_chair',
        name: 'Foldable Chair',
        slot: 'accessory',
        icon: 'assets/images/items/foldablechair.png',
        description: 'A lightweight chair. Makes short recovery breaks more effective.',
        stats: {},
        tooltipModifiers: ['Sit down: +1 Stamina/s'],
    },
    {
        id: 'scrapshield',
        name: 'Scrapshield',
        slot: 'offhand',
        icon: 'assets/images/items/scrapshield.png',
        description: 'A rough shield bolted together from scrap. Better than nothing.',
        stats: { armor: 1 }
    }
];

export function getItemDefinition(id) {
    if (!id) return null;
    return items.find(x => x && x.id === id) || null;
}
