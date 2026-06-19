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
            actions: ['get_food', 'drink_water', 'grab_bottled_water']
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
            id: 'get_food',
            nameKey: 'action_get_food',
            descKey: 'action_get_food_desc',
            category: 'refresh',
            drain: [],
            rewards: [{ type: 'resource', name: 'Food Rations', amount: 2 }],
            durationSeconds: 0,
            repeatable: true,
            cancellable: true
        },
        {
            id: 'drink_water',
            nameKey: 'action_drink_water',
            descKey: 'action_drink_water_desc',
            category: 'refresh',
            drain: [],
            rewards: [{ type: 'resource', name: 'Drinking Water', amount: 2 }],
            durationSeconds: 0,
            repeatable: true,
            cancellable: true
        },
        {
            id: 'grab_bottled_water',
            nameKey: 'action_grab_bottled_water',
            descKey: 'action_grab_bottled_water_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Bottled Water', amount: 1 }],
            durationSeconds: 8,
            oneTime: true,
            resultKey: 'result_grab_bottled_water'
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
            nameKey: 'action_go_to_workshop',
            descKey: 'action_go_to_workshop_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_workshop'
        }
    ]
};
