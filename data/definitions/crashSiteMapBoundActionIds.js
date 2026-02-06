// Action IDs that are rendered via the Local Map (tile-bound), not as global Crash Site list actions.
// Used to avoid treating tile-only actions as "new content" for section-level menu badges.

export const CRASH_SITE_MAP_BOUND_ACTION_IDS = new Set([
    'move',
    'sitDown',
    'rest',
    'sleep',
    'drinkCaveWater',
    'purifyWater',
    'attemptReentry',
    'attemptAlternateAccess',
    'scavengeDebris',
    'makeCrudePrybar',
    'huntWildlife',
    'createBasicTorch',
    'craftMetalSpear',
    'pryOpenHull',

    // Map-tile actions (ship interior / base camp)
    'stripWiring',
    'investigateSound',
    'establishBaseCamp',
    'refillCanteen',
    'packRations',
    'haulWater',
    'haulBerries',

    // Ship interior tile actions (rendered on E4/E6/F5)
    'searchNorthCorridor',
    'searchSouthCorridor',
    'investigateBridge',

    // Ship interior room actions (tile-bound)
    'exploreCafeteria',
    'checkCrewQuarters',
    'searchLabs',
    'searchPowerCore',
    'restoreEmergencyPower',

    // Radio repair flow
    'scavengeCommsPanel',
    'fixLongRangeRadio',

    // Beyond the Perimeter
    'investigateDistantSmoke',

    // Resource gathering should be local-map-only
    'forageFood',
    'collectChemicals',
    'scavengeCafeteriaSupplies',
    'collectFabric',
]);
