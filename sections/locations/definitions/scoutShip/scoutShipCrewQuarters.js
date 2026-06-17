// ==========================================================================
// Location: Scout Ship — Crew Quarters (starting location)
// ==========================================================================

export const scoutShipCrewQuarters = {
    id: 'scout_ship_crew_quarters',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_crew_quarters',
    image: 'assets/images/localmap/crewquarters.png',
    descriptionKey: 'loc_scout_ship_crew_quarters_desc',
    pois: [
        {
            id: 'terminal',
            nameKey: 'poi_terminal',
            actions: ['check_terminal', 'access_logs', 'disable_alarm']
        },
        {
            id: 'bunks',
            nameKey: 'poi_bunks',
            actions: ['wake_up', 'search_bunks', 'rest']
        },
        {
            id: 'storage',
            nameKey: 'poi_storage',
            actions: ['check_storage']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        {
            id: 'wake_up',
            nameKey: 'action_wake_up',
            descKey: 'action_wake_up_desc',
            drain: [{ resource: 'Stamina', amount: 0 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_wake_up',
            unlocksAll: true
        },
        {
            id: 'check_terminal',
            nameKey: 'action_check_terminal',
            descKey: 'action_check_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            resultKey: 'result_check_terminal',
            unlockedBy: 'wake_up'
        },
        {
            id: 'access_logs',
            nameKey: 'action_access_logs',
            descKey: 'action_access_logs_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            resultKey: 'result_access_logs',
            unlockedBy: 'wake_up'
        },
        {
            id: 'search_bunks',
            nameKey: 'action_search_bunks',
            descKey: 'action_search_bunks_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 20,
            oneTime: true,
            resultKey: 'result_search_bunks',
            unlockedBy: 'wake_up'
        },
        {
            id: 'rest',
            nameKey: 'action_rest',
            descKey: 'action_rest_desc',
            category: 'rest',
            drain: [],
            rewards: [{ type: 'resource', name: 'Stamina', amount: 5 }],
            durationSeconds: 0,
            repeatable: true,
            cancellable: true,
            unlockedBy: 'wake_up'
        },
        {
            id: 'disable_alarm',
            nameKey: 'action_disable_alarm',
            descKey: 'action_disable_alarm_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 12,
            oneTime: true,
            resultKey: 'result_disable_alarm',
            removesEffect: 'alarm',
            unlockedBy: 'wake_up'
        },
        {
            id: 'check_storage',
            nameKey: 'action_check_storage',
            descKey: 'action_check_storage_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 12,
            oneTime: true,
            resultKey: 'result_check_storage',
            unlockedBy: 'wake_up'
        },
        {
            id: 'go_to_main_area',
            nameKey: 'action_go_to_main_area',
            descKey: 'action_go_to_main_area_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_main_area',
            unlockedBy: 'wake_up'
        }
    ]
};
