// Inventory alias mapping: treat certain legacy "resource" names as inventory items.
// This lets action/task definitions keep using { resource: "Power Cells" } etc
// while the actual storage lives in Character inventory.

export const INVENTORY_RESOURCE_ALIASES = Object.freeze({
    'Crude Prybar': 'crude_prybar',
    'Makeshift Explosive': 'makeshift_explosive',
    'Power Cells': 'power_cell',
    'Bottled Water': 'bottled_water',
    'Packaged Food': 'packaged_food',
});

export function getItemIdForResourceName(resourceName) {
    const key = String(resourceName || '');
    return INVENTORY_RESOURCE_ALIASES[key] || null;
}

export function isInventoryAliasResourceName(resourceName) {
    return !!getItemIdForResourceName(resourceName);
}
