// Pure helpers for actions and stages.
// - These functions are intentionally stateless and contain no DOM access.
// - Callers should pass the current resources array where needed.

import { getItemIdForResourceName, isInventoryAliasResourceName } from './inventoryAliases.js';

/**
 * Safely read a value from localStorage.
 * Returns null if storage is unavailable (e.g., privacy mode) or access throws.
 * @param {string} key
 * @returns {string|null}
 */
export function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

/**
 * Get the currently active stage object for a given action definition.
 * Falls back to stage index 0 when action.stage is not a finite number.
 * @param {object} action
 * @returns {object|undefined} current stage object or undefined if none
 */
export function getCurrentStage(action) {
    if (!action || !Array.isArray(action.stages) || action.stages.length === 0) return undefined;
    const raw = (action && Number.isFinite(action.stage)) ? action.stage : 0;
    const idx = Math.max(0, Math.min(action.stages.length - 1, Math.floor(Number(raw) || 0)));
    return action.stages[idx];
}

/**
 * Build a tooltip-friendly copy of an action that reflects current stage overrides.
 * Shallow-clones the action and overlays stage cost/drain/reward/duration/description.
 * @param {object} action
 * @returns {object} cloned action with stage-specific fields applied
 */
export function tooltipDataForAction(action) {
    if (!action) return {};
    const st = getCurrentStage(action);
    const out = Object.assign({}, action);
    if (st) {
        if (Array.isArray(st.cost)) out.cost = st.cost;
        if (Array.isArray(st.drain)) out.drain = st.drain;
        if (st.reward) out.reward = st.reward;
        if (typeof st.duration !== 'undefined') out.duration = st.duration;
        if (st.description) out.description = st.description;
        if (typeof st.encounterChance === 'number') out.encounterChance = st.encounterChance;
        if (typeof st.encounterFailLogText === 'string') out.encounterFailLogText = st.encounterFailLogText;
    }

    // Tooltip-only: if an action's combat encounter is not guaranteed, reflect the overall chance
    // on its rewards (similar to per-reward chance used by actions like Scavenge Debris Field).
    // This is display-only: callers that award rewards use the live action definition/runtime state.
    try {
        const hasEncounter = !!(out && out.encounter);
        const rawChance = (typeof out.encounterChance === 'number') ? out.encounterChance : 1;
        const p = rawChance > 1 ? (rawChance / 100) : rawChance;
        const chance = Math.max(0, Math.min(1, p));

        if (hasEncounter && chance > 0 && chance < 1 && Array.isArray(out.reward)) {
            out.reward = out.reward.map(r => {
                const rr = Object.assign({}, r);
                if (typeof rr.chance !== 'number') rr.chance = chance;
                return rr;
            });
        }
    } catch { /* ignore */ }
    return out;
}

/**
 * Compute a map of required resources for an action starting now.
 * Includes action.cost, action.drain totals, and current stage.cost if present.
 * Does not include future per-second drain over time; callers should handle that context.
 * @param {object} action
 * @returns {Record<string, number>} resourceName -> required amount
 */
export function computeRequiredResources(action) {
    const req = {};
    if (!action) return req;
    (action.cost || []).forEach(c => { req[c.resource] = (req[c.resource] || 0) + c.amount; });
    (action.drain || []).forEach(d => { req[d.resource] = (req[d.resource] || 0) + d.amount; });
    const st = getCurrentStage(action);
    if (st) {
        if (Array.isArray(st.cost)) {
            st.cost.forEach(c => { req[c.resource] = (req[c.resource] || 0) + c.amount; });
        }
        if (Array.isArray(st.drain)) {
            st.drain.forEach(d => { req[d.resource] = (req[d.resource] || 0) + d.amount; });
        }
    }
    return req;
}

