// Game flags for the timeloop reset game.
// Lightweight replacement; the legacy file was moved to backup/data/.
//
// ==========================================================================
// FLAG SYSTEM — two categories
// ==========================================================================
// PERSISTENT FLAGS  → survive death, saved/loaded from localStorage
// PER-LOOP FLAGS    → reset on death, always start at initial value
//
// When you add a new flag:
//   - Survives death? → put it in INITIAL_PERSISTENT_FLAGS
//   - Resets on death? → put it in INITIAL_PER_LOOP_FLAGS
// That's it. Nothing else to change. No whitelists. No manual reset code.
// ==========================================================================

const INITIAL_PERSISTENT_FLAGS = {
    firstObjectiveComplete: false,
    loopCount: 0,
    // Persistent action progress that survives death loops.
    persistentProgress: {},
    // Track which loop-stage story popups have been shown (by stage number key).
    loopStoryShown: {},
    // UI-only persistence: which action/upgrade IDs the player has already seen.
    uiSeen: {},
    // Knowledge that persists across death loops — player remembers things.
    loopKnowledge: {
        milestones: {},
    },
};

const INITIAL_PER_LOOP_FLAGS = {
    recyclerFixed: false,
    reactorOptimized: false,
    recyclerAttempted: false,
    commsInstalled: false,
    distressSignalSent: false,
};

// Combined for backward compatibility — both objects merged.
const initialGameFlags = Object.assign({}, INITIAL_PERSISTENT_FLAGS, INITIAL_PER_LOOP_FLAGS);

/** Check if player has terminal login access. */
export function hasLogin(milestones = {}) {
    return !!(milestones.crew_terminal_hacked ||
              milestones.crew_terminal_note_used ||
              milestones.bridge_terminal_hacked ||
              milestones.bridge_terminal_note_used);
}

export function getInitialGameFlags() {
    return Object.assign({}, INITIAL_PERSISTENT_FLAGS, INITIAL_PER_LOOP_FLAGS);
}

export const gameFlags = getInitialGameFlags();

export function resetGameFlags() {
    Object.keys(gameFlags).forEach(k => delete gameFlags[k]);
    Object.assign(gameFlags, getInitialGameFlags());
}

/**
 * Reset only per-loop flags to their initial values.
 * Uses INITIAL_PER_LOOP_FLAGS as the single source of truth.
 * Does NOT affect persistent flags (loopCount, loopKnowledge, uiSeen, etc.).
 */
export function resetPerLoopFlags() {
    Object.assign(gameFlags, INITIAL_PER_LOOP_FLAGS);
}

export function applySavedGameFlags(savedFlags = {}) {
    // Start fresh — both persistent and per-loop at defaults.
    Object.keys(gameFlags).forEach(k => delete gameFlags[k]);
    Object.assign(gameFlags, getInitialGameFlags());

    // Restore ONLY persistent flags — per-loop flags stay at their initial defaults.
    Object.keys(INITIAL_PERSISTENT_FLAGS).forEach(k => {
        if (Object.prototype.hasOwnProperty.call(savedFlags, k)) {
            gameFlags[k] = savedFlags[k];
        }
    });

    // Ensure nested objects exist even if save data was incomplete.
    if (!gameFlags.uiSeen || typeof gameFlags.uiSeen !== 'object') {
        gameFlags.uiSeen = {};
    }
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