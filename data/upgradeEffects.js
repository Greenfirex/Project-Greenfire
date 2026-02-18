// Data-driven upgrade effects for tooltips / reward calculation.
// flag: name in gameFlags (boolean). resources: list of resource names affected.
// actions: null = any action; otherwise array of action ids to limit effect to specific actions.
export const upgradeEffects = [
    { flag: 'cafeteriaCookerInstalled', label: 'Cooking Equipment: +40%', multiplier: 1.4, resources: ['Food Rations', 'Drinking Water'], actions: null },
    // Salvaged cooking equipment also improves camp job efficiency slightly.
    { flag: 'cafeteriaCookerInstalled', label: 'Cooking Equipment: +10%', multiplier: 1.10, resources: ['Provisions'], actions: ['foraging'] },
    { flag: 'cafeteriaCookerInstalled', label: 'Cooking Equipment: +10%', multiplier: 1.10, resources: ['Water'], actions: ['water_collection'] },
    { flag: 'tentsInstalled',             label: 'Tents: +20%',                 multiplier: 1.2, resources: ['Stamina'],                 actions: ['rest', 'sleep'] },
    { flag: 'sheltersInsulated',          label: 'Insulation: +10%',            multiplier: 1.1, resources: ['Stamina'],                 actions: ['rest', 'sleep'] },
    // Crude Foraging Tools: affects both personal foraging (Food Rations) and camp foraging job (Provisions)
    { flag: 'improvedForagingTools',      label: 'Crude Foraging Tools: +25%',        multiplier: 1.25, resources: ['Food Rations'],          actions: ['forageFood'] },
    { flag: 'improvedForagingTools',      label: 'Crude Foraging Tools: +25%',        multiplier: 1.25, resources: ['Provisions'],           actions: ['foraging'] },
    { flag: 'rainCatchersInstalled',     label: 'Rain Tarp: +10%',            multiplier: 1.10, resources: ['Water'],                 actions: null },
    { flag: 'purificationUnitInstalled',  label: 'Water Purification Unit: +20%',     multiplier: 1.20, resources: ['Drinking Water'],         actions: ['purifyWater'] },
    { flag: 'purificationUnitInstalled',  label: 'Water Purification Unit: +15%',     multiplier: 1.15, resources: ['Water'],                 actions: ['water_collection'] },
    // Display label for Scrap Collector boost on job/tooltips
    { flag: 'scavengerKitInstalled',      label: 'Scavenger Kit: +20%',         multiplier: 1.20, resources: ['Metal Parts'],           actions: ['scrap_collector'] }
];

// Compute a combined reward multiplier based on enabled upgrade flags.
// actionId: id of the completed action (e.g., 'purifyWater')
// resourceName: resource being rewarded (e.g., 'Drinking Water')
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