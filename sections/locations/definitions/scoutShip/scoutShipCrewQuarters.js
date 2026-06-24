// ==========================================================================
// Location: Scout Ship — Crew Quarters (starting location)
// ==========================================================================

// Helper: persist loopKnowledge to gameState
function persistLoopKnowledge(ctx) {
    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
        state.gameFlags.loopKnowledge = { ...ctx.gameFlags.loopKnowledge };
        localStorage.setItem('gameState', JSON.stringify(state));
    } catch { /* ignore */ }
}

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
            actions: ['check_terminal', 'hack_terminal', 'use_terminal_login', 'access_logs', 'disable_alarm']
        },
        {
            id: 'bunks',
            nameKey: 'poi_bunks',
            actions: ['wake_up', 'search_bunks', 'rest', 'read_book']
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
            unlocksAll: true,
            addsEffect: 'alarm',
            getResultKey(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop >= 2) return null; // handled in onComplete
                if (loop >= 1) return 'result_wake_up_loop1';
                return 'result_wake_up';
            },
            // On complete: loop 2+ reveals fuel/O2 and sets loop knowledge
            onComplete(ctx) {
                const loop = ctx.gameFlags.loopCount || 0;
                if (loop < 2) return;
                if (!ctx.gameFlags.loopKnowledge) ctx.gameFlags.loopKnowledge = {};
                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
                const currentFuel = fuel ? Math.round(fuel.amount) : 0;
                const FUEL_DRAIN_PER_MIN = 1.8;
                const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);
                if (!ctx.gameFlags.loopKnowledge.fuelScanned || ctx.gameFlags.loopKnowledge.fuelScanned < 1) {
                    ctx.gameFlags.loopKnowledge.fuelScanned = 1;
                }
                const resultKey = loop >= 3 ? 'result_wake_up_loop3' : 'result_wake_up_loop2';
                ctx.addLogEntry(ctx.t(resultKey, { fuel: currentFuel, minutes: projectedMins }), ctx.LogType.SUCCESS);
                ctx.initAreaResources('scout_ship_bridge');
                ctx.revealAreaResources('scout_ship_bridge');
                if (typeof window !== 'undefined') {
                    window._currentAreaResourceList = ctx.areaResources['scout_ship_bridge'] || [];
                }
                ctx.showAreaSuppliesPanel();
                if (loop >= 3) {
                    const bridgeLoc = ctx.getLocation('scout_ship_bridge');
                    if (bridgeLoc) {
                        const bridgeUs = ctx.getUnlockState('scout_ship_bridge');
                        bridgeUs['check_reactor_status'] = true;
                        ctx.setUnlockState('scout_ship_bridge', bridgeUs);
                        const crsAction = (bridgeLoc.actions || []).find(a => a.id === 'check_reactor_status');
                        if (crsAction) crsAction._completed = true;
                    }
                }
                persistLoopKnowledge(ctx);
                ctx.setFullRebuildNeeded(true);
            }
        },
        {
            id: 'check_terminal',
            nameKey: 'action_check_terminal',
            descKey: 'action_check_terminal_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            unlockedBy: 'wake_up',
            getResultKey(ctx) {
                if (ctx.gameFlags.loopKnowledge && ctx.gameFlags.loopKnowledge.terminalLogin) {
                    const loop = ctx.gameFlags.loopCount || 0;
                    if (loop >= 2) return 'result_check_terminal_loop2';
                    if (loop >= 1) return 'result_check_terminal_loop1';
                    return 'result_check_terminal_known';
                }
                return 'result_check_terminal';
            },
            onComplete(ctx) {
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (!loc) return;
                const unlockState = ctx.getUnlockState(loc.id);
                unlockState['check_terminal'] = true;
                if (ctx.gameFlags.loopKnowledge && ctx.gameFlags.loopKnowledge.terminalLogin) {
                    unlockState['check_terminal_known'] = true;
                    unlockState['hack_terminal'] = true;
                    unlockState['use_terminal_login'] = true;
                }
                ctx.setUnlockState(loc.id, unlockState);
                (loc.actions || []).forEach(a => {
                    if (a.id === 'check_terminal') return;
                    if (!a.unlockedBy) return;
                    let shouldFlag = false;
                    if (ctx.gameFlags.loopKnowledge && ctx.gameFlags.loopKnowledge.terminalLogin) {
                        if (a.id === 'access_logs' || a.id === 'disable_alarm') shouldFlag = true;
                    } else {
                        if (a.unlockedBy === 'check_terminal') shouldFlag = true;
                    }
                    if (shouldFlag) ctx.flagActionAsNew(a.id);
                });
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
            unlockedBy: 'check_terminal',
            onComplete(ctx) {
                if (!ctx.gameFlags.loopKnowledge) ctx.gameFlags.loopKnowledge = {};
                ctx.gameFlags.loopKnowledge.terminalLogin = true;
                persistLoopKnowledge(ctx);
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const unlockState = ctx.getUnlockState(loc.id);
                    unlockState['hack_terminal'] = true;
                    ctx.setUnlockState(loc.id, unlockState);
                    (loc.actions || []).forEach(a => {
                        if (a.id !== 'hack_terminal' && a.unlockedBy && Array.isArray(a.unlockedBy) && a.unlockedBy.includes('hack_terminal')) {
                            ctx.flagActionAsNew(a.id);
                        }
                    });
                    const opposing = (loc.actions || []).find(a => a.id === 'use_terminal_login');
                    if (opposing) {
                        opposing._completed = true;
                        unlockState['use_terminal_login'] = true;
                        ctx.setUnlockState(loc.id, unlockState);
                    }
                    ctx.setFullRebuildNeeded(true);
                }
                try {
                    const wsLoc = ctx.getLocation('scout_ship_workshop');
                    if (wsLoc && Array.isArray(wsLoc.actions)) {
                        const noteAction = wsLoc.actions.find(a => a.id === 'search_for_login_note');
                        if (noteAction) {
                            noteAction._completed = true;
                            const wsUs = ctx.getUnlockState('scout_ship_workshop');
                            wsUs['search_for_login_note'] = true;
                            ctx.setUnlockState('scout_ship_workshop', wsUs);
                        }
                    }
                } catch { /* ignore */ }
            }
        },
        {
            id: 'use_terminal_login',
            nameKey: 'action_use_terminal_login',
            descKey: 'action_use_terminal_login_desc',
            drain: [{ resource: 'Stamina', amount: 1 }],
            durationSeconds: 3,
            oneTime: true,
            resultKey: 'result_use_terminal_login',
            unlockedBy: 'check_terminal',
            requiresItem: 'terminal_login_note',
            onComplete(ctx) {
                if (!ctx.gameFlags.loopKnowledge) ctx.gameFlags.loopKnowledge = {};
                ctx.gameFlags.loopKnowledge.terminalLogin = true;
                persistLoopKnowledge(ctx);
                const loc = ctx.getLocation(ctx.getCurrentLocationId());
                if (loc) {
                    const unlockState = ctx.getUnlockState(loc.id);
                    unlockState['use_terminal_login'] = true;
                    ctx.setUnlockState(loc.id, unlockState);
                    (loc.actions || []).forEach(a => {
                        if (a.id !== 'use_terminal_login' && a.unlockedBy && Array.isArray(a.unlockedBy) && a.unlockedBy.includes('use_terminal_login')) {
                            ctx.flagActionAsNew(a.id);
                        }
                    });
                    const opposing = (loc.actions || []).find(a => a.id === 'hack_terminal');
                    if (opposing) {
                        opposing._completed = true;
                        unlockState['hack_terminal'] = true;
                        ctx.setUnlockState(loc.id, unlockState);
                    }
                    ctx.setFullRebuildNeeded(true);
                }
                try {
                    const wsLoc = ctx.getLocation('scout_ship_workshop');
                    if (wsLoc && Array.isArray(wsLoc.actions)) {
                        const noteAction = wsLoc.actions.find(a => a.id === 'search_for_login_note');
                        if (noteAction) {
                            noteAction._completed = true;
                            const wsUs = ctx.getUnlockState('scout_ship_workshop');
                            wsUs['search_for_login_note'] = true;
                            ctx.setUnlockState('scout_ship_workshop', wsUs);
                        }
                    }
                } catch { /* ignore */ }
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
            unlockedBy: ['hack_terminal', 'use_terminal_login']
        },
        {
            id: 'search_bunks',
            nameKey: 'action_search_bunks',
            descKey: 'action_search_bunks_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 20,
            oneTime: true,
            resultKey: 'result_search_bunks',
            unlockedBy: 'wake_up',
            unlocksAll: true
        },
        {
            id: 'rest',
            nameKey: 'action_rest',
            descKey: 'action_rest_desc',
            category: 'rest',
            drain: [],
            rewards: [
                { type: 'resource', name: 'Stamina', amount: 5 },
                { type: 'resource', name: 'Health', amount: 1 }
            ],
            durationSeconds: 15,
            repeatable: true,
            cancellable: true,
            unlockedBy: 'wake_up'
        },
        {
            id: 'disable_alarm',
            nameKey: 'action_disable_alarm',
            descKey: 'action_disable_alarm_desc',
            drain: [{ resource: 'Stamina', amount: 4 }],
            durationSeconds: 12,
            oneTime: true,
            resultKey: 'result_disable_alarm',
            removesEffect: 'alarm',
            unlockedBy: ['hack_terminal', 'use_terminal_login']
        },
        {
            id: 'check_storage',
            nameKey: 'action_check_storage',
            descKey: 'action_check_storage_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 12,
            oneTime: true,
            resultKey: 'result_check_storage',
            rewards: [{ type: 'item', name: 'Bottled Water', amount: 1 }],
            unlockedBy: 'wake_up'
        },
        {
            id: 'read_book',
            nameKey: 'action_read_book',
            descKey: 'action_read_book_desc',
            category: 'persistent',
            drain: [],
            durationSeconds: 90,
            oneTime: true,
            resultKey: 'result_read_book',
            unlockedBy: 'search_bunks',
            onComplete(ctx) {
                if (!ctx.gameFlags.loopKnowledge) ctx.gameFlags.loopKnowledge = {};
                ctx.gameFlags.loopKnowledge.bookRead = true;
                persistLoopKnowledge(ctx);
            }
        },
        {
            id: 'debug_taxing',
            nameKey: 'action_debug_taxing',
            descKey: 'action_debug_taxing_desc',
            category: 'taxing',
            drain: [],
            durationSeconds: 10,
            repeatable: true,
            resultKey: 'result_debug_taxing'
        },
        {
            id: 'go_to_main_area',
            nameKey: 'action_go_to_main_area',
            descKey: 'action_go_to_main_area_desc',
            drain: [],
            durationSeconds: 3,
            repeatable: true,
            targetLocation: 'scout_ship_main_area',
            unlockedBy: 'wake_up'
        }
    ]
};