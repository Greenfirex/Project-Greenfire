// ==========================================================================
// Location: Scout Ship — Bridge / Cockpit
// ==========================================================================

export const scoutShipBridge = {
    id: 'scout_ship_bridge',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_bridge',
    image: 'assets/images/localmap/cockpit.png',
    descriptionKey: 'loc_scout_ship_bridge_desc',
    pois: [
        {
            id: 'navigation',
            nameKey: 'poi_navigation',
            actions: ['check_navigation', 'scan_systems']
        },
        {
            id: 'controls',
            nameKey: 'poi_controls',
            actions: ['check_status']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        {
            id: 'check_navigation',
            nameKey: 'action_check_navigation',
            descKey: 'action_check_navigation_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 12,
            repeatable: true,
            resultKey: 'result_check_navigation'
        },
        {
            id: 'scan_systems',
            nameKey: 'action_scan_systems',
            descKey: 'action_scan_systems_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            repeatable: true,
            resultKey: 'result_scan_systems'
        },
        {
            id: 'check_status',
            nameKey: 'action_check_status',
            descKey: 'action_check_status_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 8,
            repeatable: true,
            resultKey: 'result_check_status'
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
