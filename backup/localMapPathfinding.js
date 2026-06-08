import { getLocalMapTileAt, isCrashWallBetween, LOCAL_MAP_COLS, LOCAL_MAP_ROWS } from './crashSiteMap.js';

function inBounds(x, y) {
    return Number.isFinite(x) && Number.isFinite(y) && x >= 1 && x <= LOCAL_MAP_COLS && y >= 1 && y <= LOCAL_MAP_ROWS;
}

function isVisited(localMapState, x, y) {
    try {
        const key = `${Number(x)},${Number(y)}`;
        return !!(localMapState && typeof localMapState === 'object'
            && localMapState.visited
            && typeof localMapState.visited === 'object'
            && localMapState.visited[key] === true);
    } catch {
        return false;
    }
}

function isStepAllowed({ fromX, fromY, toX, toY, localMapState, scoutStage = 0, hasTriedReentry = false } = {}) {
    const fx = Number(fromX);
    const fy = Number(fromY);
    const tx = Number(toX);
    const ty = Number(toY);

    if (![fx, fy, tx, ty].every(Number.isFinite)) return false;
    if (!inBounds(fx, fy) || !inBounds(tx, ty)) return false;

    const dist = Math.abs(tx - fx) + Math.abs(ty - fy);
    if (dist !== 1) return false;

    // Gate: do not allow moving west until the H8 river encounter has been visited.
    const movingWest = tx < fx;
    const blockedByWestGate = !!(movingWest && !(localMapState && localMapState.riverCombatDone));
    if (blockedByWestGate) return false;

    const hasTried = !!(localMapState && localMapState.hasTriedReentry === true);

    // Entrance tile (F7): after the failed re-entry attempt, block stepping back in from outside
    // until the river is discovered.
    try {
        const isEntrance = (tx === 6 && ty === 7);
        if (isEntrance && hasTried && !(localMapState && localMapState.riverCombatDone)) {
            const fromMeta = getLocalMapTileAt(fx, fy, { scoutStage, hasTriedReentry, localMapState });
            if (fromMeta && !fromMeta.inPoi) return false;
        }
    } catch { /* ignore */ }

    try {
        if (isCrashWallBetween(fx, fy, tx, ty, { localMapState })) return false;
    } catch { /* ignore */ }

    const meta = getLocalMapTileAt(tx, ty, { scoutStage, hasTriedReentry, localMapState });
    if (meta && meta.blocked) return false;

    // C5 thorny wall: block movement until it has been burned.
    try {
        const isC5 = (tx === 3 && ty === 5);
        const burned = !!(localMapState && localMapState.c5ThornWallBurned === true);
        if (isC5 && !burned) return false;
    } catch { /* ignore */ }

    return true;
}

export function findCrashSitePath({ fromX, fromY, toX, toY, localMapState, scoutStage = 0, hasTriedReentry = false } = {}) {
    const sx = Number(fromX);
    const sy = Number(fromY);
    const gx = Number(toX);
    const gy = Number(toY);

    if (![sx, sy, gx, gy].every(Number.isFinite)) return null;
    if (!inBounds(sx, sy) || !inBounds(gx, gy)) return null;

    // Only path to explored tiles (and only through explored tiles).
    if (!isVisited(localMapState, sx, sy) || !isVisited(localMapState, gx, gy)) return null;

    const startKey = `${sx},${sy}`;
    const goalKey = `${gx},${gy}`;

    const queue = [{ x: sx, y: sy }];
    const cameFrom = new Map();
    cameFrom.set(startKey, null);

    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
    ];

    while (queue.length) {
        const cur = queue.shift();
        if (!cur) break;
        const curKey = `${cur.x},${cur.y}`;
        if (curKey === goalKey) break;

        for (const d of dirs) {
            const nx = cur.x + d.dx;
            const ny = cur.y + d.dy;
            if (!inBounds(nx, ny)) continue;

            const nk = `${nx},${ny}`;
            if (cameFrom.has(nk)) continue;

            if (!isVisited(localMapState, nx, ny)) continue;

            if (!isStepAllowed({ fromX: cur.x, fromY: cur.y, toX: nx, toY: ny, localMapState, scoutStage, hasTriedReentry })) continue;

            cameFrom.set(nk, { x: cur.x, y: cur.y });
            queue.push({ x: nx, y: ny });
        }
    }

    if (!cameFrom.has(goalKey)) return null;

    const path = [];
    let cur = { x: gx, y: gy };
    while (cur) {
        path.push({ x: cur.x, y: cur.y });
        const prev = cameFrom.get(`${cur.x},${cur.y}`);
        cur = prev;
    }

    path.reverse();
    return path;
}
