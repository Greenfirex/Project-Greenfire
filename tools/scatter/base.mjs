// Společný základ nástrojů, které sázejí drobnosti do souboru mapy.
// Načte mapu, spočítá terén stejným kódem jako hra a hlídá, aby se nástroje nepřekrývaly.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTerrainField } from '../../src/utils/terrainField.js';
import { DECORATION_KEYS, getDecoration } from '../../src/data/catalogs/decorations.js';
import { CELL_SIZE, cellKey } from '../../src/utils/gridMath.js';

const DEFAULT_MAP = fileURLToPath(new URL('../../src/data/maps/glade/map.json', import.meta.url));

export const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const SHELL_KEYS = [
  'shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup',
  'shell_giant', 'shore_pebbles',
];
export const CORAL_KEYS = ['coral_clump_1', 'coral_clump_2', 'coral_clump_3', 'coral_clump_4', 'coral_clump_5', 'coral_clump_6', 'coral_clump_7', 'coral_clump_8', 'coral_clump_9', 'coral_clump_10'];
export const FLOWER_KEYS = [
  'flower_white', 'flower_yellow', 'flower_pink', 'flower_coral', 'flower_purple', 'flower_red',
];
export const BUSH_KEYS = [
  'bush', 'bush_round', 'bush_bramble', 'bush_small',
  'bush_monstera', 'bush_monstera_small', 'bush_monstera_large',
];
export const OWNED_KEYS = [...SHELL_KEYS, ...CORAL_KEYS, ...FLOWER_KEYS, ...BUSH_KEYS];
export const SHELL_VARIANTS = ['shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup'];
export const CORAL_VARIANTS = ['coral_clump_1', 'coral_clump_2', 'coral_clump_3', 'coral_clump_4', 'coral_clump_5', 'coral_clump_6', 'coral_clump_7', 'coral_clump_8', 'coral_clump_9', 'coral_clump_10'];

export function hash(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * sx;
  const bottom = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * sx;
  return top + (bottom - top) * sz;
}

export function roll(cx, cz, salt) {
  return hash(cx + salt * 74.7, cz - salt * 41.3);
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function cellEntry(key, cx, cz, lift) {
  const entry = { key, cx, cz, rotation: 0 };
  if (lift) entry.liftY = Math.round(lift * 1000) / 1000;
  const offsetX = round((roll(cx, cz, 53) - 0.5) * 1.1);
  const offsetZ = round((roll(cx, cz, 67) - 0.5) * 1.1);
  if (offsetX) entry.offsetX = offsetX;
  if (offsetZ) entry.offsetZ = offsetZ;
  return entry;
}

export function shellVariant(cx, cz) {
  const value = roll(cx, cz, 29);
  if (value < 0.3) return SHELL_VARIANTS[0];
  if (value < 0.55) return SHELL_VARIANTS[1];
  if (value < 0.78) return SHELL_VARIANTS[2];
  return SHELL_VARIANTS[3];
}

export function coralVariant(seed) {
  const value = hash(seed * 1.7, seed * 0.9);
  return CORAL_VARIANTS[Math.min(CORAL_VARIANTS.length - 1, Math.floor(value * CORAL_VARIANTS.length))];
}

export function sandKeys() {
  return DECORATION_KEYS.filter((key) => {
    const def = getDecoration(key);
    return Boolean(def && def.surface && def.surface.spreads);
  });
}

export function openMap() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const mapPath = args.find((arg) => !arg.startsWith('--')) || DEFAULT_MAP;
  const map = JSON.parse(readFileSync(mapPath, 'utf8'));
  const level = map.waterLevel;
  if (!Number.isFinite(level)) {
    console.log('Mapa nemá hladinu vody — není kam sázet.');
    process.exit(0);
  }
  const field = createTerrainField(map);
  return { map, mapPath, dryRun, level, field };
}

