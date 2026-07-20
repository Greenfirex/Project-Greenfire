// ==========================================================================
// Location: Gamma Site — Landing Site
// The player's first step outside the Vagabond into an alien jungle.
// ==========================================================================

export const gammaSiteLandingSite = {
    id: 'gamma_site_landing_site',
    siteId: 'gamma_site',
    nameKey: 'loc_gamma_site_landing_site',
    image: 'assets/images/localmap/landingsite.png',
    descriptionKey: 'loc_gamma_site_landing_site_desc',
    pois: [
        {
            id: 'ship',
            nameKey: 'poi_vagabond',
            actions: ['reenter_ship']
        },
        {
            id: 'ravine',
            nameKey: 'poi_ravine',
            actions: ['investigate_ravine']
        },
        {
            id: 'gamma_site',
            nameKey: 'poi_gamma_site',
            actions: []
        },
        {
            id: 'western_forest',
            nameKey: 'poi_western_forest',
            actions: ['head_west']
        },
        {
            id: 'eastern_path',
            nameKey: 'poi_eastern_path',
            actions: ['head_east']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['reenter_ship']
        }
    ],
    actions: [
        {
            id: 'reenter_ship',
            nameKey: 'action_reenter_ship',
            descKey: 'action_reenter_ship_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_main_area',
            resultKey: 'result_reenter_ship'
        },
        {
            id: 'investigate_ravine',
            nameKey: 'action_investigate_ravine',
            descKey: 'action_investigate_ravine_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 20,
            oneTime: true,
            resultKey: 'result_investigate_ravine'
        },
        {
            id: 'head_west',
            nameKey: 'action_head_west',
            descKey: 'action_head_west_desc',
            drain: [{ resource: 'Stamina', amount: 5 }],
            durationSeconds: 30,
            oneTime: true,
            resultKey: 'result_head_west'
        },
        {
            id: 'head_east',
            nameKey: 'action_head_east',
            descKey: 'action_head_east_desc',
            drain: [{ resource: 'Stamina', amount: 5 }],
            durationSeconds: 30,
            oneTime: true,
            resultKey: 'result_head_east'
        }
    ]
};