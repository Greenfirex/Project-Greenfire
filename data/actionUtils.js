// Pure helpers for actions and stages.
// - These functions are intentionally stateless and contain no DOM access.
// - Callers should pass the current resources array where needed.

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
    const idx = action && Number.isFinite(action.stage) ? action.stage : 0;
    return (action && Array.isArray(action.stages)) ? action.stages[idx] : undefined;
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
    }
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
    if (st && Array.isArray(st.cost)) {
        st.cost.forEach(c => { req[c.resource] = (req[c.resource] || 0) + c.amount; });
    }
    return req;
}

/**
 * Check if the provided resources can cover the action's immediate requirements.
 * Uses computeRequiredResources; callers should pass the current resources array.
 * @param {object} action
 * @param {Array<{name:string, amount:number}>} resources
 * @returns {boolean}
 */
export function canAffordAction(action, resources) {
    if (!action) return false;
    const required = computeRequiredResources(action);
    for (const resourceName in required) {
        const res = (resources || []).find(r => r.name === resourceName);
        if (!res || res.amount < required[resourceName]) return false;
    }
    return true;
}

/**
 * Return human-readable shortfall messages for each missing/insufficient resource.
 * Example output: ["Clean Water: need 3 more", "Fabric missing (need 2)"]
 * @param {object} action
 * @param {Array<{name:string, amount:number}>} resources
 * @returns {string[]}
 */
export function getAffordabilityShortfalls(action, resources) {
    const out = [];
    if (!action) return out;
    const required = computeRequiredResources(action);
    for (const resourceName in required) {
        const res = (resources || []).find(r => r.name === resourceName);
        const have = res ? res.amount : 0;
        const need = required[resourceName];
        if (!res) out.push(`${resourceName} missing (need ${need})`);
        else if (have < need) out.push(`${resourceName}: need ${Math.ceil(need - have)} more`);
    }
    return out;
}

/**
 * Compute effective action duration factoring in survival debuffs.
 * - If Food Rations are 0 or less: +50% duration
 * - If Clean Water is 0 or less: +50% duration
 * Minimum returned duration is 0.001s to avoid divide-by-zero.
 * @param {object} action
 * @param {Array<{name:string, amount:number}>} resources
 * @returns {number} seconds
 */
export function computeEffectiveDuration(action, resources) {
    const food = (resources || []).find(r => r.name === 'Food Rations');
    const water = (resources || []).find(r => r.name === 'Clean Water');
    let debuff = 1;
    if (food && food.amount <= 0) debuff *= 1.5;
    if (water && water.amount <= 0) debuff *= 1.5;
    return Math.max(0.001, (action?.duration || 1) * debuff);
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