function getItemCountFromCharacterState(itemId, characterState) {
    if (!itemId || !characterState) return 0;
    let count = 0;
    try {
        const bag = Array.isArray(characterState.bag) ? characterState.bag : [];
        for (const entry of bag) {
            if (!entry) continue;
            if (typeof entry === 'string') {
                if (entry === itemId) count += 1;
            } else if (typeof entry === 'object' && typeof entry.id === 'string') {
                if (entry.id !== itemId) continue;
                const q = Math.floor(Number(entry.qty ?? 1));
                count += (Number.isFinite(q) ? Math.max(1, q) : 1);
            }
        }
    } catch { /* ignore */ }

    try {
        const eq = characterState.equipment && typeof characterState.equipment === 'object' ? characterState.equipment : null;
        if (eq) {
            for (const v of Object.values(eq)) {
                if (typeof v === 'string' && v === itemId) count += 1;
            }
        }
    } catch { /* ignore */ }

    return count;
}

/**
 * Check if the provided resources can cover the action's immediate requirements.
 * Uses computeRequiredResources; callers should pass the current resources array.
 * @param {object} action
 * @param {Array<{name:string, amount:number}>} resources
 * @returns {boolean}
 */
export function canAffordAction(action, resources, characterState = null) {
    if (!action) return false;
    const required = computeRequiredResources(action);
    for (const resourceName in required) {
        const need = required[resourceName];

        // Inventory-backed "resource" aliases (e.g., Power Cells)
        if (isInventoryAliasResourceName(resourceName)) {
            const itemId = getItemIdForResourceName(resourceName);
            const have = getItemCountFromCharacterState(itemId, characterState);
            if (have < need) return false;
            continue;
        }

        const res = (resources || []).find(r => r.name === resourceName);
        if (!res || res.amount < need) return false;
    }
    return true;
}

/**
 * Return human-readable shortfall messages for each missing/insufficient resource.
 * Example output: ["Drinking Water: need 3 more", "Fabric missing (need 2)"]
 * @param {object} action
 * @param {Array<{name:string, amount:number}>} resources
 * @returns {string[]}
 */
export function getAffordabilityShortfalls(action, resources, characterState = null) {
    const out = [];
    if (!action) return out;
    const required = computeRequiredResources(action);
    for (const resourceName in required) {
        const need = required[resourceName];

        if (isInventoryAliasResourceName(resourceName)) {
            const itemId = getItemIdForResourceName(resourceName);
            const have = getItemCountFromCharacterState(itemId, characterState);
            if (have < need) out.push(`${resourceName}: need ${Math.ceil(need - have)} more`);
            continue;
        }

        const res = (resources || []).find(r => r.name === resourceName);
        const have = res ? res.amount : 0;
        if (!res) out.push(`${resourceName} missing (need ${need})`);
        else if (have < need) out.push(`${resourceName}: need ${Math.ceil(need - have)} more`);
    }
    return out;
}

/**
 * Compute effective action duration factoring in survival debuffs.
 * - If Food Rations are 0 or less: +50% duration
 * - If Drinking Water is 0 or less: +50% duration
 * Minimum returned duration is 0.001s to avoid divide-by-zero.
 * @param {object} action
 * @param {Array<{name:string, amount:number}>} resources
 * @returns {number} seconds
 */
export function computeEffectiveDuration(action, resources) {
    const food = (resources || []).find(r => r.name === 'Food Rations');
    const water = (resources || []).find(r => r.name === 'Drinking Water');
    const isHungry = !!(food && Number(food.amount) <= 0);
    const isThirsty = !!(water && Number(water.amount) <= 0);
    // Intuitive rule:
    // - Hunger: +50% duration
    // - Thirst: +50% duration
    // - Both: +100% duration (2×), not 2.25×
    const multiplier = 1 + (isHungry ? 0.5 : 0) + (isThirsty ? 0.5 : 0);
    return Math.max(0.001, (action?.duration || 1) * multiplier);
}

/**
 * Random integer helper, inclusive of both ends.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function getRandomInt(min, max) {
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
