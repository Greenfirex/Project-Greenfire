import { getItemDefinition } from './definitions/items.js';

const DEFAULT_BAG_COLS = 6;
const DEFAULT_BAG_ROWS = 2;

const EQUIPMENT_SLOTS = [
    'head',
    'chest',
    'legs',
    'weapon',
    'offhand',
    'accessory_1',
    'accessory_2'
];

const BASE_STATS = {
    health: 100,
    stamina: 100,
    damageMin: 1,
    damageMax: 2,
    attackSpeed: 1.0,
    // Percent chance for an attack to land. Used by combat.
    hitChance: 80,
    armor: 0,
    critChance: 5,
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
    // Starter consumable for combat prototype.
    if (bag.length > 0) bag[0] = 'stimpack';

    // Starter loadout: equipped by default.
    const equipment = {
        head: 'basic_helmet',
        chest: 'field_armor',
        legs: 'utility_legs',
        weapon: null,
        offhand: null,
        accessory_1: null,
        accessory_2: null,
    };

    return {
        version: 1,
        bagCols,
        bagRows,
        bag,
        equipment,
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

    characterState = next;
    emitCharacterStateChanged('applySavedCharacterState');
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

    characterState.bagRows = rows;
    characterState.bag = nextBag;
}

export function computeCharacterStats(state = characterState) {
    const stats = { ...BASE_STATS };

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
    if (state === characterState) emitCharacterStateChanged('consumeFirstItemFromBag');
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
            if (state === characterState) emitCharacterStateChanged('grantItemToCharacter');
            return { ok: true, placed: 'equip', slot };
        }
    }

    // Otherwise place into first empty bag slot.
    const bag = Array.isArray(state?.bag) ? state.bag : null;
    if (!bag) return { ok: false, placed: 'none' };
    const idx = bag.findIndex(v => !v);
    if (idx < 0) return { ok: false, placed: 'none' };
    bag[idx] = itemId;
    if (state === characterState) emitCharacterStateChanged('grantItemToCharacter');
    return { ok: true, placed: 'bag', index: idx };
}
