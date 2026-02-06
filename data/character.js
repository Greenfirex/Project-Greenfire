import { getItemDefinition } from './definitions/items.js';

const DEFAULT_BAG_COLS = 6;
const DEFAULT_BAG_ROWS = 2;

const EQUIPMENT_SLOTS = [
    'head',
    'chest',
    'legs',
    'boots',
    'weapon',
    'offhand',
    'accessory_1',
    'accessory_2'
];

// Leveling
// - XP curve: XP to next level = 100 * currentLevel
// - Level starts at 1 when XP is 0
const XP_PER_LEVEL_FACTOR = 100;
const STAT_POINTS_PER_LEVEL = 3;

const UPGRADEABLE_STATS = [
    'health',
    'stamina',
    'hitChance',
    'critChance',
    'attackSpeed',
    'evasion',
];

const STAT_POINT_EFFECTS = {
    // Max vitals
    health: 5,
    stamina: 5,
    // Combat
    hitChance: 1, // percent points
    critChance: 1, // percent points
    // attackSpeed is seconds between attacks; lower is faster.
    attackSpeed: -0.05,
    evasion: 1, // percent points
};

const BASE_STATS = {
    health: 100,
    stamina: 100,
    damageMin: 1,
    damageMax: 2,
    // attackSpeed is seconds between attacks.
    attackSpeed: 1.0,
    // Percent chance for an attack to land. Used by combat.
    hitChance: 75,
    armor: 0,
    critChance: 5,
    // Percent chance to evade an incoming attack.
    evasion: 0,
};

function emitCharacterStateChanged(reason = 'unknown') {
    try {
        window.dispatchEvent(new CustomEvent('character-state-changed', {
            detail: { reason, time: Date.now() }
        }));
    } catch { /* non-fatal */ }
}

function isValidBagIndex(index) {
    return Number.isInteger(index) && index >= 0 && index < (characterState?.bag?.length ?? 0);
}

function normalizeEquipSlot(slot) {
    const s = String(slot || '').toLowerCase();
    return EQUIPMENT_SLOTS.includes(s) ? s : null;
}

export function canEquipItemToSlot(itemId, equipSlot) {
    const slot = normalizeEquipSlot(equipSlot);
    if (!slot) return false;
    if (!itemId) return false;

    const def = getItemDefinition(itemId);
    if (!def) return false;

    // Accessories can go into either accessory slot.
    if (def.slot === 'accessory') {
        return slot === 'accessory_1' || slot === 'accessory_2';
    }
    return def.slot === slot;
}

export function swapBagSlots(fromIndex, toIndex) {
    if (!isValidBagIndex(fromIndex) || !isValidBagIndex(toIndex)) return false;
    if (fromIndex === toIndex) return true;
    const bag = characterState.bag;
    const tmp = bag[fromIndex];
    bag[fromIndex] = bag[toIndex] ?? null;
    bag[toIndex] = tmp ?? null;

    // Keep UI "new" flags attached to the item as it moves.
    try {
        if (Array.isArray(characterState.bagUiNew)) {
            const t = !!characterState.bagUiNew[fromIndex];
            characterState.bagUiNew[fromIndex] = !!characterState.bagUiNew[toIndex];
            characterState.bagUiNew[toIndex] = t;
        }
    } catch { /* ignore */ }

    emitCharacterStateChanged('swapBagSlots');
    return true;
}

export function moveBagItemToEquip(bagIndex, equipSlot) {
    if (!isValidBagIndex(bagIndex)) return false;
    const slot = normalizeEquipSlot(equipSlot);
    if (!slot) return false;

    const itemId = characterState.bag[bagIndex];
    if (!itemId) return false;
    if (!canEquipItemToSlot(itemId, slot)) return false;

    const prevEquip = characterState.equipment[slot] ?? null;
    characterState.equipment[slot] = itemId;
    characterState.bag[bagIndex] = prevEquip;

    // Item left the bag; clear "new" marker for that slot.
    try {
        if (Array.isArray(characterState.bagUiNew)) characterState.bagUiNew[bagIndex] = false;
    } catch { /* ignore */ }

    emitCharacterStateChanged('moveBagItemToEquip');
    return true;
}

