// Data-driven upgrade effects for tooltips / reward calculation.
// flag: name in gameFlags (boolean). resources: list of resource names affected.
// actions: null = any action; otherwise array of action ids to limit effect to specific actions.
export const upgradeEffects = [
    { flag: 'cafeteriaCookerInstalled', label: '+40% - Cooking Equipment', multiplier: 1.4, resources: ['Food Rations', 'Clean Water'], actions: null },
    { flag: 'tentsInstalled',             label: '+20% - Tents',                 multiplier: 1.2, resources: ['Energy'],                 actions: ['rest'] },
    { flag: 'sheltersInsulated',          label: '+10% - Insulation',            multiplier: 1.1, resources: ['Energy'],                 actions: ['rest'] },
    { flag: 'improvedForagingTools',      label: '+25% - Foraging Tools',        multiplier: 1.25, resources: ['Food Rations'],          actions: ['foraging'] },
    // Rain Catchers: passive water +10% to water_collection job
    { flag: 'rainCatchersInstalled',     label: '+10% - Rain Tarp',            multiplier: 1.10, resources: ['Clean Water'],           actions: ['water_collection'] }
];