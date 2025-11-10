// Centralized block/unlock policy for actions/buildings/sections.
// Keep this module pure: accept state from callers instead of importing gameplay modules.

/**
 * Determine if an action is blocked and provide a reason string.
 * @param {string} actionId
 * @param {{ actions: Array<{id:string,name?:string,completed?:boolean,stage?:number,stages?:any[],isUnlocked?:boolean}> }} state
 * @returns {{ blocked: boolean, reason: string }}
 */
export function getBlockedStatus(actionId, state) {
    const BLOCKED_ACTION_IDS = ['searchSouthCorridor', 'searchNorthCorridor', 'investigateBridge'];
    if (!BLOCKED_ACTION_IDS.includes(actionId)) return { blocked: false, reason: '' };

    const actions = (state && state.actions) || [];
    const flags = (state && (state.flags || state.gameFlags)) || {};
    const find = (id) => actions.find(a => a && (a.id === id || a.name === id));

    const target = find(actionId);
    const currentStage = target && Number.isFinite(target.stage) ? target.stage : 0;
    const totalStages = (target && Array.isArray(target.stages)) ? target.stages.length : 0;

    // Global early gates for deeper exploration
    const investigate = find('investigateSound');
    const basecamp = find('establishBaseCamp');
    const isInvestigateDone = !!(investigate && investigate.completed);
    const isBasecampDone = !!(basecamp && basecamp.completed);

    if (!isInvestigateDone) return { blocked: true, reason: 'Investigate Nearby Sound first — someone might be alive nearby.' };
    if (!isBasecampDone) return { blocked: true, reason: 'You found survivors — secure a base camp first before exploring deeper.' };
    if (!flags.hasCompleted_tasksSurvivors) return { blocked: true, reason: 'Complete Objective: "Tasks for survivors" before exploring deeper areas of the ship.' };

    // Additional stage-specific gate: Investigate Bridge stage 2 requires emergency power restored
    if (actionId === 'investigateBridge' && totalStages > 1 && currentStage >= 1) {
        if (!flags.emergencyPowerRestored) {
            return { blocked: true, reason: 'Restore Emergency Power first to access the bridge lift.' };
        }
    }

    return { blocked: false, reason: '' };
}

/**
 * Evaluate event-driven unlocks (e.g., resource discoveries) and return what should unlock.
 * The caller applies these unlocks to live data and triggers UI updates.
 * @param {{ type: string }} event
 * @param {{ resources: Array<{name:string,isDiscovered?:boolean}>, actions: Array<{id:string,isUnlocked?:boolean}> }} state
 * @returns {{ actions: string[], buildings: string[], sections: string[], jobs: string[] }}
 */
export function evaluateEventUnlocks(event, state) {
    const result = { actions: [], buildings: [], sections: [], jobs: [] };
    if (!event || !state) return result;

    // Rule: when both Fabric and Chemicals are discovered, unlock Assemble Makeshift Explosive
    if (event.type === 'resourceDiscovered') {
        const res = (state.resources || []);
        const hasFabric = !!res.find(r => r && r.name === 'Fabric' && r.isDiscovered);
        const hasChem = !!res.find(r => r && r.name === 'Chemicals' && r.isDiscovered);
        if (hasFabric && hasChem) {
            const actions = (state.actions || []);
            const assemble = actions.find(a => a && a.id === 'assembleMakeshiftExplosive');
            if (assemble && !assemble.isUnlocked) {
                result.actions.push('assembleMakeshiftExplosive');
            }
        }
    }

    return result;
}
