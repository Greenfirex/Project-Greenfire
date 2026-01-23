// Local Map (Crash Site) tile definitions.
// Keep this module data-driven: map rendering lives in sections/crashSiteLocalMap.js.

export const LOCAL_MAP_COLS = 11; // A-K
export const LOCAL_MAP_ROWS = 9;  // 1-9
export const LOCAL_MAP_LETTERS = Array.from({ length: LOCAL_MAP_COLS }, (_, i) => String.fromCharCode('A'.charCodeAt(0) + i));

export const LOCAL_MAP_TILE_TYPES = {
    forest: {
        id: 'forest',
        label: 'Forest',
        description: 'Dense alien forest. Visibility is limited and the ground is uneven.',
        blocked: false,
    },
    darkForest: {
        id: 'darkForest',
        label: 'Dark Forest',
        description: 'The canopy is thick enough to swallow the light. Without a torch, moving here is risky.',
        blocked: false,
    },
    river: {
        id: 'river',
        label: 'River',
        description: 'Fast-moving water cuts through the terrain. Crossing here is not safe.',
        blocked: true,
    },
    largeTree: {
        id: 'largeTree',
        label: 'Large Tree',
        description: 'A massive trunk and tangled roots block the way.',
        blocked: true,
    },
    thicket: {
        id: 'thicket',
        label: 'Thicket',
        description: 'Thorny growth makes passage difficult without tools.',
        blocked: true,
    },
    clearing: {
        id: 'clearing',
        label: 'Clearing',
        description: 'A small break in the canopy. Easier footing and better visibility.',
        blocked: false,
    },
    cave: {
        id: 'cave',
        label: 'Cave',
        description: 'A dry, sheltered cave recessed in the rock. A safe place to catch your breath.',
        blocked: false,
    },
    waterSource: {
        id: 'waterSource',
        label: 'Water Source',
        description: 'You can hear running water nearby. With the right setup, you could collect and purify it.',
        blocked: false,
    },
    crashSite: {
        id: 'crashSite',
        label: 'Crash Site',
        description: 'The ship is embedded in the terrain, still burning in places.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    entrance: {
        id: 'entrance',
        label: 'Ship Entrance',
        description: 'A gap in the hull where you can attempt to re-enter the ship.',
        blocked: false,
        poiLabel: 'Ship Entrance',
    },
};

// Ship entrance tile (F7)
export const SHIP_ENTRANCE = { x: 6, y: 7 };

// POI interior tile intended as the only walkable POI tile.
export const POI_SAFE_TILE = { x: 4, y: 5 }; // D5

// Special discovery tiles (used for markers and map-driven unlocks).
export const CAVE_TILE = { x: 2, y: 6 };      // B6
export const BERRIES_TILE = { x: 4, y: 7 };   // D7
export const WATER_TILE = { x: 8, y: 8 };     // H8

// Crash Site POI footprint tuned to assets/images/mapback.png.
export const CRASH_POI_CELLS = new Set([
    // D column
    '4,5', '4,6',
    // E column
    '5,4', '5,5', '5,6',
    // F column
    '6,3', '6,4', '6,5', '6,6', '6,7',
    // G column
    '7,3', '7,4', '7,5', '7,6', '7,7',
    // H column
    '8,6',
]);

// Important markers to draw on the map UI.
export const IMPORTANT_CELLS = new Set([
    `${SHIP_ENTRANCE.x},${SHIP_ENTRANCE.y}`,
    `${POI_SAFE_TILE.x},${POI_SAFE_TILE.y}`,
    `${CAVE_TILE.x},${CAVE_TILE.y}`,
    `${BERRIES_TILE.x},${BERRIES_TILE.y}`,
    `${WATER_TILE.x},${WATER_TILE.y}`,
]);

// Coordinate overrides: key is "col,row" (1-based)
// You can use minScoutStage to progressively open the map as scouting progresses.
// - If minScoutStage is set and current scoutStage is lower, the tile is treated as blocked.
const OVERRIDES = {
    // Ship entrance tile
    '6,7': { type: 'entrance' },
    // Cave (B6)
    '2,6': { type: 'cave' },
    // Berries / food source (D7)
    '4,7': { type: 'clearing' },
    // Water source (H8)
    '8,8': { type: 'waterSource' },

    // C5 (Dark Forest) - walkable, but gameplay may require a torch.
    '3,5': { type: 'darkForest' },
};

function getMarkerForCell(col, row, localMapState) {
    const c = Number(col);
    const r = Number(row);

    // Ship entrance: once re-entry has been attempted, the marker should disappear.
    if (c === SHIP_ENTRANCE.x && r === SHIP_ENTRANCE.y) {
        if (localMapState && localMapState.hasTriedReentry) return null;
        return { kind: 'alert', text: '!' };
    }

    // Cave
    if (c === CAVE_TILE.x && r === CAVE_TILE.y) {
        if (localMapState && localMapState.discoveredCave) return { kind: 'rest', text: 'R' };
        return { kind: 'alert', text: '!' };
    }

    // Berries / food
    if (c === BERRIES_TILE.x && r === BERRIES_TILE.y) {
        if (localMapState && localMapState.discoveredBerries) return { kind: 'berries', text: 'B' };
        return { kind: 'alert', text: '!' };
    }

    // Water source
    if (c === WATER_TILE.x && r === WATER_TILE.y) {
        if (localMapState && localMapState.discoveredRiver) return { kind: 'water', text: 'W' };
        return { kind: 'alert', text: '!' };
    }

    // Default important marker
    if (isImportantCell(c, r)) return { kind: 'alert', text: '!' };
    return null;
}

function coordKey(col, row) {
    return `${Number(col)},${Number(row)}`;
}

