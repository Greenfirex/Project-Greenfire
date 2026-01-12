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
        stats: { armor: 2, stamina: -5 }
    },
    {
        id: 'utility_legs',
        name: 'Basic Legs',
        slot: 'legs',
        icon: 'assets/images/items/utility_legs.svg',
        stats: { stamina: 5 }
    }
];

export function getItemDefinition(id) {
    if (!id) return null;
    return items.find(x => x && x.id === id) || null;
}