export function moveEquipItemToBag(equipSlot, bagIndex) {
    const slot = normalizeEquipSlot(equipSlot);
    if (!slot) return false;
    if (!isValidBagIndex(bagIndex)) return false;

    const itemId = characterState.equipment[slot];
    if (!itemId) return false;

    const prevBag = characterState.bag[bagIndex] ?? null;
    characterState.bag[bagIndex] = itemId;
    characterState.equipment[slot] = prevBag;

    // Moving an already-known equipped item back to bag should not mark it as "new".
    try {
        if (Array.isArray(characterState.bagUiNew)) characterState.bagUiNew[bagIndex] = false;
    } catch { /* ignore */ }

    emitCharacterStateChanged('moveEquipItemToBag');
    return true;
}

export function moveEquipItemToEquip(fromSlot, toSlot) {
    const src = normalizeEquipSlot(fromSlot);
    const dst = normalizeEquipSlot(toSlot);
    if (!src || !dst) return false;
    if (src === dst) return true;

    const itemId = characterState.equipment[src];
    if (!itemId) return false;
    if (!canEquipItemToSlot(itemId, dst)) return false;

    const prev = characterState.equipment[dst] ?? null;
    characterState.equipment[dst] = itemId;
    characterState.equipment[src] = prev;
    emitCharacterStateChanged('moveEquipItemToEquip');
    return true;
}

function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function makeEmptyBag(cols, rows) {
    const size = Math.max(0, cols * rows);
    return Array.from({ length: size }, () => null);
}

export function getInitialCharacterState() {
    const bagCols = DEFAULT_BAG_COLS;
    const bagRows = DEFAULT_BAG_ROWS;

    const bag = makeEmptyBag(bagCols, bagRows);
    // Per-slot UI "new" flags for bag items.
    // This persists as part of characterState so "new" markers survive reloads.
    const bagUiNew = Array.from({ length: bag.length }, () => false);
    // Starter consumable for combat prototype.
    if (bag.length > 0) bag[0] = 'stimpack';

    // Starter loadout: equipped by default.
    const equipment = {
        head: 'basic_helmet',
        chest: 'field_armor',
        legs: 'utility_legs',
        boots: 'basic_boots',
        weapon: null,
        offhand: null,
        accessory_1: null,
        accessory_2: null,
    };

    return {
        version: 4,
        bagCols,
        bagRows,
        bag,
        bagUiNew,
        equipment,
        localMap: {
            // A-K / 1-9 grid coordinates (1-based)
            x: 6,
            y: 8,
            selectedX: 6,
            selectedY: 8,
            // Persistent exploration hints
            visited: { '6,8': true },
            // Per-ship-tile depletion tracking (e.g., Strip Wiring). Keys are "x,y".
            wiringStrippedByTile: {},
            // Per-ship-tile depletion tracking for cafeteria supplies scavenging. Keys are "x,y".
            cafeteriaSuppliesByTile: {},
            // UI preference: local map zoom level
            zoom: 1,
            // UI preference: local map pan offsets (px)
            panX: 0,
            panY: 0,
        },
        progression: {
            allocated: {
                health: 0,
                stamina: 0,
                hitChance: 0,
                critChance: 0,
                attackSpeed: 0,
                evasion: 0,
            }
        },
    };
}

export let characterState = getInitialCharacterState();

export function resetCharacterState() {
    characterState = getInitialCharacterState();
    emitCharacterStateChanged('resetCharacterState');
}

export function getCharacterStateForSave() {
    // Ensure we only persist JSON-safe data
    return JSON.parse(JSON.stringify(characterState));
}

