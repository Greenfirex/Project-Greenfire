import { getItemDefinition } from './definitions/items.js';

const DEFAULT_BAG_COLS = 6;
const DEFAULT_BAG_ROWS = 2;

const CONSUMABLE_STACK_MAX = 5;

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
    attackSpeed: -0.01,
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

function getBagEntryId(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && typeof entry.id === 'string') return entry.id;
    return null;
}

function getBagEntryQty(entry) {
    if (!entry) return 0;
    if (typeof entry === 'string') return 1;
    if (typeof entry === 'object' && typeof entry.id === 'string') {
        const q = Math.floor(Number(entry.qty ?? 1));
        return Number.isFinite(q) ? Math.max(1, q) : 1;
    }
    return 0;
}

function isStackableItem(itemId) {
    try {
        const def = getItemDefinition(itemId);
        return !!(def && def.stackable);
    } catch {
        return false;
    }
}

function getMaxStackQty(itemId) {
    try {
        const def = getItemDefinition(itemId);
        if (!def || !def.stackable) return 1;
        // Only cap consumables; other stackable items keep legacy large stacks.
        if (def.consumable) return CONSUMABLE_STACK_MAX;
        return 9999;
    } catch {
        return 1;
    }
}

function normalizeStackQtyForItem(itemId, qty) {
    const q = Math.floor(Number(qty ?? 1));
    if (!Number.isFinite(q)) return 1;
    const max = getMaxStackQty(itemId);
    return Math.max(1, Math.min(max, q));
}

