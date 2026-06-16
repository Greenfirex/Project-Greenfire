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
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 3 }],
            rewards: [{ type: 'item', name: 'Scrap Metal' }],
            durationSeconds: 15,
            repeatable: true,
            repeatLimit: 3,
            resultKey: 'result_scavenge_tools'
        },
        {
            id: 'repair_kit',
            nameKey: 'action_repair_kit',
            descKey: 'action_repair_kit_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 5 }],
            durationSeconds: 25,
            oneTime: true,
            resultKey: 'result_repair_kit'
        },
        {
            id: 'survey_area',
            nameKey: 'action_survey_area',
            descKey: 'action_survey_area_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            repeatable: true
        },
        {
            id: 'go_crew_quarters',
            nameKey: 'action_go_crew_quarters',
            descKey: 'action_go_crew_quarters_desc',
            category: 'taxing',
            targetLocation: 'gamma_crew_quarters',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 15,
            repeatable: true
        }
    ]
};