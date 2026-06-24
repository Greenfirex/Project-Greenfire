// ==========================================================================
// Location: Scout Ship — Bridge / Cockpit
// ==========================================================================

function persistLoopKnowledge(ctx) {
    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
        state.gameFlags.loopKnowledge = { ...ctx.gameFlags.loopKnowledge };
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
            actions: ['check_navigation', 'check_reactor_status']
        },
        {
            id: 'controls',
            nameKey: 'poi_controls',
            actions: ['check_status']
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
            id: 'check_reactor_status',
            nameKey: 'action_check_reactor_status',
            descKey: 'action_check_reactor_status_desc',
            drain: [{ resource: 'Stamina', amount: 3 }],
            durationSeconds: 15,
            oneTime: true,
            revealsAreaSupplies: true,
            // resultKey is dynamic — set via getResultKey
            getResultKey(ctx) {
                return null; // always null — computed in onComplete
            },
            onComplete(ctx) {
                if (!ctx.gameFlags.loopKnowledge) ctx.gameFlags.loopKnowledge = {};
                const scannedBefore = ctx.gameFlags.loopKnowledge.fuelScanned || 0;
                ctx.gameFlags.loopKnowledge.fuelScanned = scannedBefore + 1;

                const bridgeList = ctx.areaResources['scout_ship_bridge'];
                const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
                const currentFuel = fuel ? Math.round(fuel.amount) : 0;
                const FUEL_DRAIN_PER_MIN = 1.8;
                const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);

                if (scannedBefore === 0 && currentFuel > 0) {
                    ctx.gameFlags.loopKnowledge.fuelDepletionMinute = (ctx.gameFlags.loopCount || 0) * 10000 + projectedMins;
                }

                let resultKey;
                if (scannedBefore === 0) {
                    resultKey = 'result_check_reactor_status';
                } else if (scannedBefore === 1) {
                    resultKey = 'result_check_reactor_status_loop2';
                } else {
                    resultKey = 'result_check_reactor_status_known';
                }
                ctx.addLogEntry(ctx.t(resultKey, { fuel: currentFuel, minutes: projectedMins }), ctx.LogType.SUCCESS);

                persistLoopKnowledge(ctx);
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
            targetLocation: 'scout_ship_main_area'
        }
    ]
};