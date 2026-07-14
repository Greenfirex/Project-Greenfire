// ==========================================================================
// Location: Scout Ship — Main Area / Cafeteria
// ==========================================================================

import { setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';
import { hasSkill } from '../../../character/character.js';
import { hasEffect, removeEffect, activeEffects } from '../../../../engine/effects.js';

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
            actions: ['check_comms', 'install_comms', 'send_ping', 'send_targeted_ping', 'check_ping_results']
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
            rewards: [{ type: 'resource', name: 'Drinking Water', amount: 5 }],
            durationSeconds: 5,
            repeatable: true,
            cancellable: true,
            drainsAreaResource: { resource: 'area_water', amount: 5 },
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
                if (ctx.gameFlags.commsInstalled) return false;
                return true;
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                const knowsDamage = hasMilestone('comms_diagnosed');
                if (knowsDamage && loop >= 2) return 'result_check_comms_loop3';
                if (knowsDamage && loop >= 1) return 'result_check_comms_loop2';
                return 'result_check_comms_v2';
            },
            rewards: [{ type: 'item', name: 'Scavenged Comms Panel', amount: 1 }],
            unlocks: ['fabricate_amplifier'],
            onComplete(ctx) {
                setMilestone('comms_diagnosed', () => ctx.persistLoopKnowledge());
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
            unlocks: ['send_ping', 'check_ping_results'],
            onComplete(ctx) {
                ctx.gameFlags.commsInstalled = true;
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'send_ping',
            nameKey: 'action_send_ping',
            descKey: 'action_send_ping_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            addsEffect: 'waiting_ping',
            isAvailable(ctx) {
                if (!ctx.gameFlags.commsInstalled) return false;
                if (hasMilestone('gamma_site_heard')) return false;
                return true;
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2) return 'result_send_ping_loop';
                return 'result_send_ping';
            },
            onComplete(ctx) {
                setMilestone('ping_sent', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'send_targeted_ping',
            nameKey: 'action_send_targeted_ping',
            descKey: 'action_send_targeted_ping_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            addsEffect: 'waiting_ping_targeted',
            isAvailable(ctx) {
                if (!ctx.gameFlags.commsInstalled) return false;
                if (!hasMilestone('gamma_site_heard')) return false;
                if (hasMilestone('gamma_coordinates_known')) return false;
                return true;
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2) return 'result_send_targeted_ping_loop';
                return 'result_send_targeted_ping';
            },
            onComplete(ctx) {
                setMilestone('targeted_ping_sent', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'check_ping_results',
            nameKey: 'action_check_ping_results',
            descKey: 'action_check_ping_results_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 15,
            oneTime: false,
            repeatable: true,
            isAvailable(ctx) {
                if (!ctx.gameFlags.commsInstalled) return false;
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.gamma_coordinates_known) return false;
                try {
                    const hasWaitingPing = hasEffect('waiting_ping');
                    const hasWaitingTargeted = hasEffect('waiting_ping_targeted');
                    const pingEff = activeEffects.find(e => e.id === 'waiting_ping');
                    const targetedEff = activeEffects.find(e => e.id === 'waiting_ping_targeted');
                    if (hasWaitingPing && pingEff && (pingEff.progress >= pingEff.maxProgress)) return true;
                    if (hasWaitingTargeted && targetedEff && (targetedEff.progress >= targetedEff.maxProgress)) return true;
                } catch { /* ignore */ }
                return false;
            },
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.gamma_site_heard) return 'result_check_ping_results_targeted';
                return 'result_check_ping_results_first';
            },
            onComplete(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (hasEffect('waiting_ping_targeted')) {
                    removeEffect('waiting_ping_targeted');
                    setMilestone('gamma_coordinates_known', () => ctx.persistLoopKnowledge());
                } else if (hasEffect('waiting_ping')) {
                    removeEffect('waiting_ping');
                    setMilestone('gamma_site_heard', () => ctx.persistLoopKnowledge());
                    ctx.flagActionAsNew('send_targeted_ping');
                }
                ctx.setFullRebuildNeeded(true);
            },
        },

        // ==========================================================================
        // Recycler
        // ==========================================================================

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
            requiredSkill: { skill: 'engineering', tier: 1 },
            remembersCondition(ctx) { return hasMilestone('recycler_repaired'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['assess_supplies'];
            },
            onStart(ctx) {
                const hasTools = ctx.countItemInBag('repair_tools') > 0;
                const hasEngSkill = hasSkill('engineering', 1);
                if (!hasTools && !hasEngSkill) {
                    ctx.addLogEntry(ctx.t('log_need_item', { item: ctx.t('item_repair_tools') }), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (!hasTools) {
                    ctx.addLogEntry(ctx.t('log_need_item', { item: ctx.t('item_repair_tools') }), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (!hasEngSkill) {
                    ctx.addLogEntry(ctx.t('log_need_skill', { skill: ctx.t('skill_engineering_t1_name') }), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (!ctx.gameFlags.recyclerAttempted) {
                    ctx.gameFlags.recyclerAttempted = true;
                    ctx.flagActionAsNew('grab_tools');
                    ctx.setFullRebuildNeeded(true);
                    ctx.refreshUI();
                }
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
                setMilestone('recycler_repaired', () => ctx.persistLoopKnowledge());
            }
        },

        // ==========================================================================
        // Travel
        // ==========================================================================

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