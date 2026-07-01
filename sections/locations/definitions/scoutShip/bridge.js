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
            id: 'check_bridge_terminal',
            nameKey: 'action_check_bridge_terminal',
            descKey: 'action_check_bridge_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            getResultKey(ctx) {
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                const loop = ctx.gameFlags.loopCount || 0;
                const alreadyChecked = m.bridge_terminal_checked;
                const knowsLogin = hasLogin(m);

                if (!alreadyChecked) {
                    if (knowsLogin) return 'result_check_bridge_terminal_first_has_login';
                    return 'result_check_bridge_terminal';
                }
                if (loop >= 2) return 'result_check_bridge_terminal_loop2';
                if (loop >= 1) return 'result_check_bridge_terminal_loop1';
                return 'result_check_bridge_terminal_known';
            },
            onComplete(ctx) {
                setMilestone('bridge_terminal_checked', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (!loc) return;
                const unlockState = ctx.getUnlockState(loc.id);
                unlockState['check_bridge_terminal'] = true;
                ctx.setUnlockState(loc.id, unlockState);
                const m = ctx.gameFlags.loopKnowledge?.milestones || {};
                const loginKnown = hasLogin(m);
                const noteFound = hasMilestone('login_note_found');

                const hackA = (loc.actions || []).find(a => a.id === 'hack_bridge_terminal');
                const useA  = (loc.actions || []).find(a => a.id === 'use_bridge_terminal_login');
                const enterA = (loc.actions || []).find(a => a.id === 'enter_known_credentials_bridge');

                if (hackA) delete hackA._completed;
                if (useA)  delete useA._completed;
                if (enterA) delete enterA._completed;

                if (loginKnown) {
                    if (hackA) hackA._completed = true;
                    if (useA)  useA._completed = true;
                    if (enterA) ctx.flagActionAsNew('enter_known_credentials_bridge');
                } else if (noteFound) {
                    if (enterA) enterA._completed = true;
                    ctx.flagActionAsNew('use_bridge_terminal_login');
                } else {
                    if (useA)  useA._completed = true;
                    if (enterA) enterA._completed = true;
                }
                if (hackA && !hackA._completed) ctx.flagActionAsNew('hack_bridge_terminal');

                ctx.setFullRebuildNeeded(true);
            }
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
            getResultKey(ctx) {
                return null;
            },
            onComplete(ctx) {
                setMilestone('fuel_scanned', () => ctx.persistLoopKnowledge());
                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
                const currentFuel = fuel ? Math.round(fuel.amount) : 0;
                const FUEL_DRAIN_PER_MIN = ctx.gameFlags.reactorOptimized ? 1.20 : 1.80;
                const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);
                let resultKey = 'result_check_reactor_status';
                ctx.addLogEntry(ctx.t(resultKey, { fuel: currentFuel, minutes: projectedMins }), ctx.LogType.SUCCESS);
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const optAction = (loc.actions || []).find(a => a.id === 'optimize_reactor');
                    if (optAction) ctx.flagActionAsNew('optimize_reactor');
                }
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
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['check_bridge_terminal'];
            },
            onComplete(ctx) {
                setMilestone('bridge_terminal_hacked', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const unlockState = ctx.getUnlockState(loc.id);
                    unlockState['hack_bridge_terminal'] = true;
                    ctx.setUnlockState(loc.id, unlockState);
                    const useA = (loc.actions || []).find(a => a.id === 'use_bridge_terminal_login');
                    if (useA) useA._completed = true;
                    const enterA = (loc.actions || []).find(a => a.id === 'enter_known_credentials_bridge');
                    if (enterA) enterA._completed = true;
                    ctx.setFullRebuildNeeded(true);
                }
                try {
                    const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                    if (crewLoc) {
                        const hackA = (crewLoc.actions || []).find(a => a.id === 'hack_terminal');
                        if (hackA) hackA._completed = true;
                        const useA = (crewLoc.actions || []).find(a => a.id === 'use_terminal_login');
                        if (useA) useA._completed = true;
                        const enterA = (crewLoc.actions || []).find(a => a.id === 'enter_known_credentials');
                        if (enterA && enterA._completed) { enterA._completed = false; ctx.flagActionAsNew('enter_known_credentials'); }
                    }
                } catch { /* ignore */ }
                try {
                    const wsLoc = ctx.getLocation('scout_ship_workshop');
                    if (wsLoc && Array.isArray(wsLoc.actions)) {
                        const noteAction = wsLoc.actions.find(a => a.id === 'search_for_login_note');
                        if (noteAction) noteAction._completed = true;
                    }
                } catch { /* ignore */ }
            }
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
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['check_bridge_terminal'];
            },
            onComplete(ctx) {
                setMilestone('bridge_terminal_note_used', () => ctx.persistLoopKnowledge());
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const unlockState = ctx.getUnlockState(loc.id);
                    unlockState['use_bridge_terminal_login'] = true;
                    ctx.setUnlockState(loc.id, unlockState);
                    const hackA = (loc.actions || []).find(a => a.id === 'hack_bridge_terminal');
                    if (hackA) hackA._completed = true;
                    const enterA = (loc.actions || []).find(a => a.id === 'enter_known_credentials_bridge');
                    if (enterA) enterA._completed = true;
                    ctx.setFullRebuildNeeded(true);
                }
                try {
                    const crewLoc = ctx.getLocation('scout_ship_crew_quarters');
                    if (crewLoc) {
                        const hackA = (crewLoc.actions || []).find(a => a.id === 'hack_terminal');
                        if (hackA) hackA._completed = true;
                        const useA = (crewLoc.actions || []).find(a => a.id === 'use_terminal_login');
                        if (useA) useA._completed = true;
                        const enterA = (crewLoc.actions || []).find(a => a.id === 'enter_known_credentials');
                        if (enterA && enterA._completed) { enterA._completed = false; ctx.flagActionAsNew('enter_known_credentials'); }
                    }
                } catch { /* ignore */ }
                try {
                    const wsLoc = ctx.getLocation('scout_ship_workshop');
                    if (wsLoc && Array.isArray(wsLoc.actions)) {
                        const noteAction = wsLoc.actions.find(a => a.id === 'search_for_login_note');
                        if (noteAction) noteAction._completed = true;
                    }
                } catch { /* ignore */ }
            }
        },
        {
            id: 'enter_known_credentials_bridge',
            nameKey: 'action_enter_known_credentials_bridge',
            descKey: 'action_enter_known_credentials_bridge_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            isAvailable(ctx) {
                const us = ctx.getUnlockState(ctx.getCurrentLocationId());
                return !!us['check_bridge_terminal'];
            },
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2) return 'result_enter_known_credentials_bridge_loop2';
                return 'result_enter_known_credentials_bridge';
            },
            onComplete(ctx) {
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const unlockState = ctx.getUnlockState(loc.id);
                    unlockState['enter_known_credentials_bridge'] = true;
                    ctx.setUnlockState(loc.id, unlockState);
                    const hackA = (loc.actions || []).find(a => a.id === 'hack_bridge_terminal');
                    if (hackA) hackA._completed = true;
                    const useA = (loc.actions || []).find(a => a.id === 'use_bridge_terminal_login');
                    if (useA) useA._completed = true;
                    ctx.setFullRebuildNeeded(true);
                }
            }
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