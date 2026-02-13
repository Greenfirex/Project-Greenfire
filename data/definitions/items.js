// Minimal item definitions for Character inventory/equipment.
// Pure data module: keep IDs stable for saves.

export const items = [
    {
        id: 'basic_helmet',
        name: 'Basic Helmet',
        slot: 'head',
        icon: 'assets/images/items/basic helmet.png',
        stats: { armor: 1 }
    },
    {
        id: 'field_armor',
        name: 'Basic Armor',
        slot: 'chest',
        icon: 'assets/images/items/basic chest armor.png',
        // Also increases personal carryable supplies (Food/Water) capacity.
        stats: { armor: 2, stamina: -5, foodCapacity: 40, waterCapacity: 40 }
    },
    {
        id: 'utility_legs',
        name: 'Basic Legs',
        slot: 'legs',
        icon: 'assets/images/items/basic leg armor.png',
        stats: { stamina: 5 }
    },
    {
        id: 'basic_boots',
        name: 'Basic Boots',
        slot: 'boots',
        icon: 'assets/images/items/basic boots.png',
        stats: { evasion: 3 }
    },
    {
        id: 'spiked_branch',
        name: 'Spiked Branch',
        slot: 'weapon',
        icon: 'assets/images/items/spiked branch.png',
        stats: { damage: 2, attackSpeed: 0.1 }
    },
    {
        id: 'metal_spear',
        name: 'Metal Spear',
        slot: 'weapon',
        icon: 'assets/images/items/metal spear.png',
        // Slightly better than Spiked Branch
        stats: { damage: 3, attackSpeed: 0.1 }
    },
    {
        id: 'stimpack',
        name: 'Stimpack',
        slot: 'consumable',
        icon: 'assets/images/items/stimpack.png',
        // Consumables are used via UI buttons (e.g., combat popup)
        consumable: { type: 'heal', resource: 'Health', amount: 25 }
    },
    {
        id: 'first_aid_kit',
        name: 'First Aid Kit',
        slot: 'consumable',
        icon: 'assets/images/items/first aid kit.png',
        consumable: { type: 'heal', resource: 'Health', amount: 15 }
    },
    {
        id: 'herb_tea',
        name: 'Herb Tea',
        slot: 'consumable',
        icon: 'assets/images/items/herb tea.png',
        description: 'A warm herbal brew. Temporarily increases Stamina regeneration.',
        consumable: { type: 'buff', buff: 'staminaRegen', bonusPerSec: 0.2, durationMinutes: 720 }
    },
    {
        id: 'basic_torch',
        name: 'Basic Torch',
        slot: 'accessory',
        icon: 'assets/images/items/basic torch.png',
        stats: { evasion: 0, hitChance: 1 }
    },
    {
        id: 'canteen',
        name: 'Canteen',
        slot: 'accessory',
        icon: 'assets/images/items/canteen.png',
        // Increases personal carryable Drinking Water capacity.
        stats: { waterCapacity: 15 }
    },

    // Chapter 1 tools / quest items (stored in inventory, not resources)
    {
        id: 'crude_prybar',
        name: 'Crude Prybar',
        slot: 'inventory',
        icon: 'assets/images/items/crude prybar.png',
    },
    {
        id: 'makeshift_explosive',
        name: 'Makeshift Explosive',
        slot: 'inventory',
        icon: 'assets/images/items/makeshift explosive.png',
    },
    {
        id: 'power_cell',
        name: 'Power Cell',
        slot: 'inventory',
        icon: 'assets/images/items/power cell.png',
        stackable: true,
    }
];

export function getItemDefinition(id) {
    if (!id) return null;
    return items.find(x => x && x.id === id) || null;
}
