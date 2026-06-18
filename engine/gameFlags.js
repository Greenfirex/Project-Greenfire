// Game flags for the timeloop reset game.
// Lightweight replacement; the legacy file was moved to backup/data/.

const initialGameFlags = {
    firstObjectiveComplete: false,
    loopCount: 0,
    // Persistent action progress that survives death loops.
    // Keys are action IDs, values are seconds of progress accumulated.
    persistentProgress: {},
    // Track which loop-stage story popups have been shown (by stage number key).
    loopStoryShown: {},
    // UI-only persistence: which action/upgrade IDs the player has already seen.
    // Keys are strings like "action:go_to_main_area", "action:check_storage", etc.
    uiSeen: {}
};

export function getInitialGameFlags() {
    return JSON.parse(JSON.stringify(initialGameFlags));
}

export const gameFlags = getInitialGameFlags();

export function resetGameFlags() {
    Object.keys(gameFlags).forEach(k => delete gameFlags[k]);
    Object.assign(gameFlags, getInitialGameFlags());
}

export function applySavedGameFlags(savedFlags = {}) {
    Object.keys(gameFlags).forEach(k => delete gameFlags[k]);
    Object.assign(gameFlags, getInitialGameFlags());
    Object.keys(savedFlags).forEach(k => {
        if (Object.prototype.hasOwnProperty.call(savedFlags, k)) {
            gameFlags[k] = savedFlags[k];
        }
    });
    // Ensure uiSeen is always an object
    if (!gameFlags.uiSeen || typeof gameFlags.uiSeen !== 'object') {
        gameFlags.uiSeen = {};
    }
}

/**
 * Check if an action should show the "!" new badge.
 * Returns true if the action has been unlocked (uiNew property) and the player hasn't seen it yet.
 */
export function isActionNew(actionId) {
    if (!actionId) return false;
    const key = `action:${actionId}`;
    return !!(gameFlags.uiSeen && gameFlags.uiSeen[key] === false);
}

/**
 * Mark an action as "seen" by the player — clears the new badge.
 * Pass persist=true to write to localStorage (use from click handlers),
 * pass persist=false for transient badge clearing from hover.
 */
export function markActionSeen(actionId, persist = true) {
    if (!actionId) return;
    if (!gameFlags.uiSeen || typeof gameFlags.uiSeen !== 'object') {
        gameFlags.uiSeen = {};
    }
    const key = `action:${actionId}`;
    gameFlags.uiSeen[key] = true;
    if (persist) {
        try {
            const state = JSON.parse(localStorage.getItem('gameState') || '{}');
            if (!state.gameFlags) state.gameFlags = {};
            if (!state.gameFlags.uiSeen) state.gameFlags.uiSeen = {};
            state.gameFlags.uiSeen[key] = true;
            localStorage.setItem('gameState', JSON.stringify(state));
        } catch { /* ignore */ }
    }
}

/**
 * Flag an action as "new" (just unlocked, not yet seen).
 * Call this when an action becomes available via unlocking.
 */
export function flagActionAsNew(actionId) {
    if (!actionId) return;
    if (!gameFlags.uiSeen || typeof gameFlags.uiSeen !== 'object') {
        gameFlags.uiSeen = {};
    }
    const key = `action:${actionId}`;
    if (gameFlags.uiSeen[key] !== true) {
        gameFlags.uiSeen[key] = false; // false = new, not yet seen
    }
}

/**
 * Check if a location has any new (unseen) actions.
 */
export function locationHasNewActions(location) {
    if (!location || !Array.isArray(location.actions)) return false;
    return location.actions.some(a => isActionNew(a.id));
}

/**
 * Mark all actions in a location as seen.
 */
export function markAllActionsSeen(location) {
    if (!location || !Array.isArray(location.actions)) return;
    location.actions.forEach(a => markActionSeen(a.id, true));
}