export function applySavedCharacterState(saved) {
    if (!saved || typeof saved !== 'object') {
        resetCharacterState();
        return;
    }

    const next = getInitialCharacterState();

    // Bag sizing (allows future upgrades to expand rows/cols)
    const bagCols = clampInt(saved.bagCols ?? next.bagCols, 1, 12);
    const bagRows = clampInt(saved.bagRows ?? next.bagRows, 1, 12);
    next.bagCols = bagCols;
    next.bagRows = bagRows;

    const desiredSize = bagCols * bagRows;
    const savedBag = Array.isArray(saved.bag) ? saved.bag : [];
    next.bag = Array.from({ length: desiredSize }, (_, i) => {
        const v = savedBag[i] ?? null;
        if (v === null) return null;
        if (typeof v !== 'string') return null;
        return getItemDefinition(v) ? v : null;
    });

    // UI: per-slot "new" flags for bag items.
    // Saved values may be missing (older saves) or mis-sized (bag upgrades).
    try {
        const savedUi = Array.isArray(saved.bagUiNew) ? saved.bagUiNew : [];
        next.bagUiNew = Array.from({ length: desiredSize }, (_, i) => !!savedUi[i]);
    } catch {
        next.bagUiNew = Array.from({ length: desiredSize }, () => false);
    }

    // Equipment
    const savedEq = saved.equipment && typeof saved.equipment === 'object' ? saved.equipment : {};
    EQUIPMENT_SLOTS.forEach(slot => {
        const v = savedEq[slot] ?? null;
        if (v === null) {
            next.equipment[slot] = null;
            return;
        }
        if (typeof v !== 'string') {
            next.equipment[slot] = null;
            return;
        }
        next.equipment[slot] = getItemDefinition(v) ? v : null;
    });

    // Local map state (prototype)
    try {
        const lm = (saved && typeof saved.localMap === 'object') ? saved.localMap : null;
        const clampInt = (v, min, max) => {
            const n = Math.floor(Number(v));
            if (!Number.isFinite(n)) return min;
            return Math.min(max, Math.max(min, n));
        };
        const x = clampInt(lm?.x ?? next.localMap.x, 1, 11);
        const y = clampInt(lm?.y ?? next.localMap.y, 1, 9);
        const selectedX = clampInt(lm?.selectedX ?? x, 1, 11);
        const selectedY = clampInt(lm?.selectedY ?? y, 1, 9);

        // Preserve extra prototype fields so content/markers remain consistent after load.
        const extra = {};
        if (lm && typeof lm === 'object') {
            for (const [k, v] of Object.entries(lm)) {
                if (k === 'x' || k === 'y' || k === 'selectedX' || k === 'selectedY' || k === 'visited' || k === 'zoom') continue;
                if (typeof k !== 'string' || k.length > 60) continue;
                // Allow a small set of whitelisted structured local-map fields.
                if (k === 'wiringStrippedByTile' && v && typeof v === 'object' && !Array.isArray(v)) {
                    const cleaned = {};
                    for (const [kk, vv] of Object.entries(v)) {
                        if (typeof kk !== 'string') continue;
                        const m = kk.match(/^(\d+),(\d+)$/);
                        if (!m) continue;
                        const cx = clampInt(m[1], 1, 11);
                        const cy = clampInt(m[2], 1, 9);
                        const n = Math.floor(Number(vv));
                        if (!Number.isFinite(n) || n < 0) continue;
                        cleaned[`${cx},${cy}`] = Math.min(5, n);
                    }
                    extra[k] = cleaned;
                } else if (k === 'cafeteriaSuppliesByTile' && v && typeof v === 'object' && !Array.isArray(v)) {
                    const cleaned = {};
                    for (const [kk, vv] of Object.entries(v)) {
                        if (typeof kk !== 'string') continue;
                        const m = kk.match(/^(\d+),(\d+)$/);
                        if (!m) continue;
                        const cx = clampInt(m[1], 1, 11);
                        const cy = clampInt(m[2], 1, 9);
                        const n = Math.floor(Number(vv));
                        if (!Number.isFinite(n) || n < 0) continue;
                        cleaned[`${cx},${cy}`] = Math.min(7, n);
                    }
                    extra[k] = cleaned;
                } else if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
                    extra[k] = v;
                }
            }
        }

        // Visited tiles (stored as an object map or legacy array of coord strings)
        const visited = {};
        const acceptVisitedKey = (key) => {
            if (typeof key !== 'string') return;
            const m = key.match(/^(\d+),(\d+)$/);
            if (!m) return;
            const c = clampInt(m[1], 1, 11);
            const r = clampInt(m[2], 1, 9);
            visited[`${c},${r}`] = true;
        };
        if (lm && typeof lm.visited === 'object' && lm.visited && !Array.isArray(lm.visited)) {
            for (const [k, v] of Object.entries(lm.visited)) {
                if (v !== true) continue;
                acceptVisitedKey(k);
            }
        } else if (Array.isArray(lm?.visited)) {
            for (const key of lm.visited) acceptVisitedKey(key);
        }
        // Always include the current player tile.
        visited[`${x},${y}`] = true;

        const rawZoom = Number(lm?.zoom);
        const zoom = Number.isFinite(rawZoom)
            ? Math.min(2, Math.max(0.6, rawZoom))
            : (Number.isFinite(Number(next.localMap.zoom)) ? Number(next.localMap.zoom) : 1);

        const clampPan = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return Math.max(-5000, Math.min(5000, n));
        };
        const panX = (zoom <= 1.01) ? 0 : clampPan(lm?.panX);
        const panY = (zoom <= 1.01) ? 0 : clampPan(lm?.panY);

        next.localMap = {
            ...next.localMap,
            ...extra,
            x,
            y,
            selectedX,
            selectedY,
            visited,
            zoom,
            panX,
            panY,
        };
    } catch {
        // leave defaults
    }

    // Progression / stat point allocations
    try {
        const savedProg = saved.progression && typeof saved.progression === 'object' ? saved.progression : null;
        const savedAlloc = savedProg && savedProg.allocated && typeof savedProg.allocated === 'object' ? savedProg.allocated : null;
        if (savedAlloc) {
            for (const k of UPGRADEABLE_STATS) {
                const raw = savedAlloc[k];
                const n = Math.floor(Number(raw));
                next.progression.allocated[k] = (Number.isFinite(n) && n >= 0) ? Math.min(9999, n) : 0;
            }
        }
    } catch { /* non-fatal */ }

    characterState = next;
    emitCharacterStateChanged('applySavedCharacterState');
}

