// ==========================================================================
// Location: Scout Ship — Workshop
// ==========================================================================

import { setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';
import { hasSkill } from '../../../character/character.js';

export const scoutShipWorkshop = {
    id: 'scout_ship_workshop',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_workshop',
    image: 'assets/images/localmap/workshop.png',
    descriptionKey: 'loc_scout_ship_workshop_desc',
    pois: [
        {
            id: 'workbench',
            nameKey: 'poi_workbench',
            actions: ['search_workbench', 'grab_login_note', 'grab_tools', 'assemble_comms']
        },
        {
            id: 'prototype_bench',
            nameKey: 'poi_prototype_bench',
            actions: ['tinker_device']
        },
        {
            id: 'fabricator',
            nameKey: 'poi_fabricator',
            actions: ['fabricate_amplifier']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        // ==========================================================================
        // Workbench search → login note + tools
        // ==========================================================================
        {
            id: 'search_workbench',
            nameKey: 'action_search_workbench',
            descKey: 'action_search_workbench_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            isAvailable(ctx) {
                if (hasMilestone('workbench_searched')) return false;
                return true;
            },
            resultKey: 'result_search_workbench',
            onComplete(ctx) {
                setMilestone('workbench_searched', () => ctx.persistLoopKnowledge());
                ctx.flagActionAsNew('grab_login_note');
                ctx.flagActionAsNew('grab_tools');
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'grab_login_note',
            nameKey: 'action_grab_login_note',
            descKey: 'action_grab_login_note_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Terminal Login Note', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_grab_login_note',
            isAvailable(ctx) {
                return hasMilestone('workbench_searched');
            },
            onComplete(ctx) {
                setMilestone('login_note_found', () => ctx.persistLoopKnowledge());
                // If terminals were already examined, retroactively unhide "Use Login Note"
                try {
                    const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                    if (crewLoc) {
                        const crewUs = ctx.getUnlockState('scout_ship_crew_quarters');
                        if (crewUs['check_terminal']) {
                            const useA = (crewLoc.actions || []).find(a => a.id === 'use_terminal_login');
                            if (useA && useA._completed) { useA._completed = false; ctx.flagActionAsNew('use_terminal_login'); }
                        }
                    }
                } catch { /* ignore */ }
                try {
                    const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                    if (bridgeLoc) {
                        const bridgeUs = ctx.getUnlockState('scout_ship_bridge');
                        if (bridgeUs['check_bridge_terminal']) {
                            const useA = (bridgeLoc.actions || []).find(a => a.id === 'use_bridge_terminal_login');
                            if (useA && useA._completed) { useA._completed = false; ctx.flagActionAsNew('use_bridge_terminal_login'); }
                        }
                    }
                } catch { /* ignore */ }
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'grab_tools',
            nameKey: 'action_grab_tools',
            descKey: 'action_grab_tools_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            rewards: [{ type: 'item', name: 'Repair Tools', amount: 1 }],
            durationSeconds: 5,
            oneTime: true,
            resultKey: 'result_grab_tools',
            isAvailable(ctx) {
                return hasMilestone('workbench_searched');
            }
        },
        {
            id: 'tinker_device',
            nameKey: 'action_tinker_device',
            descKey: 'action_tinker_device_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 30,
            durationIfRemembered: 10,
            oneTime: true,
            requiredItems: ['repair_tools'],
            requiredSkill: { skill: 'engineering', tier: 1 },
            remembersCondition(ctx) { return !!(ctx.gameFlags.loopKnowledge?.milestones?.tinkered_device); },
            rewards: [{ type: 'item', name: 'Power Cell', amount: 1 }],
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
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.tinkered_device) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                return m.tinkered_device ? 'result_tinker_device_known' : 'result_tinker_device';
            },
            onComplete(ctx) {
                setMilestone('tinkered_device', () => ctx.persistLoopKnowledge());
            }
        },

        // ==========================================================================
        // Comms Panel Repair Chain
        // ==========================================================================

        {
            id: 'fabricate_amplifier',
            nameKey: 'action_fabricate_amplifier',
            descKey: 'action_fabricate_amplifier_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 45,
            durationIfRemembered: 15,
            oneTime: true,
            remembersCondition(ctx) { return hasMilestone('comms_repaired'); },
            isAvailable(ctx) {
                return hasMilestone('comms_diagnosed');
            },
            onStart(ctx) {
                if (hasMilestone('comms_repaired')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                if (hasMilestone('comms_repaired')) return 'result_fabricate_amplifier_known';
                if (hasMilestone('book_read')) return 'result_fabricate_amplifier_book';
                return 'result_fabricate_amplifier';
            },
            rewards: [{ type: 'item', name: 'Signal Amplifier', amount: 1 }],
        },
        {
            id: 'assemble_comms',
            nameKey: 'action_assemble_comms',
            descKey: 'action_assemble_comms_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 4 }],
            rewards: [{ type: 'item', name: 'Functional Comms Panel', amount: 1 }],
            durationSeconds: 30,
            durationIfRemembered: 20,
            oneTime: true,
            requiresItem: 'scavenged_comms_panel',
            requiredItems: ['scavenged_comms_panel', 'signal_amplifier', 'power_cell', 'repair_tools'],
            remembersCondition(ctx) { return hasMilestone('comms_repaired'); },
            isAvailable(ctx) {
                return hasMilestone('comms_diagnosed');
            },
            onStart(ctx) {
                if (hasMilestone('comms_repaired')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
                // Check for all required parts — collect all missing
                const missing = [];
                if (!ctx.countItemInBag('signal_amplifier')) missing.push(ctx.t('item_signal_amplifier'));
                if (!ctx.countItemInBag('power_cell')) missing.push(ctx.t('item_power_cell'));
                if (!ctx.countItemInBag('repair_tools')) missing.push(ctx.t('item_repair_tools'));
                if (missing.length > 0) {
                    ctx.addLogEntry(ctx.t('log_need_items', { items: missing.join(', ') }), ctx.LogType.ERROR);
                    return { block: true };
                }
                // repair_tools is already covered by requiresItem
            },
            getResultKey(ctx) {
                return hasMilestone('comms_repaired') ? 'result_assemble_comms_known' : 'result_assemble_comms';
            },
            onComplete(ctx) {
                setMilestone('comms_repaired', () => ctx.persistLoopKnowledge());
                // Consume parts used in assembly
                ctx.consumeItemQuantityFromBag('signal_amplifier', 1);
                ctx.consumeItemQuantityFromBag('power_cell', 1);
            }
        },

        {
            id: 'go_to_main_area',
            nameKey: 'action_go_to_main_area',
            descKey: 'action_go_to_main_area_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_main_area',
            resultKey: 'result_go_to_main_area'
        }
    ]
};