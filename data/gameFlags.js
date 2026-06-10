// Game flags for the timeloop reset game.
// Lightweight replacement; the legacy file was moved to backup/data/.

const initialGameFlags = {
    firstObjectiveComplete: false,
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
}