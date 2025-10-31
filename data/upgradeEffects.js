// Data-driven upgrade effects for tooltips / reward calculation.
// flag: name in gameFlags (boolean). resources: list of resource names affected.
// actions: null = any action; otherwise array of action ids to limit effect to specific actions.
export const upgradeEffects = [
    { flag: 'cafeteriaCookerInstalled', label: '+40% - Cooking Equipment', multiplier: 1.4, resources: ['Food Rations', 'Clean Water'], actions: null },
    { flag: 'tentsInstalled',             label: '+20% - Tents',                 multiplier: 1.2, resources: ['Energy'],                 actions: ['rest'] },
    { flag: 'sheltersInsulated',          label: '+10% - Insulation',            multiplier: 1.1, resources: ['Energy'],                 actions: ['rest'] },
    { flag: 'improvedForagingTools',      label: '+25% - Foraging Tools',        multiplier: 1.25, resources: ['Food Rations'],          actions: ['foraging'] },
    { flag: 'rainCatchersInstalled',     label: '+10% - Rain Tarp',            multiplier: 1.10, resources: ['Clean Water'],           actions: ['water_collection'] },
    { flag: 'purificationUnitInstalled',  label: '+20% - Purification Unit',     multiplier: 1.20, resources: ['Clean Water'],           actions: ['purifyWater'] }
];

// Compute a combined reward multiplier based on enabled upgrade flags.
// actionId: id of the completed action (e.g., 'purifyWater')
// resourceName: resource being rewarded (e.g., 'Clean Water')
// gameFlags: object with booleans for installed upgrades
export function computeRewardMultiplier(actionId, resourceName, gameFlags) {
    if (!resourceName || !gameFlags) return 1;
    const aid = (actionId || '').toLowerCase();
    let mul = 1;
    for (const eff of upgradeEffects) {
        if (!gameFlags[eff.flag]) continue;
        if (eff.resources && !eff.resources.includes(resourceName)) continue;
        if (Array.isArray(eff.actions) && eff.actions.length > 0) {
            const matches = eff.actions.some(a => (a || '').toLowerCase() === aid);
            if (!matches) continue;
        }
        mul *= eff.multiplier || 1;
    }
    return mul;
}

// Compute both multiplier and human-readable labels for tooltip display, using the same
// matching logic as computeRewardMultiplier so previews and runtime stay in sync.
export function computeRewardEffects(actionId, resourceName, gameFlags) {
    if (!resourceName || !gameFlags) return { multiplier: 1, labels: [] };
    const aid = (actionId || '').toLowerCase();
    let mul = 1;
    const labels = [];
    for (const eff of upgradeEffects) {
        if (!gameFlags[eff.flag]) continue;
        if (eff.resources && !eff.resources.includes(resourceName)) continue;
        if (Array.isArray(eff.actions) && eff.actions.length > 0) {
            const matches = eff.actions.some(a => (a || '').toLowerCase() === aid);
            if (!matches) continue;
        }
        mul *= eff.multiplier || 1;
        if (eff.label) labels.push(eff.label);
    }
    return { multiplier: mul, labels };
}