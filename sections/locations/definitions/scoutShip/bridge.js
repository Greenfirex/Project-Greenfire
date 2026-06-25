// ==========================================================================
// Location: Scout Ship — Bridge / Cockpit
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
            actions: ['check_navigation']
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
            durationSeconds: 12,
            repeatable: true,
            resultKey: 'result_check_navigation'
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
                setMilestone('bridge_terminal_checked', () => persistLoopKnowledge(ctx));
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
            unlockedBy: ['hack_bridge_terminal', 'use_bridge_terminal_login', 'enter_known_credentials_bridge'],
            revealsAreaSupplies: true,
            getResultKey(ctx) {
                return null;
            },
            onComplete(ctx) {
                setMilestone('fuel_scanned', () => persistLoopKnowledge(ctx));
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
            unlockedBy: 'check_bridge_terminal',
            onComplete(ctx) {
                setMilestone('bridge_terminal_hacked', () => persistLoopKnowledge(ctx));
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
            unlockedBy: 'check_bridge_terminal',
            requiresItem: 'terminal_login_note',
            onComplete(ctx) {
                setMilestone('bridge_terminal_note_used', () => persistLoopKnowledge(ctx));
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
            resultKey: 'result_enter_known_credentials_bridge',
            unlockedBy: 'check_bridge_terminal',
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
            oneTime: true,
            unlockedBy: 'check_reactor_status',
            onStart(ctx) {
                const knowsLogin = hasLogin(ctx.gameFlags.loopKnowledge?.milestones || {});
                if (!knowsLogin) {
                    ctx.addLogEntry(ctx.t('log_need_terminal_login'), ctx.LogType.ERROR);
                    return { block: true };
                }
                if (ctx.gameFlags.reactorOptimized) return { block: true };
                if (hasMilestone('reactor_optimized')) {
                    ctx.action.durationSeconds = 10;
                }
            },
            getResultKey(ctx) {
                return hasMilestone('reactor_optimized') ? 'result_optimize_reactor_known' : 'result_optimize_reactor';
            },
            onComplete(ctx) {
                ctx.gameFlags.reactorOptimized = true;
                const alreadyKnew = hasMilestone('reactor_optimized');
                setMilestone('reactor_optimized', () => persistLoopKnowledge(ctx));
                if (alreadyKnew) {
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