function normalizeStackQty(qty) {
    const q = Math.floor(Number(qty ?? 1));
    if (!Number.isFinite(q)) return 1;
    return Math.max(1, Math.min(9999, q));
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

    const entry = characterState.bag[bagIndex];
    // Stacked entries (objects) are not equip-able.
    if (!entry || typeof entry !== 'string') return false;
    const itemId = entry;
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
        // Timed effects from consumables. Times are in total in-game minutes.
        buffs: {
            staminaRegen: null,
        },
        localMap: {
            // A-K / 1-9 grid coordinates (1-based)
            x: 6,
            y: 8,
            selectedX: 6,
            selectedY: 8,
            // Persistent exploration hints
            visited: { '6,8': true },
            // Fog-of-war reveal memory: tiles that have been seen at least once.
            // (Visited tiles are always considered seen.)
            seen: { '6,8': true },
            // Per-ship-tile depletion tracking (e.g., Strip Wiring). Keys are "x,y".
            wiringStrippedByTile: {},
            // Per-ship-tile depletion tracking for cafeteria scavenging (independent pools). Keys are "x,y".
            cafeteriaBottledWaterByTile: {},
            cafeteriaPackagedFoodByTile: {},
            // Legacy shared pool (kept for backward compatibility; no longer used).
            cafeteriaSuppliesByTile: {},
            // Per-tile depletion tracking for Scavenge Debris Field. Keys are "x,y".
            debrisScavengedByTile: {},
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

    // Normalize stacks on load:
    // - Consumable stacks cap at 5 per slot.
    // - Overflow is placed into later empty slots if available.
    next.bag = Array.from({ length: desiredSize }, () => null);
    const overflow = [];

    for (let i = 0; i < desiredSize; i++) {
        const v = savedBag[i] ?? null;
        if (v === null) continue;

        if (typeof v === 'string') {
            next.bag[i] = getItemDefinition(v) ? v : null;
            continue;
        }

        if (typeof v === 'object' && typeof v.id === 'string') {
            const id = v.id;
            if (!getItemDefinition(id)) continue;

            const qtyRaw = normalizeStackQty(v.qty ?? 1);
            const max = getMaxStackQty(id);
            const qtyHere = normalizeStackQtyForItem(id, qtyRaw);
            // Persist as a stack object (even if qty === 1) to preserve intent.
            next.bag[i] = { id, qty: qtyHere };

            if (isStackableItem(id) && qtyRaw > max) {
                overflow.push({ id, qty: qtyRaw - max });
            }
        }
    }

    // Place overflow into empty slots.
    for (const o of overflow) {
        let remaining = normalizeStackQty(o.qty ?? 1);
        const id = o.id;
        const max = getMaxStackQty(id);

        while (remaining > 0) {
            const idxEmpty = next.bag.findIndex(x => !x);
            if (idxEmpty < 0) break;
            const take = Math.min(remaining, max);
            next.bag[idxEmpty] = { id, qty: normalizeStackQtyForItem(id, take) };
            remaining -= take;
        }
    }

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
            if (k === 'x' || k === 'y' || k === 'selectedX' || k === 'selectedY' || k === 'visited' || k === 'seen' || k === 'zoom') continue;
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
                } else if ((k === 'cafeteriaBottledWaterByTile' || k === 'cafeteriaPackagedFoodByTile' || k === 'cafeteriaSuppliesByTile') && v && typeof v === 'object' && !Array.isArray(v)) {
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
                } else if (k === 'debrisScavengedByTile' && v && typeof v === 'object' && !Array.isArray(v)) {
                    const cleaned = {};
                    for (const [kk, vv] of Object.entries(v)) {
                        if (typeof kk !== 'string') continue;
                        const m = kk.match(/^(\d+),(\d+)$/);
                        if (!m) continue;
                        const cx = clampInt(m[1], 1, 11);
                        const cy = clampInt(m[2], 1, 9);
                        const n = Math.floor(Number(vv));
                        if (!Number.isFinite(n) || n < 0) continue;
                        cleaned[`${cx},${cy}`] = Math.min(3, n);
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

        // Seen tiles (fog-of-war memory). Stored as an object map or legacy array of coord strings.
        const seen = {};
        const acceptSeenKey = (key) => {
            if (typeof key !== 'string') return;
            const m = key.match(/^(\d+),(\d+)$/);
            if (!m) return;
            const c = clampInt(m[1], 1, 11);
            const r = clampInt(m[2], 1, 9);
            seen[`${c},${r}`] = true;
        };
        if (lm && typeof lm.seen === 'object' && lm.seen && !Array.isArray(lm.seen)) {
            for (const [k, v] of Object.entries(lm.seen)) {
                if (v !== true) continue;
                acceptSeenKey(k);
            }
        } else if (Array.isArray(lm?.seen)) {
            for (const key of lm.seen) acceptSeenKey(key);
        }
        // Visited tiles are always seen.
        for (const k of Object.keys(visited)) seen[k] = true;

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
            seen,
            zoom,
            panX,
            panY,
        };

        // Migration: older saves used a shared cafeteria supplies counter.
        // Seed both independent pools to avoid restoring extra uses.
        try {
            const legacy = next.localMap?.cafeteriaSuppliesByTile;
            if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
                if (!next.localMap.cafeteriaBottledWaterByTile || typeof next.localMap.cafeteriaBottledWaterByTile !== 'object') {
                    next.localMap.cafeteriaBottledWaterByTile = {};
                }
                if (!next.localMap.cafeteriaPackagedFoodByTile || typeof next.localMap.cafeteriaPackagedFoodByTile !== 'object') {
                    next.localMap.cafeteriaPackagedFoodByTile = {};
                }
                for (const [k, v] of Object.entries(legacy)) {
                    if (typeof k !== 'string') continue;
                    const n = Math.max(0, Math.min(7, Math.floor(Number(v))));
                    if (!Number.isFinite(n)) continue;
                    if (typeof next.localMap.cafeteriaBottledWaterByTile[k] !== 'number') next.localMap.cafeteriaBottledWaterByTile[k] = n;
                    if (typeof next.localMap.cafeteriaPackagedFoodByTile[k] !== 'number') next.localMap.cafeteriaPackagedFoodByTile[k] = n;
                }
            }
        } catch { /* ignore */ }
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

    // Timed consumable buffs
    try {
        const savedBuffs = (saved && typeof saved.buffs === 'object' && saved.buffs) ? saved.buffs : null;
        if (savedBuffs && typeof savedBuffs === 'object') {
            const sr = savedBuffs.staminaRegen && typeof savedBuffs.staminaRegen === 'object' ? savedBuffs.staminaRegen : null;
            if (sr && (typeof sr.untilMinutes !== 'undefined' || typeof sr.bonusPerSec !== 'undefined')) {
                const untilMinutes = Math.max(0, Math.floor(Number(sr.untilMinutes) || 0));
                const bonusPerSec = Math.max(0, Number(sr.bonusPerSec) || 0);
                const label = (typeof sr.label === 'string' && sr.label.length <= 80) ? sr.label : 'Stamina Regen';
                next.buffs = next.buffs && typeof next.buffs === 'object' ? next.buffs : {};
                next.buffs.staminaRegen = (bonusPerSec > 0 && untilMinutes > 0)
                    ? { untilMinutes, bonusPerSec, label }
                    : null;
            }
        }
    } catch {
        // ignore
    }

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

export function discardBagItem(bagIndex, state = characterState) {
    const bag = Array.isArray(state?.bag) ? state.bag : null;
    if (!bag) return false;
    if (!Number.isInteger(bagIndex) || bagIndex < 0 || bagIndex >= bag.length) return false;
    const entry = bag[bagIndex];
    if (!entry) return false;
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

    const amount = normalizeStackQty(opts?.amount ?? 1);

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

    const isStackable = isStackableItem(itemId);
    const maxStack = isStackable ? getMaxStackQty(itemId) : 1;

    // Stackable items: fill existing stacks (up to max per slot), then spill into new stacks.
    if (amount > 0 && isStackable && maxStack > 1) {
        const existingFree = bag.reduce((sum, entry) => {
            const id = getBagEntryId(entry);
            if (id !== itemId) return sum;
            const have = getBagEntryQty(entry);
            return sum + Math.max(0, maxStack - have);
        }, 0);
        const emptySlots = bag.reduce((n, v) => n + (v ? 0 : 1), 0);
        const totalCapacity = existingFree + (emptySlots * maxStack);
        if (totalCapacity < amount) return { ok: false, placed: 'none' };

        let remaining = amount;
        let firstIndex = null;
        let stackedAny = false;

        // Fill existing stacks first.
        for (let i = 0; i < bag.length && remaining > 0; i++) {
            const entry = bag[i];
            const id = getBagEntryId(entry);
            if (id !== itemId) continue;

            const have = getBagEntryQty(entry);
            const free = Math.max(0, maxStack - have);
            if (free <= 0) continue;

            const add = Math.min(remaining, free);
            bag[i] = { id: itemId, qty: normalizeStackQtyForItem(itemId, have + add) };
            remaining -= add;
            stackedAny = true;
            if (firstIndex === null) firstIndex = i;
            try {
                if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[i] = true;
            } catch { /* ignore */ }
        }

        // Then place new stacks.
        while (remaining > 0) {
            const idxEmpty = bag.findIndex(v => !v);
            if (idxEmpty < 0) break;
            const take = Math.min(remaining, maxStack);
            bag[idxEmpty] = { id: itemId, qty: normalizeStackQtyForItem(itemId, take) };
            remaining -= take;
            if (firstIndex === null) firstIndex = idxEmpty;
            try {
                if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[idxEmpty] = true;
            } catch { /* ignore */ }
        }

        if (state === characterState) {
            emitCharacterStateChanged('grantItemToCharacter');
            try {
                window.dispatchEvent(new CustomEvent('inventory-item-added', {
                    detail: { itemId, amount, placed: 'bag', index: firstIndex ?? 0, stacked: stackedAny, split: true }
                }));
            } catch (e) { /* non-fatal */ }
        }
        return { ok: true, placed: 'bag', index: firstIndex ?? 0, stacked: stackedAny, split: true };
    }

    // Stack into an existing slot for stackable items (legacy: non-consumable stacks remain large).
    try {
        if (amount > 0 && isStackable) {
            const idxStack = bag.findIndex(v => getBagEntryId(v) === itemId);
            if (idxStack >= 0) {
                const prev = bag[idxStack];
                const prevQty = getBagEntryQty(prev);
                bag[idxStack] = { id: itemId, qty: normalizeStackQtyForItem(itemId, prevQty + amount) };
                try {
                    if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[idxStack] = true;
                } catch { /* ignore */ }
                if (state === characterState) {
                    emitCharacterStateChanged('grantItemToCharacter');
                    try {
                        window.dispatchEvent(new CustomEvent('inventory-item-added', {
                            detail: { itemId, amount, placed: 'bag', index: idxStack, stacked: true }
                        }));
                    } catch (e) { /* non-fatal */ }
                }
                return { ok: true, placed: 'bag', index: idxStack, stacked: true };
            }
        }
    } catch { /* ignore */ }

    const idx = bag.findIndex(v => !v);
    if (idx < 0) return { ok: false, placed: 'none' };
    // For stackable items, represent as an object so quantity is persisted and visible.
    bag[idx] = isStackable ? { id: itemId, qty: normalizeStackQtyForItem(itemId, amount) } : itemId;
    try {
        if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[idx] = true;
    } catch { /* ignore */ }
    if (state === characterState) {
        emitCharacterStateChanged('grantItemToCharacter');
        try {
            window.dispatchEvent(new CustomEvent('inventory-item-added', {
                detail: { itemId, amount, placed: 'bag', index: idx }
            }));
        } catch (e) { /* non-fatal */ }
    }
    return { ok: true, placed: 'bag', index: idx };
}

export function countItemInBag(itemId, state = characterState) {
    if (!itemId) return 0;
    const bag = Array.isArray(state?.bag) ? state.bag : [];
    return bag.reduce((n, entry) => {
        const id = getBagEntryId(entry);
        if (id !== itemId) return n;
        return n + getBagEntryQty(entry);
    }, 0);
}

export function consumeItemQuantityFromBag(itemId, amount = 1, state = characterState) {
    if (!itemId) return false;
    const bag = Array.isArray(state?.bag) ? state.bag : null;
    if (!bag) return false;
    const need = Math.max(1, Math.floor(Number(amount) || 1));

    let remaining = need;

    // Consume from stacks first.
    for (let i = 0; i < bag.length && remaining > 0; i++) {
        const entry = bag[i];
        const id = getBagEntryId(entry);
        if (id !== itemId) continue;
        if (typeof entry !== 'object') continue;
        const haveQty = getBagEntryQty(entry);
        const take = Math.min(haveQty, remaining);
        const nextQty = haveQty - take;
        remaining -= take;
        if (nextQty <= 0) {
            bag[i] = null;
            try { if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[i] = false; } catch { /* ignore */ }
        } else {
            bag[i] = { id: itemId, qty: normalizeStackQtyForItem(itemId, nextQty) };
        }
    }

    // Then consume individual instances.
    for (let i = 0; i < bag.length && remaining > 0; i++) {
        const entry = bag[i];
        const id = getBagEntryId(entry);
        if (id !== itemId) continue;
        if (typeof entry === 'object') continue;
        bag[i] = null;
        remaining -= 1;
        try { if (state && Array.isArray(state.bagUiNew)) state.bagUiNew[i] = false; } catch { /* ignore */ }
    }

    const ok = remaining <= 0;
    if (ok && state === characterState) emitCharacterStateChanged('consumeItemQuantityFromBag');
    return ok;
}

// Backward-compatible helper used by legacy codepaths.
export function consumeFirstItemFromBag(itemId, state = characterState) {
    return consumeItemQuantityFromBag(itemId, 1, state);
}
