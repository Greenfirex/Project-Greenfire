// Keře na travnaté buňky — hustý pás podél břehů a řidší vnitrozemí.
// Pod stromem keř klidně růst může, ostatní dekorace nechává být.
import { CELL_SIZE, cellKey } from '../../src/utils/gridMath.js';
import { getDecoration } from '../../src/data/catalogs/decorations.js';
import {
  BUSH_KEYS, openMap, replaceOwned, saveMap, sandKeys, valueNoise, roll, round,
} from './base.mjs';

const SPECIES = ['bush', 'bush_round', 'bush_dense', 'bush_wide', 'bush_bramble', 'bush_small'];
const SHORE_SPECIES = ['bush', 'bush_round'];
const SHORE_WEIGHT = 0.7;
const SHORE_REACH = 2;
const SHORE_CHANCE = 0.85;
const SHORE_PATCH = 4;
const SHORE_MIN = 2;
const SHORE_MAX = 4;
const SHORE_SPREAD = 0.8;
const SHORE_SCALE_MIN = 0.8;
const SHORE_SCALE_MAX = 1.3;
const CHANCE = 0.16;
const SPECIES_PATCH = 7;
const PATCH_SCALE = 3.1;
const SCALE_MIN = 0.7;
const SCALE_MAX = 1.3;
const SPREAD = 0.65;
const DRY_MARGIN = 0.25;
const AMOUNT_MAX = 4;

function mix(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function ground(cx, cz) {
  return field.heightAt(cx * CELL_SIZE, cz * CELL_SIZE) - level;
}

const { map, mapPath, dryRun, field, level } = openMap();

const sand = new Set(sandKeys());
const liftByCell = new Map();
const sandCells = new Set();
const grassCells = [];
for (const entry of map.floor || []) {
  if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
  const key = cellKey(entry.cx, entry.cz);
  liftByCell.set(key, entry.liftY || 0);
  if (sand.has(entry.key)) sandCells.add(key);
  else grassCells.push(entry);
}

const taken = new Set();
for (const part of ['path', 'clearing', 'decorations']) {
  for (const entry of map[part] || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    if (BUSH_KEYS.includes(entry.key)) continue;
    const def = part === 'decorations' ? getDecoration(entry.key) : null;
    if (def && def.tree) continue;
    taken.add(cellKey(entry.cx, entry.cz));
  }
}

function nearSand(cx, cz, reach) {
  for (let dx = -reach; dx <= reach; dx += 1) {
    for (let dz = -reach; dz <= reach; dz += 1) {
      if (sandCells.has(cellKey(cx + dx, cz + dz))) return true;
    }
  }
  return false;
}

function shoreSpecies(cx, cz) {
  const patchX = Math.floor(cx / SHORE_PATCH + valueNoise(cx / 2.6, cz / 2.6) * 0.8);
  const patchZ = Math.floor(cz / SHORE_PATCH + valueNoise(cx / 2.2 + 4, cz / 2.2 - 2) * 0.8);
  const value = roll(patchX * 13.7, patchZ * 19.3, 97);
  if (value < SHORE_WEIGHT) return SHORE_SPECIES[value < SHORE_WEIGHT / 2 ? 0 : 1];
  const rest = SPECIES.slice(SHORE_SPECIES.length);
  return rest[Math.min(rest.length - 1, Math.floor(roll(patchX * 7.1, patchZ * 5.9, 101) * rest.length))];
}

function inlandSpecies(cx, cz) {
  const patchX = Math.floor(cx / SPECIES_PATCH + valueNoise(cx / 3.1, cz / 3.1) * 0.85);
  const patchZ = Math.floor(cz / SPECIES_PATCH + valueNoise(cx / 2.7 + 5, cz / 2.7 - 3) * 0.85);
  return SPECIES[Math.min(SPECIES.length - 1, Math.floor(roll(patchX * 17.3, patchZ * 11.7, 91) * SPECIES.length))];
}

function pushClump(added, cx, cz, variant, amount, spread, scaleMin, scaleMax) {
  const lift = liftByCell.get(cellKey(cx, cz));
  for (let index = 0; index < amount; index += 1) {
    const seed = cx * 37 + cz * 11 + index * 5;
    const entry = {
      key: variant,
      cx,
      cz,
      rotation: Math.floor(roll(seed, seed + 4, 89) * 4),
      scale: round(scaleMin + roll(seed, seed + 1, 71) * (scaleMax - scaleMin)),
      offsetX: round((roll(seed, seed + 2, 73) - 0.5) * spread * 2),
      offsetZ: round((roll(seed, seed + 3, 79) - 0.5) * spread * 2),
    };
    if (lift) entry.liftY = lift;
    added.push(entry);
  }
}

const added = [];
const shoreUsed = new Set();

for (const cell of grassCells) {
  const { cx, cz } = cell;
  const key = cellKey(cx, cz);
  if (taken.has(key) || shoreUsed.has(key)) continue;
  if (!nearSand(cx, cz, SHORE_REACH)) continue;
  if (ground(cx, cz) < DRY_MARGIN) continue;
  if (roll(cx, cz, 43) > SHORE_CHANCE) continue;
  const amount = SHORE_MIN + Math.floor(mix(cx * 19 + 5, cz * 23 + 11) * (SHORE_MAX - SHORE_MIN + 1));
  pushClump(added, cx, cz, shoreSpecies(cx, cz), amount, SHORE_SPREAD, SHORE_SCALE_MIN, SHORE_SCALE_MAX);
  shoreUsed.add(key);
}

const shoreCount = added.length;

for (const cell of map.grass || []) {
  if (!cell || !Number.isFinite(cell.cx) || !Number.isFinite(cell.cz)) continue;
  const { cx, cz } = cell;
  const key = cellKey(cx, cz);
  if (taken.has(key) || shoreUsed.has(key)) continue;
  const patch = valueNoise(cx / PATCH_SCALE, cz / PATCH_SCALE);
  if (roll(cx, cz, 61) > CHANCE * (0.25 + 1.5 * patch)) continue;
  if (ground(cx, cz) < DRY_MARGIN) continue;
  const amount = Math.min(AMOUNT_MAX, 1 + Math.floor(mix(cx * 31 + 7, cz * 17 + 3) * 3.4));
  pushClump(added, cx, cz, inlandSpecies(cx, cz), amount, SPREAD, SCALE_MIN, SCALE_MAX);
}

console.log(`Keře: ${shoreCount} kusů v pobřežním pásu, ${added.length - shoreCount} ve vnitrozemí, celkem ${added.length}.`);

replaceOwned(map, BUSH_KEYS, added);
saveMap(map, mapPath, dryRun);
