export const SHIP_ENTRANCE = { x: 0, y: 0 };
export const CRASH_SITE_MAP_BOUND_ACTION_IDS = new Set([]);

export function getLocalMapTileAt(col, row, { scoutStage = 0, hasTriedReentry = false, localMapState = null } = {}) {
    return null;
}

export function isCrashPoi(col, row, { scoutStage = 0, hasTriedReentry = false, localMapState = null } = {}) {
    return false;
}

export function isCrashWallBetween(fromX, fromY, toX, toY, { localMapState = null } = {}) {
    return false;
}