export function computeLevelFromXp(totalXp) {
    const xp = Math.max(0, Math.floor(Number(totalXp) || 0));

    // Total XP required to reach Level L is:
    //   T(L) = 100 * (L-1) * L / 2
    // Solve for L where T(L) <= xp < T(L+1)
    const a = XP_PER_LEVEL_FACTOR;
    const scaled = xp / a;
    const approx = Math.floor((1 + Math.sqrt(1 + 8 * scaled)) / 2);
    const level = Math.max(1, approx);
    const xpAtLevelStart = Math.floor(a * (level - 1) * level / 2);
    const toNext = a * level;
    const progress = Math.max(0, xp - xpAtLevelStart);
    const percent = toNext > 0 ? Math.max(0, Math.min(1, progress / toNext)) : 0;

    return {
        total: xp,
        level,
        progress: Math.floor(progress),
        toNext: Math.floor(toNext),
        percent,
        xpAtLevelStart,
    };
}

export function getTotalStatPointsForLevel(level) {
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    return (lvl - 1) * STAT_POINTS_PER_LEVEL;
}

export function getAllocatedStatPoints(state = characterState) {
    const alloc = state?.progression?.allocated && typeof state.progression.allocated === 'object'
        ? state.progression.allocated
        : {};

    const out = {};
    let spent = 0;
    for (const k of UPGRADEABLE_STATS) {
        const n = Math.floor(Number(alloc[k] || 0));
        const safe = (Number.isFinite(n) && n > 0) ? n : 0;
        out[k] = safe;
        spent += safe;
    }
    return { allocated: out, spent };
}

export function getUnspentStatPoints(totalXp, state = characterState) {
    const lvl = computeLevelFromXp(totalXp).level;
    const total = getTotalStatPointsForLevel(lvl);
    const spent = getAllocatedStatPoints(state).spent;
    return Math.max(0, total - spent);
}