export function isCrashPoi(col, row) {
    return CRASH_POI_CELLS.has(coordKey(col, row));
}

export function isImportantCell(col, row) {
    return IMPORTANT_CELLS.has(coordKey(col, row));
}

function isAdjacentToCrashPoi(col, row) {
    const c = Number(col);
    const r = Number(row);
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (isCrashPoi(c + dx, r + dy)) return true;
        }
    }
    return false;
}

export function getLocalMapTileAt(col, row, { scoutStage = 0, hasTriedReentry = false, localMapState = null } = {}) {
    const key = coordKey(col, row);
    const c = Number(col);
    const r = Number(row);

    // Base type
    let typeId = 'forest';
    const ov = OVERRIDES[key];
    if (ov && typeof ov.type === 'string') typeId = ov.type;

    const inPoi = isCrashPoi(col, row);
    // Crash footprint paints over most base types
    if (inPoi) typeId = 'crashSite';

    const type = LOCAL_MAP_TILE_TYPES[typeId] || LOCAL_MAP_TILE_TYPES.forest;

    const minScoutStage = (ov && Number.isFinite(ov.minScoutStage)) ? ov.minScoutStage : null;
    const lockedByStage = (typeof minScoutStage === 'number') ? (Number(scoutStage) < minScoutStage) : false;

    // Global movement rule:
    // - Outside the crash POI: restrict to a walkable "ring" near the POI (plus explicit exceptions)
    // - Inside the crash POI: tiles are not intrinsically blocked (the POI outline wall controls access)
    const isEntrance = (c === SHIP_ENTRANCE.x && r === SHIP_ENTRANCE.y);
    const isPoiSafeTile = (c === POI_SAFE_TILE.x && r === POI_SAFE_TILE.y);

    let globallyAllowed = false;
    if (inPoi) {
        globallyAllowed = true;
    } else {
        globallyAllowed = isAdjacentToCrashPoi(col, row);
    }

    // Hard block H and I columns to shape progression, except H7 and H8.
    // Coordinates are 1-based: H=8, I=9.
    const isH7 = (c === 8 && r === 7);
    const isH8 = (c === 8 && r === 8);
    if (c === 8 || c === 9) {
        globallyAllowed = isH7 || isH8;
    }

    // Block top rows to force a walkable route.
    // Exception: do not apply this restriction inside the crash POI.
    if (!inPoi && r >= 1 && r <= 5) {
        globallyAllowed = false;
    }

    // Explicitly allow special tiles even if they are not near the POI.
    if (c === 2 && r === 6) {
        globallyAllowed = true; // B6 cave
    }

    // Explicitly allow C5 even though it's in the normally-blocked top band.
    if (c === 3 && r === 5) {
        globallyAllowed = true; // C5 dark forest (torch-gated elsewhere)
    }

    const blocked = !globallyAllowed || !!(type.blocked || (ov && ov.blocked === true) || lockedByStage);

    const marker = getMarkerForCell(c, r, localMapState);

    return {
        key,
        col: c,
        row: r,
        typeId: type.id,
        label: type.label,
        description: type.description,
        poiLabel: (ov && ov.poiLabel) ? ov.poiLabel : (type.poiLabel || null),
        blocked,
        important: isImportantCell(col, row),
        markerKind: marker ? marker.kind : null,
        markerText: marker ? marker.text : null,
        inPoi,
        isEntrance,
        isPoiSafeTile,
        minScoutStage,
        lockedByStage,
    };
}

export function isCrashWallBetween(fromX, fromY, toX, toY, { localMapState = null } = {}) {
    // Crash-site outline is treated as a boundary wall from the start,
    // but it has a gap under F7 until the re-entry attempt fails.
    const hasTriedReentry = !!(localMapState && localMapState.hasTriedReentry === true);

    const fx = Number(fromX);
    const fy = Number(fromY);
    const tx = Number(toX);
    const ty = Number(toY);
    if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;

    const dist = Math.abs(tx - fx) + Math.abs(ty - fy);
    if (dist !== 1) return false;

    const fromIn = isCrashPoi(fx, fy);
    const toIn = isCrashPoi(tx, ty);
    if (fromIn === toIn) return false; // only blocks crossing the boundary

    // Determine which side is inside the POI and which edge is being crossed.
    const inX = toIn ? tx : fx;
    const inY = toIn ? ty : fy;
    const outX = toIn ? fx : tx;
    const outY = toIn ? fy : ty;

    let edge = null;
    if (outX === inX - 1 && outY === inY) edge = 'left';
    else if (outX === inX + 1 && outY === inY) edge = 'right';
    else if (outX === inX && outY === inY - 1) edge = 'top';
    else if (outX === inX && outY === inY + 1) edge = 'bottom';
    if (!edge) return false;

    // Requested: remove left wall at C3 (no-op if not part of the POI).
    // Correction: C3 -> D5.
    if (edge === 'left' && inX === 4 && inY === 5) return false;

    // Gap under the ship entrance (F7) until re-entry attempt fails.
    // Crossing between F8 (outside) and F7 (inside) is allowed before hasTriedReentry.
    if (!hasTriedReentry && edge === 'bottom' && inX === SHIP_ENTRANCE.x && inY === SHIP_ENTRANCE.y) return false;

    // Boundary edges are where the inside cell has a neighbor outside the POI.
    if (edge === 'left') return !isCrashPoi(inX - 1, inY);
    if (edge === 'right') return !isCrashPoi(inX + 1, inY);
    if (edge === 'top') return !isCrashPoi(inX, inY - 1);
    if (edge === 'bottom') return !isCrashPoi(inX, inY + 1);
    return false;
}