export function occupiedCells(map, ownKeys) {
  const own = new Set(ownKeys || []);
  const taken = new Set();
  for (const part of ['path', 'clearing', 'decorations']) {
    for (const entry of map[part] || []) {
      if (!entry || own.has(entry.key)) continue;
      if (Number.isFinite(entry.cx) && Number.isFinite(entry.cz)) taken.add(cellKey(entry.cx, entry.cz));
    }
  }
  return taken;
}

export function sandCandidates(map, field, level, taken, limits) {
  const sand = new Set(sandKeys());
  const out = [];
  for (const entry of map.floor || []) {
    if (!entry || !sand.has(entry.key)) continue;
    const { cx, cz } = entry;
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
    if (taken.has(cellKey(cx, cz))) continue;
    const above = field.heightAt(cx * CELL_SIZE, cz * CELL_SIZE) - level;
    if (above < limits.aboveMin || above > limits.aboveMax) continue;
    const waterNear = SIDES.some(([dx, dz]) => (
      field.heightAt((cx + dx) * CELL_SIZE, (cz + dz) * CELL_SIZE) - level <= limits.neighbourWater
    ));
    if (!waterNear) continue;
    out.push({ cx, cz, above, lift: entry.liftY || 0 });
  }
  return out;
}

export function deepCells(map, field, level, taken, minDepth) {
  const out = [];
  for (const entry of map.floor || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    if (taken.has(cellKey(entry.cx, entry.cz))) continue;
    const depth = level - field.heightAt(entry.cx * CELL_SIZE, entry.cz * CELL_SIZE);
    if (depth < minDepth) continue;
    out.push({ cx: entry.cx, cz: entry.cz, lift: entry.liftY || 0, depth });
  }
  return out;
}

export function depthBandCells(map, field, level, band) {
  const out = [];
  for (const entry of map.floor || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    const depth = level - field.heightAt(entry.cx * CELL_SIZE, entry.cz * CELL_SIZE);
    if (depth < band.minDepth || depth > band.maxDepth) continue;
    let clear = true;
    for (let dx = -band.reach; dx <= band.reach && clear; dx += 1) {
      for (let dz = -band.reach; dz <= band.reach; dz += 1) {
        const height = field.heightAt((entry.cx + dx) * CELL_SIZE, (entry.cz + dz) * CELL_SIZE);
        if (level - height < band.clearance) {
          clear = false;
          break;
        }
      }
    }
    if (clear) out.push({ cx: entry.cx, cz: entry.cz });
  }
  return out;
}

export function waterCellCount(map, field, level) {
  let total = 0;
  for (const entry of map.floor || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    if (level - field.heightAt(entry.cx * CELL_SIZE, entry.cz * CELL_SIZE) > 0) total += 1;
  }
  return total;
}

export function pickFarthest(cells, picked, minGap = 0, skip = null) {
  let best = null;
  let bestGap = -1;
  for (const cell of cells) {
    if (skip && skip.has(cellKey(cell.cx, cell.cz))) continue;
    let gap = 0;
    if (picked.length) {
      gap = Infinity;
      for (const other of picked) {
        const distance = Math.hypot(cell.cx - other.cx, cell.cz - other.cz);
        if (distance < gap) gap = distance;
      }
    }
    if (gap > bestGap) {
      bestGap = gap;
      best = cell;
    }
  }
  if (!best) return null;
  if (picked.length && bestGap < minGap) return null;
  return best;
}

export function replaceOwned(map, keys, added) {
  const own = new Set(keys);
  const kept = (map.decorations || []).filter((entry) => entry && !own.has(entry.key));
  map.decorations = kept.concat(added);
}

export function saveMap(map, mapPath, dryRun) {
  if (dryRun) {
    console.log('Zkušební běh — soubor mapy se nezměnil.');
    return;
  }
  writeFileSync(mapPath, JSON.stringify(map), 'utf8');
  console.log(`Zapsáno do ${mapPath}`);
}