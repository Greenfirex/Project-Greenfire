// Centralized block/unlock policy for actions/buildings/sections.
// Keep this module pure: accept state from callers instead of importing gameplay modules.

/**
 * Determine if an action is blocked and provide a reason string.
 * @param {string} actionId
 * @param {{ actions: Array<{id:string,name?:string,completed?:boolean,stage?:number,stages?:any[],isUnlocked?:boolean}>, flags?: any, gameFlags?: any, characterState?: any, character?: any }} state
 * @returns {{ blocked: boolean, reason: string }}
 */
export function getBlockedStatus(actionId, state) {
    // Local map gate: Go back inside requires being at the ship entrance tile.
    if (actionId === 'attemptReentry') {
        const ch = (state && (state.characterState || state.character)) || null;
        const lm = ch && ch.localMap ? ch.localMap : null;
        const x = lm && Number.isFinite(lm.x) ? lm.x : null;
        const y = lm && Number.isFinite(lm.y) ? lm.y : null;
        // Entrance tile is F7 (col 6, row 7). Allow starting when standing on it or adjacent.
        const ok = (typeof x === 'number' && typeof y === 'number')
            && (Math.abs(x - 6) + Math.abs(y - 7) <= 1);
        if (!ok) {
            return { blocked: true, reason: 'You must be next to F7 (ship entrance) to go back inside.' };
        }
    }

    // Crafting uniques: avoid producing duplicates.
    if (actionId === 'craftMetalSpear') {
        const ch = (state && (state.characterState || state.character)) || null;
        const equippedWeapon = ch && ch.equipment ? ch.equipment.weapon : null;
        const bag = (ch && Array.isArray(ch.bag)) ? ch.bag : [];
        const hasMetalSpear = equippedWeapon === 'metal_spear' || bag.some(v => v === 'metal_spear');
        if (hasMetalSpear) return { blocked: true, reason: 'You already have a Metal Spear.' };
    }

    if (actionId === 'createBasicTorch') {
        const ch = (state && (state.characterState || state.character)) || null;
        const eq = ch && ch.equipment ? ch.equipment : null;
        const bag = (ch && Array.isArray(ch.bag)) ? ch.bag : [];
        const hasTorch = (eq && (eq.accessory_1 === 'basic_torch' || eq.accessory_2 === 'basic_torch')) || bag.some(v => v === 'basic_torch');
        if (hasTorch) return { blocked: true, reason: 'You already have a Basic Torch.' };
    }

    // Local map gate: burning the thorny wall requires standing at C6 and selecting C5.
    if (actionId === 'burnThornyWall') {
        const ch = (state && (state.characterState || state.character)) || null;
        const lm = ch && ch.localMap ? ch.localMap : null;
        const eq = ch && ch.equipment ? ch.equipment : null;
        const x = lm && Number.isFinite(lm.x) ? lm.x : null;
        const y = lm && Number.isFinite(lm.y) ? lm.y : null;
        const sx = lm && Number.isFinite(lm.selectedX) ? lm.selectedX : null;
        const sy = lm && Number.isFinite(lm.selectedY) ? lm.selectedY : null;

        const onC6 = (x === 3 && y === 6);
        const selectingC5 = (sx === 3 && sy === 5);
        if (!onC6 || !selectingC5) {
            return { blocked: true, reason: 'You must be standing at C6 and select C5 to burn the thorny wall.' };
        }

        if (lm && lm.c5ThornWallBurned === true) {
            return { blocked: true, reason: 'The thorny wall has already been cleared.' };
        }

        const torchEquipped = !!(eq && (eq.accessory_1 === 'basic_torch' || eq.accessory_2 === 'basic_torch'));
        if (!torchEquipped) {
            return { blocked: true, reason: 'Equip a Basic Torch in an accessory slot to burn the thorns.' };
        }
    }

    // Ship interior room gates: allow starting the search while adjacent and selecting the room tile
    // (the UI queues a post-completion move onto the tile).
    if (actionId === 'searchLabs' || actionId === 'searchPowerCore') {
        const ch = (state && (state.characterState || state.character)) || null;
        const lm = ch && ch.localMap ? ch.localMap : null;
        const x = lm && Number.isFinite(lm.x) ? lm.x : null;
        const y = lm && Number.isFinite(lm.y) ? lm.y : null;
        const sx = lm && Number.isFinite(lm.selectedX) ? lm.selectedX : null;
        const sy = lm && Number.isFinite(lm.selectedY) ? lm.selectedY : null;
        const required = (actionId === 'searchLabs')
            ? { x: 7, y: 3, label: 'G3 (Laboratory)' }
            : { x: 7, y: 4, label: 'G4 (Power Core)' };

        const selectingTarget = (sx === required.x && sy === required.y);
        const standingOnTarget = (x === required.x && y === required.y);
        const adjacentToTarget = (typeof x === 'number' && typeof y === 'number')
            ? ((Math.abs(x - required.x) + Math.abs(y - required.y)) === 1)
            : false;

        const ok = selectingTarget && (standingOnTarget || adjacentToTarget);
        if (!ok) {
            return { blocked: true, reason: `Move next to ${required.label} and select it to do that.` };
        }
    }

    const BLOCKED_ACTION_IDS = ['searchSouthCorridor', 'searchNorthCorridor', 'investigateBridge', 'searchPowerCore'];
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

    // Power Core stage 2 gate: must explore cafeteria and crew quarters first (survivor safety)
    if (actionId === 'searchPowerCore' && totalStages > 1 && currentStage >= 1) {
        const cafeteria = find('exploreCafeteria');
        const crewQuarters = find('checkCrewQuarters');
        const hasCafeteria = !!(cafeteria && cafeteria.completed);
        const hasCrewQuarters = !!(crewQuarters && crewQuarters.completed);
        
        if (!hasCafeteria || !hasCrewQuarters) {
            return { blocked: true, reason: 'Blasting the power core risks structural damage and survivor casualties. Search the cafeteria and crew quarters first to ensure all survivors are accounted for.' };
        }
    }

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
 * @param {{ resources: Array<{name:string,isDiscovered?:boolean}>, actions: Array<{id:string,isUnlocked?:boolean,name?:string,category?:string}>, buildings?: Array<{name:string,count?:number,isUnlocked?:boolean}> }} state
 * @returns {{ actions: string[], buildings: string[], sections: string[], jobs: string[] }}
 */
export function evaluateEventUnlocks(event, state) {
    const result = { actions: [], buildings: [], sections: [], jobs: [] };
    if (!event || !state) return result;

    // Rule: unlock Assemble Makeshift Explosive only after the player learns it's needed
    // (Power Core access is locked without explosives) AND all required input resources are discovered.
    if (event.type === 'resourceDiscovered') {
    const res = (state.resources || []);
    const hasChem = !!res.find(r => r && r.name === 'Chemicals' && (r.isDiscovered || (r.amount || 0) > 0));
    const hasMetal = !!res.find(r => r && r.name === 'Metal Parts' && (r.isDiscovered || (r.amount || 0) > 0));
    const hasWire = !!res.find(r => r && r.name === 'Wire' && (r.isDiscovered || (r.amount || 0) > 0));
        const buildings = Array.isArray(state.buildings) ? state.buildings : [];
        const waterStation = buildings.find(b => b && b.name === 'Water Station');

        // Power Core "need" signal: if the player has advanced the Power Core action past stage 0,
        // they have discovered the locked access and know explosives will be required.
        const actions = (state.actions || []);
        const powerCore = actions.find(a => a && a.id === 'searchPowerCore');
        const powerCoreStage = powerCore && Number.isFinite(powerCore.stage) ? powerCore.stage : 0;
        const knowsExplosivesAreNeeded = powerCoreStage >= 1;

        if (knowsExplosivesAreNeeded && hasChem && hasMetal && hasWire) {
            const assemble = actions.find(a => a && a.id === 'assembleMakeshiftExplosive');
            // Don't re-unlock if already used 3 times
            const hasReachedLimit = assemble && typeof assemble.uses === 'number' && typeof assemble.maxUses === 'number' && assemble.uses >= assemble.maxUses;
            if (assemble && !assemble.isUnlocked && !assemble.completed && !hasReachedLimit) {
                result.actions.push('assembleMakeshiftExplosive');
            }
        }
        
        // Rule: when BOTH Chemicals and Fabric are discovered, unlock Install Purification Unit upgrade
        const hasFabric = !!res.find(r => r && r.name === 'Fabric' && (r.isDiscovered || (r.amount || 0) > 0));
        if (hasChem && hasFabric) {
            const actions = (state.actions || []);
            const purificationUnit = actions.find(a => a && a.id === 'installPurificationUnit');
            if (purificationUnit && !purificationUnit.isUnlocked && !purificationUnit.completed) {
                result.actions.push('installPurificationUnit');
            }
        }

        // New rule: if Water Station is built (count >= 1) AND Fabric is discovered, unlock Rain Catchers upgrade
        if (hasFabric && waterStation && (waterStation.count || 0) >= 1) {
            const actions = (state.actions || []);
            const rain = actions.find(a => a && a.id === 'installRainCatchers');
            if (rain && !rain.isUnlocked && !rain.completed) {
                result.actions.push('installRainCatchers');
            }
        }

        // New rules: When Fabric is discovered, unlock planning upgrades
        if (hasFabric) {
            const actions = (state.actions || []);
            const planLarder = actions.find(a => a && a.id === 'planFoodLarder');
            if (planLarder && !planLarder.isUnlocked && !planLarder.completed) result.actions.push('planFoodLarder');
            const planReservoir = actions.find(a => a && a.id === 'planWaterReservoir');
            if (planReservoir && !planReservoir.isUnlocked && !planReservoir.completed) result.actions.push('planWaterReservoir');
        }
    }

    return result;
}
