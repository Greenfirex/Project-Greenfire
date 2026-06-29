// ==========================================================================
// Location: Scout Ship — Main Area / Cafeteria
// ==========================================================================

import { hasLogin, setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';

function persistLoopKnowledge(ctx) {
    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = { milestones: {} };
        state.gameFlags.loopKnowledge = { milestones: { ...ctx.gameFlags.loopKnowledge?.milestones } };
        localStorage.setItem('gameState', JSON.stringify(state));
    } catch { /* ignore */ }
}

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
            actions: ['assess_supplies', 'grab_proviant', 'grab_bottled_water', 'drink_water', 'repair_recycler']
        },
        {
            id: 'communications',
            nameKey: 'poi_communications',
            actions: ['check_comms', 'install_comms', 'send_distress_signal', 'listen_for_response']
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
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['assess_supplies'];
            }
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
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['assess_supplies'];
            }
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

        // ==========================================================================
        // Communications — reworked with comms panel chain
        // ==========================================================================

        {
            id: 'check_comms',
            nameKey: 'action_check_comms',
            descKey: 'action_check_comms_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            isAvailable(ctx) {
                // Hidden if comms already installed in this loop
                if (ctx.gameFlags.commsInstalled) return false;
                return true;
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                const knowsDamage = hasMilestone('comms_diagnosed');
                // loopCount = 0 for first life, 1 after first death, 2 after second...
                if (knowsDamage && loop >= 2) return 'result_check_comms_loop3';
                if (knowsDamage && loop >= 1) return 'result_check_comms_loop2';
                return 'result_check_comms_v2';
            },
            rewards: [{ type: 'item', name: 'Scavenged Comms Panel', amount: 1 }],
            onComplete(ctx) {
                setMilestone('comms_diagnosed', () => persistLoopKnowledge(ctx));
                ctx.flagActionAsNew('fabricate_amplifier');
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'install_comms',
            nameKey: 'action_install_comms',
            descKey: 'action_install_comms_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 20,
            oneTime: true,
            requiresItem: 'functional_comms_panel',
            resultKey: 'result_install_comms',
            isAvailable(ctx) {
                if (ctx.gameFlags.commsInstalled) return false;
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_comms']) return false;
                return true;
            },
            onComplete(ctx) {
                ctx.gameFlags.commsInstalled = true;
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'send_distress_signal',
            nameKey: 'action_send_distress_signal',
            descKey: 'action_send_distress_signal_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 15,
            oneTime: true,
            resultKey: 'result_send_distress_signal',
            isAvailable(ctx) {
                return ctx.gameFlags.commsInstalled;
            },
            onComplete(ctx) {
                ctx.gameFlags.distressSignalSent = true;
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'listen_for_response',
            nameKey: 'action_listen_for_response',
            descKey: 'action_listen_for_response_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 8,
            oneTime: true,
            suppressCompletionLog: true,
            isAvailable(ctx) {
                if (!ctx.gameFlags.distressSignalSent) return false;
                return true;
            },
            getResultKey(ctx) {
                return null; // handled in onComplete
            },
            onComplete(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 3) {
                    // Loop 4+: Clear coordinates
                    ctx.addLogEntry(ctx.t('result_listen_for_response_loop4'), ctx.LogType.SUCCESS);
                    setMilestone('gamma_coordinates_known', () => persistLoopKnowledge(ctx));
                } else if (loop >= 2) {
                    // Loop 3: Confirmed fragment
                    ctx.addLogEntry(ctx.t('result_listen_for_response_loop3'), ctx.LogType.SUCCESS);
                    setMilestone('gamma_site_confirmed', () => persistLoopKnowledge(ctx));
                } else {
                    // Loop 2: Whisper — uncertain
                    ctx.addLogEntry(ctx.t('result_listen_for_response_loop2'), ctx.LogType.SUCCESS);
                    setMilestone('gamma_site_heard', () => persistLoopKnowledge(ctx));
                }
                ctx.setFullRebuildNeeded(true);
            }
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
            id: 'repair_recycler',
            nameKey: 'action_repair_recycler',
            descKey: 'action_repair_recycler_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 20,
            durationIfRemembered: 10,
            oneTime: true,
            repeatable: false,
            requiredItems: ['repair_tools'],
            remembersCondition(ctx) { return hasMilestone('recycler_repaired'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['assess_supplies'];
            },
            onStart(ctx) {
                if (!ctx.countItemInBag('repair_tools')) {
                    ctx.addLogEntry(ctx.t('log_need_item', { item: ctx.t('item_repair_tools') }), ctx.LogType.ERROR);
                    return { block: true };
                }
                // Mark attempt on first click — needed to unlock grab_tools in workshop
                if (!ctx.gameFlags.recyclerAttempted) {
                    ctx.gameFlags.recyclerAttempted = true;
                    ctx.flagActionAsNew('grab_tools');
                    ctx.setFullRebuildNeeded(true);
                    ctx.refreshUI();
                }
                if (!hasMilestone('book_read')) {
                    ctx.addLogEntry(ctx.t('log_recycler_no_idea'), ctx.LogType.SUCCESS);
                    return { block: true };
                }
                // Adjust duration for repeat repairs
                if (hasMilestone('recycler_repaired')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                    ctx.addLogEntry(ctx.t('log_recycler_remember'), ctx.LogType.INFO);
                }
            },
            getResultKey(ctx) {
                return hasMilestone('recycler_repaired') ? 'result_repair_recycler_remember' : 'result_repair_recycler_first';
            },
            onComplete(ctx) {
                ctx.gameFlags.recyclerFixed = true;
                setMilestone('recycler_repaired', () => persistLoopKnowledge(ctx));
            }
        },
        {
            id: 'go_to_workshop',
            nameKey: 'action_go_workshop',
            descKey: 'action_go_workshop_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_workshop',
            resultKey: 'result_go_to_workshop'
        }
    ]
};