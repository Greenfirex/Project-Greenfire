// Minimal item definitions for Character inventory/equipment.
// Pure data module: keep IDs stable for saves.

export const items = [
    {
        id: 'basic_helmet',
        name: 'Basic Helmet',
        nameKey: 'item_basic_helmet',
        slot: 'head',
        icon: 'assets/images/items/basic helmet.png',
        description: 'Standard issue SFC headgear with integrated oxygen sensor and HUD.',
        descKey: 'item_basic_helmet_desc',
        tags: ['Uniform'],
    },
    {
        id: 'basic_armor',
        name: 'Basic Armor',
        nameKey: 'item_basic_armor',
        slot: 'chest',
        icon: 'assets/images/items/basic chest armor.png',
        description: 'Standard issue SFC chestpiece with embedded oxygen regulator and supply connectors.',
        descKey: 'item_basic_armor_desc',
        tags: ['Uniform'],
    },
    {
        id: 'basic_boots',
        name: 'Basic Boots',
        nameKey: 'item_basic_boots',
        slot: 'boots',
        icon: 'assets/images/items/basic boots.png',
        description: 'Standard issue SFC boots with magnetic soles and oxygen reserve tanks.',
        descKey: 'item_basic_boots_desc',
        tags: ['Uniform'],
    },
    {
        id: 'stimpack',
        name: 'Stimpack',
        nameKey: 'item_stimpack',
        slot: 'consumable',
        icon: 'assets/images/items/stimpack.png',
        description: 'A quick injector that restores health in a pinch.',
        descKey: 'item_stimpack_desc',
        consumable: { type: 'heal', resource: 'Health', amount: 25 }
    },
    {
        id: 'first_aid_kit',
        name: 'First Aid Kit',
        nameKey: 'item_first_aid_kit',
        slot: 'consumable',
        icon: 'assets/images/items/first aid kit.png',
        description: 'Bandages and meds for treating minor injuries.',
        descKey: 'item_first_aid_kit_desc',
        consumable: { type: 'heal', resource: 'Health', amount: 15 }
    },
    {
        id: 'herb_tea',
        name: 'Herb Tea',
        nameKey: 'item_herb_tea',
        slot: 'consumable',
        icon: 'assets/images/items/herb tea.png',
        description: 'A warm herbal brew that boosts Stamina regeneration for a while.',
        descKey: 'item_herb_tea_desc',
        consumable: { type: 'buff', buff: 'staminaRegen', bonusPerSec: 0.2, durationMinutes: 720 }
    },
    {
        id: 'canteen',
        name: 'Canteen',
        nameKey: 'item_canteen_name',
        slot: 'inventory',
        equipSlots: ['accessory_1', 'accessory_2'],
        icon: 'assets/images/items/canteen.png',
        description: 'A durable canteen, currently empty. Can hold up to 50 units of water.',
        descKey: 'item_canteen_desc',
        consumable: { type: 'canteen_drink', amount: 10 }
    },
    {
        id: 'power_cell',
        name: 'Power Cell',
        nameKey: 'item_power_cell',
        slot: 'inventory',
        icon: 'assets/images/items/power cell.png',
        description: 'A compact energy cell used to power damaged systems.',
        stackable: true,
    },
    {
        id: 'bottled_water',
        name: 'Bottled Water',
        nameKey: 'item_bottled_water',
        slot: 'consumable',
        icon: 'assets/images/items/bottled water.png',
        description: 'A sealed bottle of clean drinking water.',
        descKey: 'item_bottled_water_desc',
        stackable: true,
        consumable: { type: 'heal', resource: 'Drinking Water', amount: 15 }
    },
    {
        id: 'packaged_food',
        name: 'Packaged Food',
        nameKey: 'item_packaged_food',
        slot: 'consumable',
        icon: 'assets/images/items/packaged food.png',
        description: 'Packaged rations, safe to eat.',
        descKey: 'item_packaged_food_desc',
        stackable: true,
        consumable: { type: 'heal', resource: 'Food Rations', amount: 25 }
    },

    // Quest items
    {
        id: 'rover_fuel_cell',
        name: 'Rover Fuel Cell',
        nameKey: 'item_rover_fuel_cell',
        slot: 'inventory',
        icon: 'assets/images/items/power cell.png',
        description: 'A high-capacity fuel cell salvaged from the rover. Could be used to supplement the ship\'s fuel reserves.',
        quest: true,
        stackable: true,
        tags: ['Quest'],
    },
    {
        id: 'terminal_login_note',
        name: 'Terminal Login Note',
        nameKey: 'item_terminal_login_note',
        slot: 'inventory',
        icon: 'assets/images/items/stickynote.png',
        description: 'A sticky note with scribbled login credentials. "Workshop terminal — user: crew01 / pass: vagabond47"',
        quest: true,
        tags: ['Quest'],
    },
    {
        id: 'repair_tools',
        name: 'Repair Tools',
        nameKey: 'item_repair_tools',
        slot: 'inventory',
        icon: 'assets/images/items/toolbox.png',
        description: 'A basic set of repair tools. Useful for fixing ship systems.',
        quest: true,
        tags: ['Quest'],
    },
    {
        id: 'scavenged_comms_panel',
        name: 'Scavenged Comms Panel',
        nameKey: 'item_scavenged_comms_panel',
        slot: 'inventory',
        icon: 'assets/images/items/commspanel.png',
        description: 'A battered comms panel ripped from the console — by you, during your escape. The amplifier is fried, the power cell is missing, and the connector is bent. With enough effort, it could be repaired in the workshop.',
        quest: true,
        tags: ['Quest'],
    },
    {
        id: 'signal_amplifier',
        name: 'Signal Amplifier',
        nameKey: 'item_signal_amplifier',
        slot: 'inventory',
        icon: 'assets/images/items/power cell.png',
        description: 'A freshly fabricated signal amplifier. Ready to be installed in the comms panel.',
        quest: true,
        tags: ['Quest'],
    },
    {
        id: 'functional_comms_panel',
        name: 'Functional Comms Panel',
        nameKey: 'item_functional_comms_panel',
        slot: 'inventory',
        icon: 'assets/images/items/commspanel.png',
        description: 'A fully repaired communications panel. Ready to be reinstalled in the comms station.',
        quest: true,
        tags: ['Quest'],
    },
];

export function getItemDefinition(id) {
    if (!id) return null;
    return items.find(x => x && x.id === id) || null;
}

// Debug test — spusť v konzoli: __testCanteenEquip()
if (typeof window !== 'undefined') {
    window.__testCanteenEquip = function () {
        const def = getItemDefinition('canteen');
        if (!def) { console.log('CANTEEN NOT FOUND in items!'); return; }
        console.log('canteen def:', JSON.stringify(def, null, 2));
        console.log('slot:', def.slot);
        console.log('equipSlots:', def.equipSlots);
        console.log('has consumable:', !!def.consumable);
    };
}