export function allocateStatPoint(statKey, totalXp, state = characterState) {
    const key = String(statKey || '').trim();
    if (!UPGRADEABLE_STATS.includes(key)) return false;

    const unspent = getUnspentStatPoints(totalXp, state);
    if (unspent <= 0) return false;

    if (!state.progression || typeof state.progression !== 'object') {
        state.progression = { allocated: {} };
    }
    if (!state.progression.allocated || typeof state.progression.allocated !== 'object') {
        state.progression.allocated = {};
    }

    const cur = Math.floor(Number(state.progression.allocated[key] || 0));
    const next = (Number.isFinite(cur) && cur >= 0) ? Math.min(9999, cur + 1) : 1;
    state.progression.allocated[key] = next;

    if (state === characterState) emitCharacterStateChanged('allocateStatPoint');
    return true;
}

export function getBagSize() {
    const cols = clampInt(characterState.bagCols, 1, 12);
    const rows = clampInt(characterState.bagRows, 1, 12);
    return { cols, rows, size: cols * rows };
}

export function setBagRows(newRows) {
    const rows = clampInt(newRows, 1, 12);
    const cols = clampInt(characterState.bagCols, 1, 12);

    const nextSize = cols * rows;
    const current = Array.isArray(characterState.bag) ? characterState.bag : [];

    const nextBag = Array.from({ length: nextSize }, (_, i) => current[i] ?? null);

    // Keep UI "new" flags sized with the bag.
    const currentUi = Array.isArray(characterState.bagUiNew) ? characterState.bagUiNew : [];
    const nextUi = Array.from({ length: nextSize }, (_, i) => !!currentUi[i]);

    characterState.bagRows = rows;
    characterState.bag = nextBag;
    characterState.bagUiNew = nextUi;
}

export function computeCharacterStats(state = characterState) {
    const stats = { ...BASE_STATS };

    // Apply stat point allocations first (treated as base progression).
    try {
        const alloc = state?.progression?.allocated && typeof state.progression.allocated === 'object'
            ? state.progression.allocated
            : {};

        const hpPts = Math.max(0, Math.floor(Number(alloc.health) || 0));
        const stamPts = Math.max(0, Math.floor(Number(alloc.stamina) || 0));
        const hitPts = Math.max(0, Math.floor(Number(alloc.hitChance) || 0));
        const critPts = Math.max(0, Math.floor(Number(alloc.critChance) || 0));
        const speedPts = Math.max(0, Math.floor(Number(alloc.attackSpeed) || 0));
        const evasionPts = Math.max(0, Math.floor(Number(alloc.evasion) || 0));

        stats.health += hpPts * (STAT_POINT_EFFECTS.health || 0);
        stats.stamina += stamPts * (STAT_POINT_EFFECTS.stamina || 0);

        stats.hitChance += hitPts * (STAT_POINT_EFFECTS.hitChance || 0);
        stats.critChance += critPts * (STAT_POINT_EFFECTS.critChance || 0);
        stats.attackSpeed += speedPts * (STAT_POINT_EFFECTS.attackSpeed || 0);
        stats.evasion += evasionPts * (STAT_POINT_EFFECTS.evasion || 0);
    } catch { /* non-fatal */ }

    const eq = state && state.equipment ? state.equipment : {};
    for (const slot of EQUIPMENT_SLOTS) {
        const itemId = eq[slot];
        if (!itemId) continue;
        const def = getItemDefinition(itemId);
        if (!def || !def.stats) continue;
        for (const [k, v] of Object.entries(def.stats)) {
            if (typeof v !== 'number') continue;
            // Support damage as either a scalar (applies to both ends) or explicit min/max keys.
            if (k === 'damage') {
                stats.damageMin = (stats.damageMin ?? 0) + v;
                stats.damageMax = (stats.damageMax ?? 0) + v;
                continue;
            }
            stats[k] = (stats[k] ?? 0) + v;
        }
    }

    // Compatibility convenience field for any legacy UI usage.
    // Prefer using damageMin/damageMax for display.
    if (typeof stats.damage !== 'number') {
        stats.damage = Math.round(((Number(stats.damageMin) || 0) + (Number(stats.damageMax) || 0)) / 2);
    }

    // Clamp percent-type stats to sensible bounds.
    stats.hitChance = Math.max(0, Math.min(100, Number(stats.hitChance ?? 0)));
    stats.critChance = Math.max(0, Math.min(100, Number(stats.critChance ?? 0)));
    stats.evasion = Math.max(0, Math.min(95, Number(stats.evasion ?? 0)));

    return stats;
}

