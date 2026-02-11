// Minimal item definitions for Character inventory/equipment.
// Pure data module: keep IDs stable for saves.

export const items = [
    {
        id: 'basic_helmet',
        name: 'Basic Helmet',
        slot: 'head',
        icon: 'assets/images/items/basic_helmet.svg',
        stats: { armor: 1 }
    },
    {
        id: 'field_armor',
        name: 'Basic Armor',
        slot: 'chest',
        icon: 'assets/images/items/field_armor.svg',
        // Also increases personal carryable supplies (Food/Water) capacity.
        stats: { armor: 2, stamina: -5, foodCapacity: 40, waterCapacity: 40 }
    },
    {
        id: 'utility_legs',
        name: 'Basic Legs',
        slot: 'legs',
        icon: 'assets/images/items/utility_legs.svg',
        stats: { stamina: 5 }
    },
    {
        id: 'basic_boots',
        name: 'Basic Boots',
        slot: 'boots',
        icon: 'assets/images/items/basic_boots.svg',
        stats: { evasion: 3 }
    },
    {
        id: 'spiked_branch',
        name: 'Spiked Branch',
        slot: 'weapon',
        icon: 'assets/images/items/spiked_branch.svg',
        stats: { damage: 2, attackSpeed: 0.1 }
    },
    {
        id: 'metal_spear',
        name: 'Metal Spear',
        slot: 'weapon',
        icon: 'assets/images/items/metal_spear.svg',
        // Slightly better than Spiked Branch
        stats: { damage: 3, attackSpeed: 0.1 }
    },
    {
        id: 'stimpack',
        name: 'Stimpack',
        slot: 'consumable',
        icon: 'assets/images/items/stimpack.svg',
        // Consumables are used via UI buttons (e.g., combat popup)
        consumable: { type: 'heal', resource: 'Health', amount: 25 }
    },
    {
        id: 'first_aid_kit',
        name: 'First Aid Kit',
        slot: 'consumable',
        // Reuse existing consumable icon until unique art exists.
        icon: 'assets/images/items/stimpack.svg',
        consumable: { type: 'heal', resource: 'Health', amount: 15 }
    },
    {
        id: 'basic_torch',
        name: 'Basic Torch',
        slot: 'accessory',
        icon: 'assets/images/items/basic_torch.svg',
        stats: { evasion: 0 }
    },
    {
        id: 'canteen',
        name: 'Canteen',
        slot: 'accessory',
        icon: 'assets/images/items/canteen.svg',
        // Increases personal carryable Drinking Water capacity.
        stats: { waterCapacity: 15 }
    }
];

export function getItemDefinition(id) {
    if (!id) return null;
    return items.find(x => x && x.id === id) || null;
}
