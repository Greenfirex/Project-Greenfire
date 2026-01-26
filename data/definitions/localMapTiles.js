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

    thornWall: {
        id: 'thornWall',
        label: 'Thorn Wall',
        description: 'A dense, tangled wall of thorns blocks the way. It looks dry enough to burn with a torch.',
        blocked: false,
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
    baseCamp: {
        id: 'baseCamp',
        label: 'Base Camp',
        description: 'A small camp site: shelter, supplies, and a place to organize survivors.',
        blocked: false,
        poiLabel: 'Base Camp',
    },

    // Ship interior / crash POI rooms
    corridor: {
        id: 'corridor',
        label: 'Corridor',
        description: 'A narrow corridor of scorched metal and flickering lights.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    elevator: {
        id: 'elevator',
        label: 'Lift',
        description: 'A heavy service lift shaft with an access platform. Without power, it is inert and blocks progress.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    cafeteria: {
        id: 'cafeteria',
        label: 'Cafeteria',
        description: 'A small mess area. Tables are bolted down; everything smells of smoke.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    crewQuarters: {
        id: 'crewQuarters',
        label: 'Crew Quarters',
        description: 'Dorm bunks and lockers. Many are damaged beyond use.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    laboratory: {
        id: 'laboratory',
        label: 'Laboratory',
        description: 'A compact lab bay with broken instruments and scattered notes.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    powerCore: {
        id: 'powerCore',
        label: 'Power Core',
        description: 'A sealed core housing. Heat radiates through the plating.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    captainsQuarters: {
        id: 'captainsQuarters',
        label: "Captain's Quarters",
        description: 'Private quarters, partly collapsed. The door controls still spark.',
        blocked: false,
        poiLabel: 'Crash Site',
    },
    bridge: {
        id: 'bridge',
        label: 'Bridge',
        description: 'The command bridge. Consoles are dark, but the layout is intact.',
        blocked: false,
        poiLabel: 'Crash Site',
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

// Base camp tile (locked until Investigate Nearby Sound completes)
export const BASE_CAMP_TILE = { x: 2, y: 7 }; // B7

// Ship interior hint tiles (revealed after first stepping on E5)
export const SHIP_INTERIOR_HINT_TILES = [
    { x: 5, y: 4 }, // E4
    { x: 5, y: 5 }, // E5
    { x: 5, y: 6 }, // E6
    { x: 6, y: 5 }, // F5
];

function edgeKey(ax, ay, bx, by) {
    const a = `${Number(ax)},${Number(ay)}`;
    const b = `${Number(bx)},${Number(by)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Internal ship corridor walls inside the crash POI.
// Each entry is an edge between two orthogonally adjacent tiles.
const INTERNAL_POI_WALLS = new Set([
    // D5 <-> D6
    edgeKey(4, 5, 4, 6),
    // F4 <-> F5
    edgeKey(6, 4, 6, 5),
    // F5 <-> F6
    edgeKey(6, 5, 6, 6),

    // Requested corridor walls
    // G3 <-> G4 (separate Laboratory from Power Core)
    edgeKey(7, 3, 7, 4),
    // G4 <-> G5
    edgeKey(7, 4, 7, 5),
    // F6 <-> G6
    edgeKey(6, 6, 7, 6),
    // F7 <-> G7
    edgeKey(6, 7, 7, 7),
]);

// Visual-only door edges inside the crash POI (may or may not also be blocking walls).
const INTERNAL_POI_DOORS = new Set([
    // Lab/Power Core entrances from the main corridors
    // F3 <-> G3
    edgeKey(6, 3, 7, 3),
    // F4 <-> G4
    edgeKey(6, 4, 7, 4),

    // Alternate access opening at D5 (left edge)
    // C5 <-> D5
    edgeKey(3, 5, 4, 5),

    // Main junction doors (E5): top, right, bottom
    // E4 <-> E5
    edgeKey(5, 4, 5, 5),
    // E5 <-> F5
    edgeKey(5, 5, 6, 5),
    // E5 <-> E6
    edgeKey(5, 5, 5, 6),

    // Requested doors
    // F5 <-> G5
    edgeKey(6, 5, 7, 5),
    // G6 <-> H6
    edgeKey(7, 6, 8, 6),
    // G6 <-> G7
    edgeKey(7, 6, 7, 7),
]);

export function hasInternalPoiWallBetween(fromX, fromY, toX, toY) {
    const fx = Number(fromX);
    const fy = Number(fromY);
    const tx = Number(toX);
    const ty = Number(toY);
    if (![fx, fy, tx, ty].every(Number.isFinite)) return false;
    const dist = Math.abs(tx - fx) + Math.abs(ty - fy);
    if (dist !== 1) return false;
    return INTERNAL_POI_WALLS.has(edgeKey(fx, fy, tx, ty));
}

export function hasInternalPoiDoorBetween(fromX, fromY, toX, toY) {
    const fx = Number(fromX);
    const fy = Number(fromY);
    const tx = Number(toX);
    const ty = Number(toY);
    if (![fx, fy, tx, ty].every(Number.isFinite)) return false;
    const dist = Math.abs(tx - fx) + Math.abs(ty - fy);
    if (dist !== 1) return false;
    return INTERNAL_POI_DOORS.has(edgeKey(fx, fy, tx, ty));
}

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
    '6,7': { type: 'crashSite' },

    // Ship interior rooms / corridors
    '4,5': { type: 'corridor' }, // D5
    '5,4': { type: 'corridor' }, // E4
    '5,5': { type: 'corridor' }, // E5
    '5,6': { type: 'corridor' }, // E6
    '6,3': { type: 'corridor' }, // F3
    '6,4': { type: 'corridor' }, // F4
    '6,5': { type: 'elevator' }, // F5
    '6,6': { type: 'crewQuarters' }, // F6

    // Corridor continuation on the east side
    '7,5': { type: 'corridor' }, // G5
    '7,6': { type: 'corridor' }, // G6

    '4,6': { type: 'cafeteria' }, // D6
    '7,3': { type: 'laboratory' }, // G3
    '7,4': { type: 'powerCore' }, // G4
    '7,7': { type: 'captainsQuarters' }, // G7
    '8,6': { type: 'bridge' }, // H6

    // Cave (B6)
    '2,6': { type: 'cave' },
    // Berries / food source (D7)
    '4,7': { type: 'clearing' },
    // Water source (H8)
    '8,8': { type: 'waterSource' },

    // Base camp area (B7) once established
    '2,7': { type: 'clearing' },

    // C5 thorn wall (cleared later)
    '3,5': { type: 'thornWall' },
};

function getMarkersForCell(col, row, localMapState) {
    const c = Number(col);
    const r = Number(row);

    // Early-game onboarding: at game start, only show the ship-entrance pointer.
    // After re-entry has been attempted, reveal the other important pointers.
    const hasTriedReentry = !!(localMapState && localMapState.hasTriedReentry);
    if (!hasTriedReentry) {
        if (
            (c === CAVE_TILE.x && r === CAVE_TILE.y) ||
            (c === BERRIES_TILE.x && r === BERRIES_TILE.y) ||
            (c === WATER_TILE.x && r === WATER_TILE.y)
        ) {
            return [];
        }
    }

    // Ship interior hint markers (shown after first stepping on E5).
    // These are regular "!" markers intended to guide the player to the key junction tiles.
    try {
        if (localMapState && localMapState.shipInteriorTileHints === true) {
            for (const t of SHIP_INTERIOR_HINT_TILES) {
                if (c === t.x && r === t.y) {
                    // E5: keep showing a "!" here until Investigate Nearby Sound is completed.
                    // (Unlike other hint tiles, this should remain visible even after the tile is visited.)
                    if (c === 5 && r === 5) {
                        if (localMapState.investigateSoundDone === true) return null;
                        return [{ kind: 'alert', text: '!', alwaysVisible: true }];
                    }
                    const key = `${t.x},${t.y}`;
                    const visited = !!(localMapState.visited && typeof localMapState.visited === 'object' && localMapState.visited[key] === true);
                    if (!visited) return [{ kind: 'alert', text: '!' }];
                    return [];
                }
            }
        }
    } catch { /* ignore */ }

    // Base camp: only becomes available after Investigate Nearby Sound.
    // Once unlocked, show a marker until the player visits the tile.
    if (c === BASE_CAMP_TILE.x && r === BASE_CAMP_TILE.y) {
        const unlocked = !!(localMapState && localMapState.b7Unlocked === true);
        if (!unlocked) return [];
        const established = !!(localMapState && localMapState.baseCampEstablished === true);
        const discovered = !!(localMapState && localMapState.discoveredBaseCamp === true);
        if (established) return [{ kind: 'camp', text: '⛺', alwaysVisible: true }];
        if (discovered) return [{ kind: 'camp', text: '⛺' }];
        return [{ kind: 'alert', text: '!', alwaysVisible: true }];
    }

    // Cafeteria (D6): once reached, show food + water markers.
    if (c === 4 && r === 6) {
        const key = '4,6';
        const visited = !!(localMapState && localMapState.visited && typeof localMapState.visited === 'object' && localMapState.visited[key] === true);
        const used = Math.max(0, Math.floor(Number(localMapState?.cafeteriaSuppliesByTile?.[key] || 0)));
        if (visited && used < 7) return [{ kind: 'food', text: '🍗' }, { kind: 'water', text: '💧' }];
    }

    // Alternate access tile (D5): marker disappears once the hull is opened.
    if (c === POI_SAFE_TILE.x && r === POI_SAFE_TILE.y) {
        if (localMapState && localMapState.d5HullOpened === true) return [];
        return [{ kind: 'alert', text: '!' }];
    }

    // Ship entrance: once re-entry has been attempted, the marker should disappear.
    if (c === SHIP_ENTRANCE.x && r === SHIP_ENTRANCE.y) {
        if (localMapState && localMapState.hasTriedReentry) return [];
        return [{ kind: 'alert', text: '!' }];
    }

    // Cave
    if (c === CAVE_TILE.x && r === CAVE_TILE.y) {
        if (localMapState && localMapState.discoveredCave) return [{ kind: 'cave', text: '🛏️' }, { kind: 'water', text: '💧' }];
        return [{ kind: 'alert', text: '!' }];
    }

    // Berries / food
    if (c === BERRIES_TILE.x && r === BERRIES_TILE.y) {
        if (localMapState && localMapState.discoveredBerries) return [{ kind: 'berries', text: '🍓' }];
        return [{ kind: 'alert', text: '!' }];
    }

    // Water source
    if (c === WATER_TILE.x && r === WATER_TILE.y) {
        if (localMapState && localMapState.discoveredRiver) return [{ kind: 'water', text: '💧' }];
        return [{ kind: 'alert', text: '!' }];
    }

    // Laboratory: once chemicals harvesting is available, show a marker.
    if (c === 7 && r === 3) {
        if (localMapState && localMapState.labsChemicalsUnlocked === true) return [{ kind: 'chemicals', text: '🧪' }];
    }

    // Crew Quarters (F6): once visited, show a cloth hint.
    if (c === 6 && r === 6) {
        const key = '6,6';
        const visited = !!(localMapState && localMapState.visited && typeof localMapState.visited === 'object' && localMapState.visited[key] === true);
        if (visited) return [{ kind: 'fabric', text: '👕' }];
    }

    // Default important marker
    if (isImportantCell(c, r)) return [{ kind: 'alert', text: '!' }];
    return [];
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
    const ovType = (ov && typeof ov.type === 'string') ? ov.type : null;
    if (ovType) typeId = ovType;

    const inPoi = isCrashPoi(col, row);
    // Crash footprint paints over most base types, but allow explicit per-cell overrides inside the POI.
    if (inPoi && !ovType) typeId = 'crashSite';

    // Base camp tile switches type after camp is established.
    if (c === BASE_CAMP_TILE.x && r === BASE_CAMP_TILE.y) {
        if (localMapState && localMapState.baseCampEstablished === true) {
            typeId = 'baseCamp';
        }
    }

    // C5 thorn wall -> becomes a clearing once burned.
    if (c === 3 && r === 5) {
        if (localMapState && localMapState.c5ThornWallBurned === true) {
            typeId = 'clearing';
        } else {
            typeId = 'thornWall';
        }
    }

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
    // Do not apply this restriction inside the crash POI.
    // Coordinates are 1-based: H=8, I=9.
    const isH7 = (c === 8 && r === 7);
    const isH8 = (c === 8 && r === 8);
    if (!inPoi && (c === 8 || c === 9)) {
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

    // Base camp tile (B7) is unlocked later.
    if (c === BASE_CAMP_TILE.x && r === BASE_CAMP_TILE.y) {
        globallyAllowed = !!(localMapState && localMapState.b7Unlocked === true);
    }

    // Explicitly allow C5 even though it's in the normally-blocked top band.
    if (c === 3 && r === 5) {
        globallyAllowed = true; // C5 dark forest (torch-gated elsewhere)
    }

    let blocked = !globallyAllowed || !!(type.blocked || (ov && ov.blocked === true) || lockedByStage);

    // Once the initial re-entry attempt collapses the entrance, the entrance tile should be permanently blocked.
    if (isEntrance && localMapState && localMapState.hasTriedReentry === true) {
        blocked = true;
    }

    const markers = getMarkersForCell(c, r, localMapState);
    const firstMarker = (Array.isArray(markers) && markers.length) ? markers[0] : null;
    const markerAlwaysVisible = !!(Array.isArray(markers) && markers.some(m => m && m.alwaysVisible === true));

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
        markers: Array.isArray(markers) ? markers : [],
        markerKind: firstMarker ? firstMarker.kind : null,
        markerText: firstMarker ? firstMarker.text : null,
        markerAlwaysVisible,
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

    // Internal POI corridor walls (both sides inside the crash POI).
    if (fromIn && toIn) {
        return hasInternalPoiWallBetween(fx, fy, tx, ty);
    }

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

    // Special opening at D5 (alternate access), but only after the hull has been pried open.
    // This keeps the POI sealed until the player completes the Alternate Access chain.
    if (edge === 'left' && inX === 4 && inY === 5) {
        return !(localMapState && localMapState.d5HullOpened === true);
    }

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