export function computeCarryCapacity(state = characterState) {
    const total = (state?.bagCols ?? DEFAULT_BAG_COLS) * (state?.bagRows ?? DEFAULT_BAG_ROWS);
    const used = Array.isArray(state?.bag) ? state.bag.filter(x => !!x).length : 0;
    return { used, total };
}

export function countItemInBag(itemId, state = characterState) {
    if (!itemId) return 0;
    const bag = Array.isArray(state?.bag) ? state.bag : [];
    return bag.reduce((n, v) => n + (v === itemId ? 1 : 0), 0);
}

export function consumeFirstItemFromBag(itemId, state = characterState) {
    if (!itemId) return false;
    const bag = Array.isArray(state?.bag) ? state.bag : null;
    if (!bag) return false;
    const idx = bag.findIndex(v => v === itemId);
    if (idx < 0) return false;
    bag[idx] = null;
    try {
        if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[idx] = false;
    } catch { /* ignore */ }
    if (state === characterState) emitCharacterStateChanged('consumeFirstItemFromBag');
    return true;
}

export function discardBagItem(bagIndex, state = characterState) {
    const bag = Array.isArray(state?.bag) ? state.bag : null;
    if (!bag) return false;
    if (!Number.isInteger(bagIndex) || bagIndex < 0 || bagIndex >= bag.length) return false;
    if (!bag[bagIndex]) return false;
    bag[bagIndex] = null;
    try {
        if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[bagIndex] = false;
    } catch { /* ignore */ }
    if (state === characterState) emitCharacterStateChanged('discardBagItem');
    return true;
}

export function grantItemToCharacter(itemId, opts = {}, state = characterState) {
    if (!itemId) return { ok: false, placed: 'none' };
    const def = getItemDefinition(itemId);
    if (!def) return { ok: false, placed: 'none' };

    const preferEquip = opts && opts.preferEquip !== false;

    // Try to equip directly when possible (helps scripted tutorials).
    if (preferEquip && state && state.equipment) {
        const trySlots = [];
        if (def.slot === 'accessory') {
            trySlots.push('accessory_1', 'accessory_2');
        } else {
            trySlots.push(def.slot);
        }

        for (const s of trySlots) {
            const slot = normalizeEquipSlot(s);
            if (!slot) continue;

            // If a save contains an old/removed item ID, treat that slot as empty.
            // This keeps the game from getting stuck with invisible/invalid equipment.
            const currentId = state.equipment[slot];
            if (currentId) {
                const currentDef = getItemDefinition(currentId);
                if (currentDef) continue;
                state.equipment[slot] = null;
            }

            if (!canEquipItemToSlot(itemId, slot)) continue;
            state.equipment[slot] = itemId;
            if (state === characterState) {
                emitCharacterStateChanged('grantItemToCharacter');
                try {
                    window.dispatchEvent(new CustomEvent('inventory-item-added', {
                        detail: { itemId, placed: 'equip', slot }
                    }));
                } catch (e) { /* non-fatal */ }
            }
            return { ok: true, placed: 'equip', slot };
        }
    }

    // Otherwise place into first empty bag slot.
    const bag = Array.isArray(state?.bag) ? state.bag : null;
    if (!bag) return { ok: false, placed: 'none' };
    const idx = bag.findIndex(v => !v);
    if (idx < 0) return { ok: false, placed: 'none' };
    bag[idx] = itemId;
    try {
        if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[idx] = true;
    } catch { /* ignore */ }
    if (state === characterState) {
        emitCharacterStateChanged('grantItemToCharacter');
        try {
            window.dispatchEvent(new CustomEvent('inventory-item-added', {
                detail: { itemId, placed: 'bag', index: idx }
            }));
        } catch (e) { /* non-fatal */ }
    }
    return { ok: true, placed: 'bag', index: idx };
}
