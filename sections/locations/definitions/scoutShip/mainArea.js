// ==========================================================================
// Location: Scout Ship — Main Area / Cafeteria
// ==========================================================================

export const scoutShipMainArea = {
    id: 'scout_ship_main_area',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_main_area',
    image: 'assets/images/localmap/mainarea.png',
    descriptionKey: 'loc_scout_ship_main_area_desc',
    pois: [
        {
            id: 'cafeteria',
            nameKey: 'poi_cafeteria',
            actions: ['assess_supplies', 'grab_proviant', 'grab_bottled_water', 'drink_water']
        },
        {
            id: 'communications',
            nameKey: 'poi_communications',
            actions: ['check_comms']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_crew_quarters', 'go_to_bridge', 'go_to_workshop']
        }
    ],
    actions: [
        {
            id: 'assess_supplies',
            nameKey: 'action_assess_supplies',
            descKey: 'action_assess_supplies_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            resultKey: 'result_assess_supplies',
            revealsAreaSupplies: true,
            unlocksAll: true
        },
        {
            id: 'grab_proviant',
            nameKey: 'action_grab_proviant',
            descKey: 'action_grab_proviant_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Packaged Food', amount: 1 }],
            durationSeconds: 5,
            repeatable: true,
            repeatLimit: 2,
            unlockedBy: 'assess_supplies'
        },
        {
            id: 'grab_bottled_water',
            nameKey: 'action_grab_bottled_water',
            descKey: 'action_grab_bottled_water_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Bottled Water', amount: 1 }],
            durationSeconds: 5,
            repeatable: true,
            repeatLimit: 2,
            unlockedBy: 'assess_supplies'
        },
        {
            id: 'drink_water',
            nameKey: 'action_drink_water',
            descKey: 'action_drink_water_desc',
            category: 'refresh',
            drain: [],
            rewards: [{ type: 'resource', name: 'Drinking Water', amount: 1 }],
            durationSeconds: 5,
            repeatable: true,
            cancellable: true,
            drainsAreaResource: { resource: 'area_water', amount: 1 },
            requiresAreaResource: 'area_water'
        },
        {
            id: 'check_comms',
            nameKey: 'action_check_comms',
            descKey: 'action_check_comms_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            repeatable: true,
            resultKey: 'result_check_comms'
        },
        {
            id: 'go_to_crew_quarters',
            nameKey: 'action_go_to_crew_quarters',
            descKey: 'action_go_to_crew_quarters_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_crew_quarters'
        },
        {
            id: 'go_to_bridge',
            nameKey: 'action_go_to_bridge',
            descKey: 'action_go_to_bridge_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_bridge'
        },
        {
            id: 'go_to_workshop',
            nameKey: 'action_go_workshop',
            descKey: 'action_go_workshop_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_workshop'
        }
    ]
};