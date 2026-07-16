// ==========================================================================
// Location: Scout Ship — Crew Quarters (starting location)
// ==========================================================================

import { gameFlags, setMilestone, hasMilestone, flagActionAsNew } from '../../../../engine/gameFlags.js';
import { hasEffect } from '../../../../engine/effects.js';

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
            actions: ['check_terminal', 'hack_terminal', 'use_terminal_login', 'enter_known_credentials', 'access_logs', 'disable_alarm', 'optimize_reactor_remote']
        },
        {
            id: 'bunks',
            nameKey: 'poi_bunks',
            actions: ['wake_up', 'search_bunks', 'rest', 'read_book', 'grab_uniform', 'debug_taxing']
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
            addsEffect: 'alarm',
            results: {
                default: 'result_wake_up',
                loop1: 'result_wake_up_loop1',
                loop2: 'result_wake_up_loop2',
            },
            onCompleteLoop2(ctx) {
                const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                if (bridgeLoc) {
                    const bus = ctx.getUnlockState('scout_ship_bridge');
                    bus['check_bridge_terminal'] = true;
                    ctx.setUnlockState('scout_ship_bridge', bus);
                    ['check_bridge_terminal', 'hack_bridge_terminal', 'use_bridge_terminal_login'].forEach(id => {
                        const a = (bridgeLoc.actions || []).find(x => x.id === id);
                        if (a) a._completed = true;
                    });
                }
                ctx.flagActionAsNew('enter_known_credentials_bridge');
                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
                const currentFuel = fuel ? Math.round(fuel.amount) : 0;
                const projectedMins = Math.round(currentFuel / 1.8);
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (!m.fuel_scanned) {
                    setMilestone('fuel_scanned', () => ctx.persistLoopKnowledge());
                }
                ctx.initAreaResources('scout_ship_bridge');
                ctx.revealAreaResources('scout_ship_bridge');
                if (typeof window !== 'undefined') {
                    window._currentAreaResourceList = ctx.areaResources['scout_ship_bridge'] || [];
                }
                ctx.showAreaSuppliesPanel();
                ctx.persistLoopKnowledge();
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'check_terminal',
            nameKey: 'action_check_terminal',
            descKey: 'action_check_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            durationIfRemembered: 5,
            oneTime: true,
            remembersCondition(ctx) { return hasMilestone('crew_terminal_checked'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['wake_up']) return false;
                return true;
            },
            onStart(ctx) {
                if (hasMilestone('crew_terminal_checked')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                const loop = ctx.gameFlags.loopCount || 0;
                const alreadyChecked = m.crew_terminal_checked;
                const known = hasMilestone('bridge_terminal_access');

                if (!alreadyChecked) {
                    if (known) return 'result_check_terminal_first_has_login';
                    return 'result_check_terminal';
                }
                if (loop >= 2) return 'result_check_terminal_loop2';
                if (loop >= 1) return 'result_check_terminal_loop1';
                return 'result_check_terminal_known';
            },
            unlocks: ['enter_known_credentials'],
            onComplete(ctx) {
                setMilestone('crew_terminal_checked', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (!loc) return;
                const unlockState = ctx.getUnlockState(loc.id);
                unlockState['check_terminal'] = true;
                ctx.setUnlockState(loc.id, unlockState);
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'hack_terminal',
            nameKey: 'action_hack_terminal',
            descKey: 'action_hack_terminal_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 180,
            oneTime: true,
            resultKey: 'result_hack_terminal',
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_terminal']) return false;
                if (hasMilestone('crew_terminal_access')) return false;
                return true;
            },
            hides: ['use_terminal_login', 'enter_known_credentials'],
            onComplete(ctx) {
                setMilestone('crew_terminal_hacked', () => ctx.persistLoopKnowledge());
                setMilestone('crew_terminal_access', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const us = ctx.getUnlockState(loc.id);
                    us['hack_terminal'] = true;
                    ctx.setUnlockState(loc.id, us);
                }
                ctx.gameFlags.crewTerminalAccessThisLoop = true;
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'use_terminal_login',
            nameKey: 'action_use_terminal_login',
            descKey: 'action_use_terminal_login_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_use_terminal_login',
            requiresItem: 'terminal_login_note',
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_terminal']) return false;
                if (!hasMilestone('login_note_found')) return false;
                if (ctx.countItemInBag('terminal_login_note') <= 0) return false;
                if (hasMilestone('crew_terminal_access')) return false;
                if (hasMilestone('bridge_terminal_access')) return false;
                return true;
            },
            hides: ['hack_terminal', 'enter_known_credentials'],
            onComplete(ctx) {
                setMilestone('crew_terminal_note_used', () => ctx.persistLoopKnowledge());
                setMilestone('crew_terminal_access', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const us = ctx.getUnlockState(loc.id);
                    us['use_terminal_login'] = true;
                    ctx.setUnlockState(loc.id, us);
                }
                ctx.gameFlags.crewTerminalAccessThisLoop = true;
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'enter_known_credentials',
            nameKey: 'action_enter_known_credentials_name',
            descKey: 'action_enter_known_credentials_name_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['check_terminal']) return false;
                if (!hasMilestone('bridge_terminal_access') && !hasMilestone('crew_terminal_access')) return false;
                return true;
            },
            results: {
                default: 'result_enter_known_credentials',
                loop2: 'result_enter_known_credentials_loop2',
            },
            hides: ['hack_terminal', 'use_terminal_login'],
            unlocks: ['access_logs', 'disable_alarm'],
            onComplete(ctx) {
                setMilestone('crew_terminal_access', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const us = ctx.getUnlockState(loc.id);
                    us['enter_known_credentials'] = true;
                    ctx.setUnlockState(loc.id, us);
                }
                ctx.gameFlags.crewTerminalAccessThisLoop = true;
                // Hint about remote reactor optimization (loop 2+ only)
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2 && hasMilestone('reactor_optimized') && !ctx.gameFlags.reactorOptimized) {
                    ctx.addLogEntry(ctx.t('log_reactor_terminal_hint'), ctx.LogType.UNLOCK);
                }
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'access_logs',
            nameKey: 'action_access_logs',
            descKey: 'action_access_logs_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 10,
            oneTime: true,
            resultKey: 'result_access_logs',
            isAvailable(ctx) {
                if (!ctx.gameFlags.crewTerminalAccessThisLoop) return false;
                return hasMilestone('crew_terminal_access');
            }
        },
        {
            id: 'search_bunks',
            nameKey: 'action_search_bunks',
            descKey: 'action_search_bunks_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 20,
            durationIfRemembered: 10,
            oneTime: true,
            remembersCondition(ctx) { return hasMilestone('bunk_searched'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['wake_up'];
            },
            results: {
                default: 'result_search_bunks',
                loop1: 'result_search_bunks_loop1',
                loop2: 'result_search_bunks_loop2',
            },
            getResultKey(ctx) {
                if (hasMilestone('book_read')) return 'result_search_bunks_bookread';
                return null;
            },
            onComplete(ctx) {
                setMilestone('bunk_searched', () => ctx.persistLoopKnowledge());
            },
            unlocksAll: true
        },
        {
            id: 'rest',
            nameKey: 'action_rest',
            descKey: 'action_rest_desc',
            category: 'rest',
            drain: [],
            rewards: [
                { type: 'resource', name: 'Stamina', amount: 30 },
                { type: 'resource', name: 'Health', amount: 8 }
            ],
            durationSeconds: 15,
            repeatable: true,
            cancellable: true,
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['wake_up'];
            }
        },
        {
            id: 'disable_alarm',
            nameKey: 'action_disable_alarm',
            descKey: 'action_disable_alarm_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 12,
            durationIfRemembered: 6,
            oneTime: true,
            resultKey: 'result_disable_alarm',
            removesEffect: 'alarm',
            remembersCondition(ctx) { return hasMilestone('crew_terminal_access') && ctx.gameFlags.loopCount >= 1; },
            isAvailable(ctx) {
                if (!ctx.gameFlags.crewTerminalAccessThisLoop) return false;
                return hasMilestone('crew_terminal_access');
            },
            onStart(ctx) {
                if (hasMilestone('crew_terminal_access') && ctx.gameFlags.loopCount >= 1) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
        },
        {
            id: 'check_storage',
            nameKey: 'action_check_storage',
            descKey: 'action_check_storage_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 12,
            durationIfRemembered: 6,
            oneTime: true,
            rewards: [{ type: 'item', name: 'Canteen', amount: 1 }],
            remembersCondition(ctx) { return hasMilestone('storage_checked'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['wake_up'];
            },
            onStart(ctx) {
                if (hasMilestone('storage_checked')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            results: {
                default: 'result_check_storage',
                loop1: 'result_check_storage_loop1',
                loop2: 'result_check_storage_loop2',
            },
            onComplete(ctx) {
                setMilestone('storage_checked', () => ctx.persistLoopKnowledge());
            }
        },
        {
            id: 'read_book',
            nameKey: 'action_read_book',
            descKey: 'action_read_book_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 60,
            oneTime: true,
            resultKey: 'result_read_book',
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['search_bunks']) return false;
                if (hasMilestone('book_read')) return false;
                return true;
            },
            onComplete(ctx) {
                setMilestone('book_read', () => ctx.persistLoopKnowledge());
                ctx.addLogEntry(ctx.t('log_skill_learned', { skill: ctx.t('skill_engineering_t1_name') }), ctx.LogType.UNLOCK);
            }
        },
        {
            id: 'debug_taxing',
            nameKey: 'action_debug_taxing',
            descKey: 'action_debug_taxing_desc',
            category: 'taxing',
            drainRates: { 'Stamina': 1.00, 'Food Rations': 0.40, 'Drinking Water': 0.60 },
            durationSeconds: 10,
            repeatable: true,
            resultKey: 'result_debug_taxing',
            isAvailable(ctx) {
                return !!window.DEBUG_TAXING_VISIBLE;
            }
        },
        {
            id: 'optimize_reactor_remote',
            nameKey: 'action_optimize_reactor_remote',
            descKey: 'action_optimize_reactor_remote_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 8,
            oneTime: true,
            isAvailable(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop < 2) return false;
                if (!ctx.gameFlags.crewTerminalAccessThisLoop) return false;
                if (!hasMilestone('reactor_optimized')) return false;
                if (ctx.gameFlags.reactorOptimized) return false;
                return true;
            },
            onStart(ctx) {
                if (ctx.gameFlags.reactorOptimized) return { block: true };
            },
            getResultKey(ctx) {
                return 'result_optimize_reactor_remote';
            },
            onComplete(ctx) {
                ctx.gameFlags.reactorOptimized = true;
                setMilestone('reactor_optimized', () => ctx.persistLoopKnowledge());
                const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                if (bridgeLoc) {
                    const a = (bridgeLoc.actions || []).find(a => a.id === 'optimize_reactor');
                    if (a) a._completed = true;
                }
                const crewLoc = ctx.getLocation(ctx.getCurrentLocationId());
                if (crewLoc) {
                    const a = (crewLoc.actions || []).find(a => a.id === 'optimize_reactor_remote');
                    if (a) a._completed = true;
                }
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'grab_uniform',
            nameKey: 'action_grab_uniform',
            descKey: 'action_grab_uniform_desc',
            category: 'simple',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 8,
            durationIfRemembered: 4,
            oneTime: true,
            remembersCondition(ctx) { return hasMilestone('uniform_remembered'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                if (!us['wake_up']) return false;
                if (ctx.gameFlags.uniformGrabbed) return false;
                return true;
            },
            onStart(ctx) {
                if (ctx.gameFlags.uniformGrabbed) return { block: true };
                const loop = ctx.gameFlags.loopCount || 0;
                const lifeSupportFailed = hasEffect('life_support_failure');
                if (loop < 1 && !lifeSupportFailed) {
                    ctx.gameFlags.uniformNoticed = true;
                    ctx.addLogEntry(ctx.t('log_uniform_no_reason'), ctx.LogType.SUCCESS);
                    return { block: true };
                }
                if (hasMilestone('uniform_remembered')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2) return 'result_grab_uniform_loop2';
                if (loop >= 1) return 'result_grab_uniform_loop1';
                if (ctx.gameFlags.uniformNoticed) return 'result_grab_uniform_tried';
                return 'result_grab_uniform';
            },
            rewards: [
                { type: 'item', name: 'Basic Helmet', amount: 1 },
                { type: 'item', name: 'Basic Armor', amount: 1 },
                { type: 'item', name: 'Basic Boots', amount: 1 },
            ],
            onComplete(ctx) {
                ctx.gameFlags.uniformGrabbed = true;
                setMilestone('uniform_remembered', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
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
            resultKey: 'result_go_to_main_area',
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['wake_up'];
            }
        }
    ]
};