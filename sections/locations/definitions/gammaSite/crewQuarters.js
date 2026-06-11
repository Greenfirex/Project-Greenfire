// ==========================================================================
// Location: Gamma Site — Crew Quarters (starting location)
// ==========================================================================

export const crewQuarters = {
    id: 'crew_quarters',
    siteId: 'gamma_site',
    nameKey: 'loc_crew_quarters',
    image: 'assets/images/localmap/crewquarters.png',
    descriptionKey: 'loc_crew_quarters_desc',
    actions: [
        {
            id: 'search_bunks',
            nameKey: 'action_search_bunks',
            descKey: 'action_search_bunks_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 4,
            oneTime: true,
            resultKey: 'result_search_bunks'
        },
        {
            id: 'check_terminal',
            nameKey: 'action_check_terminal',
            descKey: 'action_check_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_check_terminal'
        },
        {
            id: 'rest',
            nameKey: 'action_rest',
            descKey: 'action_rest_desc',
            drain: [{ resource: 'Stamina', amount: -5 }],
            durationSeconds: 3,
            repeatable: true
        },
        {
            id: 'go_workshop',
            nameKey: 'action_go_workshop',
            descKey: 'action_go_workshop_desc',
            targetLocation: 'workshop',
            drain: [
                { resource: 'Stamina', amount: 4 },
                { resource: 'Food Rations', amount: 3 },
                { resource: 'Drinking Water', amount: 3 }
            ],
            durationSeconds: 3,
            repeatable: true
        }
    ]
};
