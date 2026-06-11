// ==========================================================================
// Location: Gamma Site — Workshop
// ==========================================================================

export const workshop = {
    id: 'workshop',
    siteId: 'gamma_site',
    nameKey: 'loc_workshop',
    image: '',
    descriptionKey: 'loc_workshop_desc',
    actions: [
        {
            id: 'scavenge_tools',
            nameKey: 'action_scavenge_tools',
            descKey: 'action_scavenge_tools_desc',
            drain: [{ resource: 'Stamina', amount: 3 }, { resource: 'Food Rations', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_scavenge_tools'
        },
        {
            id: 'repair_kit',
            nameKey: 'action_repair_kit',
            descKey: 'action_repair_kit_desc',
            drain: [{ resource: 'Stamina', amount: 5 }, { resource: 'Food Rations', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_repair_kit'
        },
        {
            id: 'survey_area',
            nameKey: 'action_survey_area',
            descKey: 'action_survey_area_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 2,
            repeatable: true
        },
        {
            id: 'go_crew_quarters',
            nameKey: 'action_go_crew_quarters',
            descKey: 'action_go_crew_quarters_desc',
            targetLocation: 'crew_quarters',
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
