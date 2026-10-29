// Lastury na břeh a koraly v hloubce — doplní je do souboru mapy.
// Výšky počítá stejným kódem jako hra, takže vše sedí na skutečný terén.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTerrainField } from '../src/utils/terrainField.js';
import { DECORATION_KEYS, getDecoration } from '../src/data/catalogs/decorations.js';
import { getFishType } from '../src/data/catalogs/fish.js';
import { CELL_SIZE, cellKey } from '../src/utils/gridMath.js';

const DEFAULT_MAP = fileURLToPath(new URL('../src/data/maps/glade/map.json', import.meta.url));
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ABOVE_MIN = -0.5;
const ABOVE_MAX = 0.35;
const NEIGHBOUR_WATER = 0.1;
const PATCH_SCALE = 3.2;
const PATCH_MIN = 0.55;
const CELL_CHANCE = 0.6;
const GIANT_ABOVE_MIN = -0.05;
const GIANT_ABOVE_MAX = 0.35;
const CORAL_DEPTH = 2;
const CORAL_CLUSTERS = 4;
const CORAL_CLUSTER_CELLS = 4;
const CORAL_PER_CELL_MIN = 8;
const CORAL_PER_CELL_MAX = 14;
const CORAL_SPREAD = 0.85;
const CORAL_SCALE_MIN = 0.45;
const CORAL_SCALE_MAX = 0.75;
const FISH_PLAN = [
  { kind: 'fish_micro', band: 'shallow', mode: 'wander' },
  { kind: 'fish_micro', band: 'shallow', mode: 'wander' },
  { kind: 'fish_micro', band: 'shore', mode: 'orbit' },
  { kind: 'fish_micro', band: 'shore', mode: 'wander' },
  { kind: 'fish_gold', band: 'mid', mode: 'wander' },
  { kind: 'fish_gold', band: 'mid', mode: 'wander' },
  { kind: 'fish_green', band: 'mid', mode: 'wander' },
  { kind: 'fish_green', band: 'mid', mode: 'wander' },
  { kind: 'fish_red', band: 'mid', mode: 'wander' },
  { kind: 'fish_red', band: 'mid', mode: 'wander' },
  { kind: 'fish_blue', band: 'mid', mode: 'wander' },
  { kind: 'fish_blue', band: 'deep', mode: 'orbit' },
  { kind: 'fish_blue', band: 'deep', mode: 'wander' },
  { kind: 'fish_blue', band: 'deep', mode: 'wander' },
];
const FISH_BANDS = {
  deep: { minDepth: 1.8, maxDepth: 9, clearance: 0.7, reach: 3, maxRadius: 6 },
  mid: { minDepth: 0.6, maxDepth: 1.4, clearance: 0.45, reach: 2, maxRadius: 5 },
  shore: { minDepth: 0.45, maxDepth: 0.9, clearance: 0.35, reach: 1, maxRadius: 3 },
  shallow: { minDepth: 0.3, maxDepth: 0.6, clearance: 0.3, reach: 1, maxRadius: 2.5 },
};
const FISH_SPACING = 2.5;
const SHORE_KEYS = [
  'shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup',
  'shell_giant', 'shore_pebbles', 'coral_fan', 'coral_branch', 'coral_brain',
];
const SHELL_VARIANTS = ['shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup'];
const CORAL_VARIANTS = ['coral_fan', 'coral_branch', 'coral_brain'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const mapPath = args.find((arg) => !arg.startsWith('--')) || DEFAULT_MAP;

const sandKeys = DECORATION_KEYS.filter((key) => {
  const def = getDecoration(key);
  return Boolean(def && def.surface && def.surface.spreads);
});

function hash(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x, z) {
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

function roll(cx, cz, salt) {
  return hash(cx + salt * 74.7, cz - salt * 41.3);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function cellEntry(key, cx, cz, lift) {
  const entry = { key, cx, cz, rotation: 0 };
  if (lift) entry.liftY = Math.round(lift * 1000) / 1000;
  const offsetX = round((roll(cx, cz, 53) - 0.5) * 1.1);
  const offsetZ = round((roll(cx, cz, 67) - 0.5) * 1.1);
  if (offsetX) entry.offsetX = offsetX;
  if (offsetZ) entry.offsetZ = offsetZ;
  return entry;
}

function shellVariant(cx, cz) {
  const value = roll(cx, cz, 29);
  if (value < 0.3) return SHELL_VARIANTS[0];
  if (value < 0.55) return SHELL_VARIANTS[1];
  if (value < 0.78) return SHELL_VARIANTS[2];
  return SHELL_VARIANTS[3];
}

function coralVariant(seed) {
  const value = hash(seed * 1.7, seed * 0.9);
  return CORAL_VARIANTS[Math.min(CORAL_VARIANTS.length - 1, Math.floor(value * CORAL_VARIANTS.length))];
}

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const level = map.waterLevel;
if (!Number.isFinite(level)) {
  console.log('Mapa nemá hladinu vody — není kam sázet.');
  process.exit(0);
}

const field = createTerrainField(map);
const taken = new Set();
for (const part of ['path', 'clearing', 'decorations']) {
  for (const entry of map[part] || []) {
    if (!entry || SHORE_KEYS.includes(entry.key)) continue;
    if (Number.isFinite(entry.cx) && Number.isFinite(entry.cz)) taken.add(cellKey(entry.cx, entry.cz));
  }
}

const spawn = map.spawn || { cx: 0, cz: 0 };
const added = [];
const candidates = [];

for (const entry of map.floor || []) {
  if (!entry || !sandKeys.includes(entry.key)) continue;
  const { cx, cz } = entry;
  if (taken.has(cellKey(cx, cz))) continue;
  const above = field.heightAt(cx * CELL_SIZE, cz * CELL_SIZE) - level;
  if (above < ABOVE_MIN || above > ABOVE_MAX) continue;
  const waterNear = SIDES.some(([dx, dz]) => (
    field.heightAt((cx + dx) * CELL_SIZE, (cz + dz) * CELL_SIZE) - level <= NEIGHBOUR_WATER
  ));
  if (!waterNear) continue;
  candidates.push({ cx, cz, above, lift: entry.liftY || 0 });
}

const giantSpot = candidates
  .filter((cell) => cell.above >= GIANT_ABOVE_MIN && cell.above <= GIANT_ABOVE_MAX)
  .filter((cell) => !taken.has(cellKey(cell.cx, cell.cz)))
  .sort((a, b) => (
    Math.hypot(a.cx - spawn.cx, a.cz - spawn.cz) - Math.hypot(b.cx - spawn.cx, b.cz - spawn.cz)
  ))[0] || null;

if (giantSpot) {
  added.push(cellEntry('shell_giant', giantSpot.cx, giantSpot.cz, giantSpot.lift));
  taken.add(cellKey(giantSpot.cx, giantSpot.cz));
}

const spots = [];
for (const cell of candidates) {
  if (taken.has(cellKey(cell.cx, cell.cz))) continue;
  if (valueNoise(cell.cx / PATCH_SCALE, cell.cz / PATCH_SCALE) < PATCH_MIN) continue;
  if (roll(cell.cx, cell.cz, 17) > CELL_CHANCE) continue;
  spots.push(cell);
}

for (const spot of spots) {
  const crowded = added.some((entry) => (
    Math.abs(entry.cx - spot.cx) <= 1 && Math.abs(entry.cz - spot.cz) <= 1
  ));
  if (crowded) continue;
  added.push(cellEntry(shellVariant(spot.cx, spot.cz), spot.cx, spot.cz, spot.lift));
  taken.add(cellKey(spot.cx, spot.cz));
}


const deepCells = [];
for (const entry of map.floor || []) {
  if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
  if (taken.has(cellKey(entry.cx, entry.cz))) continue;
  const depth = level - field.heightAt(entry.cx * CELL_SIZE, entry.cz * CELL_SIZE);
  if (depth < CORAL_DEPTH) continue;
  deepCells.push({ cx: entry.cx, cz: entry.cz, lift: entry.liftY || 0, depth });
}

const centers = [];
while (centers.length < CORAL_CLUSTERS && centers.length < deepCells.length) {
  let best = null;
  let bestGap = -1;
  for (const cell of deepCells) {
    if (centers.includes(cell)) continue;
    const gap = centers.length
      ? Math.min(...centers.map((center) => Math.hypot(cell.cx - center.cx, cell.cz - center.cz)))
      : 0;
    if (gap > bestGap) {
      bestGap = gap;
      best = cell;
    }
  }
  if (!best) break;
  centers.push(best);
}

const usedCells = new Set();
const coralCells = [];
for (const center of centers) {
  const near = deepCells
    .filter((cell) => !usedCells.has(cellKey(cell.cx, cell.cz)))
    .sort((a, b) => (
      Math.hypot(a.cx - center.cx, a.cz - center.cz) - Math.hypot(b.cx - center.cx, b.cz - center.cz)
    ))
    .slice(0, CORAL_CLUSTER_CELLS);
  for (const cell of near) {
    usedCells.add(cellKey(cell.cx, cell.cz));
    coralCells.push(cell);
  }
}

for (const cell of coralCells) {
  const amount = CORAL_PER_CELL_MIN
    + Math.floor(roll(cell.cx, cell.cz, 101) * (CORAL_PER_CELL_MAX - CORAL_PER_CELL_MIN + 1));
  for (let index = 0; index < amount; index += 1) {
    const seed = cell.cx * 131 + cell.cz * 17 + index * 7;
    const entry = { key: coralVariant(seed), cx: cell.cx, cz: cell.cz, rotation: 0 };
    if (cell.lift) entry.liftY = Math.round(cell.lift * 1000) / 1000;
    const offsetX = round((hash(seed, index + 1) - 0.5) * CORAL_SPREAD * 2);
    const offsetZ = round((hash(seed + 5, index + 9) - 0.5) * CORAL_SPREAD * 2);
    if (offsetX) entry.offsetX = offsetX;
    if (offsetZ) entry.offsetZ = offsetZ;
    entry.scale = round(CORAL_SCALE_MIN + hash(seed + 11, index + 3) * (CORAL_SCALE_MAX - CORAL_SCALE_MIN));
    added.push(entry);
  }
}

function schoolCellsFor(band) {
  const cells = [];
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
    if (clear) cells.push({ cx: entry.cx, cz: entry.cz });
  }
  return cells;
}

const schools = [];
for (const plan of FISH_PLAN) {
  const band = FISH_BANDS[plan.band] || FISH_BANDS.deep;
  const cells = schoolCellsFor(band);
  let best = null;
  let bestGap = -1;
  for (const cell of cells) {
    if (schools.some((school) => school.cx === cell.cx && school.cz === cell.cz)) continue;
    const gap = schools.length
      ? Math.min(...schools.map((school) => Math.hypot(cell.cx - school.cx, cell.cz - school.cz)))
      : 0;
    if (gap > bestGap) {
      bestGap = gap;
      best = cell;
    }
  }
  if (!best) continue;
  if (schools.length && bestGap < FISH_SPACING) continue;
  schools.push({
    cx: best.cx,
    cz: best.cz,
    kind: plan.kind,
    mode: plan.mode || 'wander',
    maxRadius: band.maxRadius,
  });
}

map.fish = schools.map((school) => {
  const type = getFishType(school.kind);
  return {
    cx: school.cx,
    cz: school.cz,
    radius: Math.min(type.radius, school.maxRadius),
    count: type.count,
    kind: school.kind,
    mode: school.mode,
  };
});

const count = (key) => added.filter((entry) => entry.key === key).length;
const shellCount = count('shore_shells') + count('shore_shells_mid')
  + count('shore_shells_wide') + count('shore_shells_cup');
const coralCount = count('coral_fan') + count('coral_branch') + count('coral_brain');
console.log(`Břeh: ${shellCount} lastur a ${count('shell_giant')} obrovská mušle.`);
console.log(`Dno: ${coralCount} koralů ve ${centers.length} shlucích na ${coralCells.length} buňkách.`);
console.log(`Ryby: ${schools.length} hejn (${schools.map((school) => school.kind).join(', ')}).`);
if (giantSpot) console.log(`Obrovská mušle je na buňce ${giantSpot.cx},${giantSpot.cz}.`);

if (dryRun) {
  console.log('Zkušební běh — soubor mapy se nezměnil.');
  process.exit(0);
}

const kept = (map.decorations || []).filter((entry) => entry && !SHORE_KEYS.includes(entry.key));
map.decorations = kept.concat(added);
writeFileSync(mapPath, JSON.stringify(map), 'utf8');
console.log(`Zapsáno do ${mapPath}`);

