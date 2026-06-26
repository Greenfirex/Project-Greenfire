// Game flags for the timeloop reset game.
// Lightweight replacement; the legacy file was moved to backup/data/.

const initialGameFlags = {
    firstObjectiveComplete: false,
    loopCount: 0,
    // Persistent action progress that survives death loops.
    persistentProgress: {},
    // Track which loop-stage story popups have been shown (by stage number key).
    loopStoryShown: {},
    // UI-only persistence: which action/upgrade IDs the player has already seen.
    uiSeen: {},
    // Resets on death loop — per-loop state.
    recyclerFixed: false,
    reactorOptimized: false,
    recyclerAttempted: false,
    // Knowledge that persists across death loops — player remembers things.
    // Uses milestones instead of binary flags for robust context-aware messaging.
    loopKnowledge: {
        milestones: {},
    }
};

/** Check if player has terminal login access. */
export function hasLogin(milestones = {}) {
    return !!(milestones.crew_terminal_hacked ||
              milestones.crew_terminal_note_used ||
              milestones.bridge_terminal_hacked ||
              milestones.bridge_terminal_note_used);
}

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
    // Ensure loopKnowledge and milestones exist
    if (!gameFlags.loopKnowledge || typeof gameFlags.loopKnowledge !== 'object') {
        gameFlags.loopKnowledge = { milestones: {} };
    }
    if (!gameFlags.loopKnowledge.milestones || typeof gameFlags.loopKnowledge.milestones !== 'object') {
        gameFlags.loopKnowledge.milestones = {};
    }
}

/**
 * Set a milestone in loopKnowledge and persist.
 */
export function setMilestone(name, persistFn) {
    if (!gameFlags.loopKnowledge) gameFlags.loopKnowledge = { milestones: {} };
    if (!gameFlags.loopKnowledge.milestones) gameFlags.loopKnowledge.milestones = {};
    gameFlags.loopKnowledge.milestones[name] = true;
    if (typeof persistFn === 'function') persistFn();
}

/**
 * Check if a milestone has been reached.
 */
export function hasMilestone(name) {
    return !!(gameFlags.loopKnowledge?.milestones?.[name]);
}

/**
 * Check if an action should show the "!" new badge.
 */
export function isActionNew(actionId) {
    if (!actionId) return false;
    const key = `action:${actionId}`;
    return !!(gameFlags.uiSeen && gameFlags.uiSeen[key] === false);
}

/**
 * Mark an action as "seen" by the player — clears the new badge.
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
 */
export function flagActionAsNew(actionId) {
    if (!actionId) return;
    if (!gameFlags.uiSeen || typeof gameFlags.uiSeen !== 'object') {
        gameFlags.uiSeen = {};
    }
    const key = `action:${actionId}`;
    if (gameFlags.uiSeen[key] !== true) {
        gameFlags.uiSeen[key] = false;
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