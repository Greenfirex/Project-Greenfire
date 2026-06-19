// ==========================================================================
// Location: Scout Ship — Workshop
// ==========================================================================

export const scoutShipWorkshop = {
    id: 'scout_ship_workshop',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_workshop',
    image: 'assets/images/localmap/workshop.png',
    descriptionKey: 'loc_scout_ship_workshop_desc',
    pois: [
        {
            id: 'workbench',
            nameKey: 'poi_workbench',
            actions: ['repair_ship_systems']
        },
        {
            id: 'prototype_bench',
            nameKey: 'poi_prototype_bench',
            actions: ['tinker_device']
        },
        {
            id: 'fabricator',
            nameKey: 'poi_fabricator',
            actions: ['fabricate_parts']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        {
            id: 'repair_ship_systems',
            nameKey: 'action_repair_ship_systems',
            descKey: 'action_repair_ship_systems_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 6 }],
            rewards: [{ type: 'resource', name: 'Food Rations', amount: 1 }, { type: 'resource', name: 'Drinking Water', amount: 1 }],
            durationSeconds: 30,
            repeatable: true,
            resultKey: 'result_repair_ship_systems'
        },
        {
            id: 'tinker_device',
            nameKey: 'action_tinker_device',
            descKey: 'action_tinker_device_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 300,
            oneTime: true,
            resultKey: 'result_tinker_device'
        },
        {
            id: 'fabricate_parts',
            nameKey: 'action_fabricate_parts',
            descKey: 'action_fabricate_parts_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 4 }],
            rewards: [{ type: 'resource', name: 'Food Rations', amount: 2 }],
            durationSeconds: 20,
            oneTime: true,
            resultKey: 'result_fabricate_parts'
        },
        {
            id: 'go_to_main_area',
            nameKey: 'action_go_to_main_area',
            descKey: 'action_go_to_main_area_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_main_area'
        }
    ]
};