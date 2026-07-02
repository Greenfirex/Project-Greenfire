// ==========================================================================
// Location: Scout Ship — Main Area / Cargo Bay
// ==========================================================================

import { setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';

export const scoutShipMainArea = {
    id: 'scout_ship_main_area',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_main_area',
    image: 'assets/images/localmap/mainarea.png',
    descriptionKey: 'loc_scout_ship_main_area_desc',
    pois: [
        {
            id: 'supplies',
            nameKey: 'poi_supplies',
            actions: ['assess_supplies', 'grab_proviant', 'grab_bottled_water', 'drink_water']
        },
        {
            id: 'comms',
            nameKey: 'poi_comms',
            actions: ['check_comms', 'install_comms', 'send_ping', 'send_targeted_ping', 'check_ping_results']
        },
        {
            id: 'recycler',
            nameKey: 'poi_recycler',
            actions: ['repair_recycler']
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
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            resultKey: 'result_assess_supplies',
            initAreaOnComplete: 'scout_ship_main_area',
            revealAreaOnComplete: 'scout_ship_main_area',
        },
        {
            id: 'grab_proviant',
            nameKey: 'action_grab_proviant',
            descKey: 'action_grab_proviant_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Food Rations', amount: 2 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_assess_supplies',
            isAvailable(ctx) {
                return ctx.gameFlags.loopCount >= 1 || hasMilestone('supplies_assessed');
            },
        },
        {
            id: 'grab_bottled_water',
            nameKey: 'action_grab_bottled_water',
            descKey: 'action_grab_bottled_water_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Bottled Water', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_grab_bottled_water',
            isAvailable(ctx) {
                return ctx.gameFlags.loopCount >= 1 || hasMilestone('supplies_assessed');
            },
        },
        {
            id: 'drink_water',
            nameKey: 'action_drink_water',
            descKey: 'action_drink_water_desc',
            category: 'refresh',
            drain: [],
            rewards: [{ type: 'resource', name: 'Drinking Water', amount: 5 }],
            durationSeconds: 5,
            repeatable: true,
            resultKey: 'result_check_storage',
        },
        {
            id: 'check_comms',
            nameKey: 'action_check_comms',
            descKey: 'action_check_comms_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 12,
            oneTime: true,
            resultKey: 'result_check_comms',
            unlocks: ['fabricate_amplifier'],
            onComplete(ctx) {
                setMilestone('comms_diagnosed', () => ctx.persistLoopKnowledge());
            },
        },
        {
            id: 'install_comms',
            nameKey: 'action_install_comms',
            descKey: 'action_install_comms_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 30,
            oneTime: true,
            requiresItem: 'functional_comms_panel',
            resultKey: 'result_install_comms',
            isAvailable(ctx) {
                return hasMilestone('comms_repaired');
            },
            unlocks: ['send_ping'],
            onComplete(ctx) {
                ctx.gameFlags.commsInstalled = true;
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'send_ping',
            nameKey: 'action_send_ping',
            descKey: 'action_send_ping_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 30,
            oneTime: true,
            resultKey: 'result_send_ping',
            addsEffect: 'waiting_ping',
            isAvailable(ctx) {
                return ctx.gameFlags.commsInstalled && !hasMilestone('gamma_site_heard');
            },
            onComplete(ctx) {
                setMilestone('ping_sent', () => ctx.persistLoopKnowledge());
            },
        },
        {
            id: 'check_ping_results',
            nameKey: 'action_check_ping_results',
            descKey: 'action_check_ping_results_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            isAvailable(ctx) {
                return hasMilestone('ping_sent') && !hasMilestone('gamma_site_heard');
            },
            resultKey: 'result_check_ping_results_first',
            removesEffect: 'waiting_ping',
            unlocks: ['send_targeted_ping'],
            onComplete(ctx) {
                setMilestone('gamma_coordinates_known', () => ctx.persistLoopKnowledge());
                setMilestone('gamma_site_heard', () => ctx.persistLoopKnowledge());
            },
        },
        {
            id: 'send_targeted_ping',
            nameKey: 'action_send_targeted_ping',
            descKey: 'action_send_targeted_ping_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 45,
            oneTime: true,
            resultKey: 'result_send_targeted_ping',
            addsEffect: 'waiting_ping_targeted',
            isAvailable(ctx) {
                return hasMilestone('gamma_site_heard') && hasMilestone('gamma_coordinates_known') && !hasMilestone('targeted_ping_sent');
            },
            onComplete(ctx) {
                setMilestone('targeted_ping_sent', () => ctx.persistLoopKnowledge());
            },
        },
        {
            id: 'repair_recycler',
            nameKey: 'action_repair_recycler',
            descKey: 'action_repair_recycler_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 20,
            oneTime: true,
            resultKey: 'result_check_storage',
            isAvailable(ctx) { return !ctx.gameFlags.recyclerFixed; },
            onStart(ctx) {
                if (ctx.gameFlags.recyclerFixed) return { block: true };
                if (ctx.gameFlags.recyclerAttempted) {
                ctx.addLogEntry(ctx.t('log_need_terminal_login'), ctx.LogType.INFO);
                    return { block: true };
                }
                ctx.gameFlags.recyclerAttempted = true;
            },
            onComplete(ctx) {
                ctx.gameFlags.recyclerFixed = true;
                setMilestone('recycler_repaired', () => ctx.persistLoopKnowledge());
                ctx.addLogEntry(ctx.t('result_wake_up'), ctx.LogType.SUCCESS);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'go_to_crew_quarters',
            nameKey: 'action_go_to_crew_quarters',
            descKey: 'action_go_to_crew_quarters_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_crew_quarters',
            resultKey: 'result_go_to_crew_quarters'
        },
        {
            id: 'go_to_bridge',
            nameKey: 'action_go_to_bridge',
            descKey: 'action_go_to_bridge_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_bridge',
            resultKey: 'result_go_to_bridge'
        },
        {
            id: 'go_to_workshop',
            nameKey: 'action_go_to_workshop',
            descKey: 'action_go_to_workshop_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_workshop',
            resultKey: 'result_go_to_workshop'
        }
    ]
};