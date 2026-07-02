// ==========================================================================
// Location: Scout Ship — Bridge / Cockpit
// ==========================================================================

import { hasLogin, setMilestone, hasMilestone } from '../../../../engine/gameFlags.js';

export const scoutShipBridge = {
    id: 'scout_ship_bridge',
    siteId: 'scout_ship',
    nameKey: 'loc_scout_ship_bridge',
    image: 'assets/images/localmap/cockpit.png',
    descriptionKey: 'loc_scout_ship_bridge_desc',
    pois: [
        {
            id: 'navigation',
            nameKey: 'poi_navigation',
            actions: ['check_navigation', 'scan_planet_surface', 'scan_gamma_site', 'set_course_gamma']
        },
        {
            id: 'controls',
            nameKey: 'poi_controls',
            actions: ['check_status']
        },
        {
            id: 'engineering',
            nameKey: 'poi_engineering',
            actions: ['check_bridge_terminal', 'check_reactor_status', 'optimize_reactor', 'hack_bridge_terminal', 'use_bridge_terminal_login', 'enter_known_credentials_bridge']
        },
        {
            id: 'travel',
            nameKey: 'poi_travel',
            actions: ['go_to_main_area']
        }
    ],
    actions: [
        {
            id: 'check_navigation',
            nameKey: 'action_check_navigation',
            descKey: 'action_check_navigation_desc',
            drain: [{ resource: 'Stamina', amount: 2 }],
            durationSeconds: 8,
            oneTime: true,
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.gamma_coordinates_known) return 'result_check_navigation_coords';
                if (hasMilestone('planet_scanned')) return 'result_check_navigation_known';
                if (hasMilestone('navigation_checked')) return 'result_check_navigation_loop';
                return 'result_check_navigation_first';
            },
            onComplete(ctx) {
                if (!hasMilestone('navigation_checked')) {
                    setMilestone('navigation_checked', () => ctx.persistLoopKnowledge());
                    ctx.flagActionAsNew('scan_planet_surface');
                    ctx.setFullRebuildNeeded(true);
                }
            },
        },
        {
            id: 'scan_planet_surface',
            nameKey: 'action_scan_planet_surface',
            descKey: 'action_scan_planet_surface_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 120,
            oneTime: true,
            isAvailable(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (m.gamma_coordinates_known) return false;
                return hasMilestone('navigation_checked') && !hasMilestone('planet_scanned');
            },
            resultKey: 'result_scan_planet_surface',
            onComplete(ctx) {
                setMilestone('planet_scanned', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'scan_gamma_site',
            nameKey: 'action_scan_gamma_site',
            descKey: 'action_scan_gamma_site_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 60,
            oneTime: true,
            isAvailable(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                return !!m.gamma_coordinates_known && !hasMilestone('gamma_site_confirmed_on_scanner');
            },
            resultKey: 'result_scan_gamma_site',
            onComplete(ctx) {
                setMilestone('gamma_site_confirmed_on_scanner', () => ctx.persistLoopKnowledge());
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'check_reactor_status',
            nameKey: 'action_check_reactor_status',
            descKey: 'action_check_reactor_status_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            suppressCompletionLog: true,
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return ['hack_bridge_terminal', 'use_bridge_terminal_login', 'enter_known_credentials_bridge'].some(id => us[id]);
            },
            revealsAreaSupplies: true,
            unlocks: ['optimize_reactor'],
            onComplete(ctx) {
                setMilestone('fuel_scanned', () => ctx.persistLoopKnowledge());
                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
                const currentFuel = fuel ? Math.round(fuel.amount) : 0;
                const FUEL_DRAIN_PER_MIN = ctx.gameFlags.reactorOptimized ? 1.20 : 1.80;
                const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);
                ctx.addLogEntry(ctx.t('result_check_reactor_status', { fuel: currentFuel, minutes: projectedMins }), ctx.LogType.SUCCESS);
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'hack_bridge_terminal',
            nameKey: 'action_hack_bridge_terminal',
            descKey: 'action_hack_bridge_terminal_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 180,
            oneTime: true,
            resultKey: 'result_hack_bridge_terminal',
            isAvailable(ctx) { return !!ctx.getUnlockState(ctx.getCurrentLocationId())['check_bridge_terminal']; },
            hides: ['use_bridge_terminal_login', 'enter_known_credentials_bridge'],
            unlocks: ['enter_known_credentials'],
            onComplete(ctx) {
                setMilestone('bridge_terminal_hacked', () => ctx.persistLoopKnowledge());
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['hack_bridge_terminal'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                // Cross-location hides
                const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                if (crewLoc) {
                    ['hack_terminal', 'use_terminal_login'].forEach(id => {
                        const a = (crewLoc.actions || []).find(x => x.id === id);
                        if (a) a._completed = true;
                    });
                }
                const wsLoc = ctx.getLocation('scout_ship_workshop');
                if (wsLoc && Array.isArray(wsLoc.actions)) {
                    const na = wsLoc.actions.find(a => a.id === 'grab_login_note');
                    if (na) na._completed = true;
                }
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'use_bridge_terminal_login',
            nameKey: 'action_use_bridge_terminal_login',
            descKey: 'action_use_bridge_terminal_login_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_use_bridge_terminal_login',
            requiresItem: 'terminal_login_note',
            isAvailable(ctx) {
                if (!ctx.getUnlockState(ctx.getCurrentLocationId())['check_bridge_terminal']) return false;
                if (hasLogin(ctx.gameFlags.loopKnowledge?.milestones || {})) return false;
                return true;
            },
            hides: ['hack_bridge_terminal', 'enter_known_credentials_bridge'],
            unlocks: ['enter_known_credentials'],
            onComplete(ctx) {
                setMilestone('bridge_terminal_note_used', () => ctx.persistLoopKnowledge());
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['use_bridge_terminal_login'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                if (crewLoc) {
                    ['hack_terminal', 'use_terminal_login'].forEach(id => {
                        const a = (crewLoc.actions || []).find(x => x.id === id);
                        if (a) a._completed = true;
                    });
                }
                const wsLoc = ctx.getLocation('scout_ship_workshop');
                if (wsLoc && Array.isArray(wsLoc.actions)) {
                    const na = wsLoc.actions.find(a => a.id === 'grab_login_note');
                    if (na) na._completed = true;
                }
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'enter_known_credentials_bridge',
            nameKey: 'action_enter_known_credentials_bridge',
            descKey: 'action_enter_known_credentials_bridge_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            isAvailable(ctx) { return !!ctx.getUnlockState(ctx.getCurrentLocationId())['check_bridge_terminal']; },
            hides: ['hack_bridge_terminal', 'use_bridge_terminal_login'],
            onComplete(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['enter_known_credentials_bridge'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'check_bridge_terminal',
            nameKey: 'action_check_bridge_terminal',
            descKey: 'action_check_bridge_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            isAvailable(ctx) { return true; },
            onComplete(ctx) {
                setMilestone('bridge_terminal_checked', () => ctx.persistLoopKnowledge());
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                us['check_bridge_terminal'] = true;
                ctx.setUnlockState(ctx.getCurrentLocationId(), us);
                ctx.setFullRebuildNeeded(true);
            },
        },
        {
            id: 'optimize_reactor',
            nameKey: 'action_optimize_reactor',
            descKey: 'action_optimize_reactor_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 30,
            durationIfRemembered: 10,
            oneTime: true,
            remembersCondition(ctx) { return hasMilestone('reactor_optimized'); },
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['check_reactor_status'];
            },
            onStart(ctx) {
                const knowsLogin = hasLogin(ctx.gameFlags.loopKnowledge?.milestones || {});
                if (!knowsLogin) {
                    ctx.addLogEntry(ctx.t('log_need_terminal_login'), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (ctx.gameFlags.reactorOptimized) return { block: true };
                if (hasMilestone('reactor_optimized')) {
                    ctx.action.durationSeconds = ctx.action.durationIfRemembered;
                }
            },
            getResultKey(ctx) {
                return hasMilestone('reactor_optimized') ? 'result_optimize_reactor_known' : 'result_optimize_reactor';
            },
            onComplete(ctx) {
                ctx.gameFlags.reactorOptimized = true;
                const alreadyKnew = hasMilestone('reactor_optimized');
                setMilestone('reactor_optimized', () => ctx.persistLoopKnowledge());
                if (alreadyKnew) {
                    // Player has done this before — they realize they can do it from any terminal
                    setMilestone('reactor_remote_hint_seen', () => ctx.persistLoopKnowledge());
                    ctx.addLogEntry(ctx.t('log_reactor_terminal_hint'), ctx.LogType.UNLOCK);
                }
                const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                if (bridgeLoc) {
                    const a = (bridgeLoc.actions || []).find(a => a.id === 'optimize_reactor');
                    if (a) a._completed = true;
                }
                const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                if (crewLoc) {
                    const a = (crewLoc.actions || []).find(a => a.id === 'optimize_reactor_remote');
                    if (a) a._completed = true;
                }
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'check_status',
            nameKey: 'action_check_status',
            descKey: 'action_check_status_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 8,
            repeatable: true,
            resultKey: 'result_check_status'
        },
        {
            id: 'set_course_gamma',
            nameKey: 'action_set_course_gamma',
            descKey: 'action_set_course_gamma_desc',
            category: 'taxing',
            drain: [{ resource: 'Stamina', amount: 6 }],
            durationSeconds: 120,
            oneTime: true,
            resultKey: 'result_set_course_gamma',
            isAvailable(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                if (!m.gamma_coordinates_known) return false;
                // Must have terminal access
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return ['hack_bridge_terminal', 'use_bridge_terminal_login', 'enter_known_credentials_bridge'].some(id => us[id]);
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