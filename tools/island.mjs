// Nástroj na tvar velkého ostrova — terasy podle vzdálenosti od moře, skalní okraje a rostlinstvo.
// Píše přímo do souboru mapy a před zápisem si drží zálohu v tools/_temp/.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTerrainField } from '../src/utils/terrainField.js';
import { cellKey } from '../src/utils/gridMath.js';
import { getDecoration } from '../src/data/catalogs/decorations.js';
import { roll, valueNoise, round } from './scatter/base.mjs';

const mapArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const MAP_PATH = mapArg
  ? resolve(mapArg)
  : fileURLToPath(new URL('../src/data/maps/glade/map.json', import.meta.url));
const BACKUP_PATH = fileURLToPath(new URL('./_temp/map-before-island.json', import.meta.url));

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const COAST_BAND = 0.15;
const LOW_BAND = 0.45;
const MID_BAND = 0.7;
const LOW_HEIGHT = 1;
const MID_HEIGHT = 2.2;
const TOP_HEIGHT = 3.4;
const BAND_JITTER = 0.15;
const TOP_JITTER = 0.05;
const SAND_TOP = 0.9;
const CLIFF_STEP = 0.8;
const CLIFF_SHARE = 0.35;
const CLIFF_STYLE = 'stone';
const GRASS_CHANCE = 0.3;

const ARAUCARIA_KEYS = ['tree_araucaria_a', 'tree_araucaria_b', 'tree_araucaria_young_a', 'tree_araucaria_young_b'];
const PALM_KEYS = [
  'tree_palm_a', 'tree_palm_b', 'tree_palm_c',
  'tree_palm_curved_a', 'tree_palm_curved_b', 'tree_palm_curved_c',
];
const TREE_KEYS = new Set([...ARAUCARIA_KEYS, ...PALM_KEYS, 'tree_almond', 'tree_seagrape']);
const ROCK_KEYS = ['rock_small', 'rock_small_flat', 'rock_pair', 'rock_large', 'rock_large_c', 'rock_tall', 'rock_jagged', 'rock_pebbles'];
const SMALL_KEYS = ['bush', 'bush_small', 'mushroom_red', 'mushroom_tan'];

const BANDS = {
  top: { araucaria: 0.16, rock: 0.05, small: 0.02 },
  mid: { araucaria: 0.1, almond: 0.1, rock: 0.03, small: 0.06 },
  low: { araucaria: 0.05, almond: 0.04, rock: 0.04, small: 0.06 },
  coast: { palm: 0.06, seagrape: 0.04, rock: 0.03, small: 0.02 },
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry');
const doShape = args.has('--shape');
const doCliffs = args.has('--cliffs');
const doPlants = args.has('--plants');
if (!doShape && !doCliffs && !doPlants) {
  console.log('Použití: node tools/island.mjs --shape | --cliffs | --plants  [--dry]');
  process.exit(0);
}

const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
const level = map.waterLevel;
const liftByCell = new Map();
const floorByCell = new Map();
for (const entry of map.floor || []) {
  if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
  const key = cellKey(entry.cx, entry.cz);
  liftByCell.set(key, entry.liftY || 0);
  floorByCell.set(key, entry);
}

function neighbours(key) {
  const [cx, cz] = key.split(',').map(Number);
  return SIDES.map(([dx, dz]) => `${cx + dx},${cz + dz}`);
}

function coreCells() {
  const out = [];
  for (const [key, lift] of liftByCell) {
    if (lift <= level) continue;
    const [cx, cz] = key.split(',').map(Number);
    let solid = true;
    for (let dx = -1; dx <= 1 && solid; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (!dx && !dz) continue;
        const near = liftByCell.get(`${cx + dx},${cz + dz}`);
        if (near === undefined || near <= level) {
          solid = false;
          break;
        }
      }
    }
    if (solid) out.push(key);
  }
  return out;
}

function islandCells(core, coreSet) {
  const owner = new Map();
  const queue = [];
  let index = 0;
  for (const start of core) {
    if (owner.has(start)) continue;
    const blob = [];
    const stack = [start];
    owner.set(start, index);
    while (stack.length) {
      const key = stack.pop();
      blob.push(key);
      for (const near of neighbours(key)) {
        if (owner.has(near)) continue;
        if (!coreSet.has(near)) continue;
        owner.set(near, index);
        stack.push(near);
      }
    }
    for (const key of blob) queue.push([key, index]);
    index += 1;
  }
  for (let head = 0; head < queue.length; head += 1) {
    const [key, blob] = queue[head];
    for (const near of neighbours(key)) {
      if (owner.has(near)) continue;
      const lift = liftByCell.get(near);
      if (lift === undefined || lift <= level) continue;
      owner.set(near, blob);
      queue.push([near, blob]);
    }
  }
  const totals = new Map();
  for (const blob of owner.values()) totals.set(blob, (totals.get(blob) || 0) + 1);
  let best = -1;
  let bestCount = 0;
  for (const [blob, count] of totals) {
    if (count > bestCount) {
      bestCount = count;
      best = blob;
    }
  }
  const cells = new Set();
  for (const [key, blob] of owner) {
    if (blob === best) cells.add(key);
  }
  return cells;
}

function shoreDistance(cells) {
  const distance = new Map();
  const queue = [];
  for (const key of cells) {
    const open = neighbours(key).some((near) => !cells.has(near));
    if (!open) continue;
    distance.set(key, 0);
    queue.push(key);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head];
    const next = distance.get(key) + 1;
    for (const near of neighbours(key)) {
      if (!cells.has(near) || distance.has(near)) continue;
      distance.set(near, next);
      queue.push(near);
    }
  }
  let maxDist = 1;
  for (const value of distance.values()) maxDist = Math.max(maxDist, value);
  const share = new Map();
  for (const [key, value] of distance) share.set(key, value / maxDist);
  return share;
}

const coreList = coreCells();
const coreSet = new Set(coreList);
const island = islandCells(coreList, coreSet);
const distanceShare = shoreDistance(island);

const spawnKey = map.spawn ? cellKey(map.spawn.cx, map.spawn.cz) : null;
const islandList = [...island].sort((a, b) => a.localeCompare(b));
console.log(`Velký ostrov: ${island.size} buněk${island.has(spawnKey) ? ' (spawn je na něm)' : ''}.`);

function bandOf(share, height) {
  if (share < COAST_BAND) return 'coast';
  if (height >= TOP_HEIGHT - 0.6) return 'top';
  if (height >= MID_HEIGHT - 0.6) return 'mid';
  return 'low';
}

function terraceHeight(share, cx, cz) {
  if (share < COAST_BAND) return null;
  if (share < LOW_BAND) {
    return LOW_HEIGHT + (valueNoise(cx / 7.3 + 11, cz / 6.1 - 4) - 0.5) * 2 * BAND_JITTER;
  }
  if (share < MID_BAND) {
    return MID_HEIGHT + (valueNoise(cx / 5.9 - 7, cz / 7.7 + 3) - 0.5) * 2 * BAND_JITTER;
  }
  return TOP_HEIGHT + (valueNoise(cx / 9.1, cz / 8.3) - 0.5) * 2 * TOP_JITTER;
}

function protectedCells() {
  const safe = new Set();
  for (const entry of map.path || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    const key = cellKey(entry.cx, entry.cz);
    safe.add(key);
    for (const near of neighbours(key)) safe.add(near);
  }
  if (spawnKey) {
    safe.add(spawnKey);
    for (const near of neighbours(spawnKey)) safe.add(near);
  }
  return safe;
}

function syncLiftY() {
  const field = createTerrainField(map);
  let touched = 0;
  for (const entry of map.decorations || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    const key = cellKey(entry.cx, entry.cz);
    if (!island.has(key)) continue;
    const lift = liftByCell.get(key);
    if (lift === undefined) continue;
    if (entry.liftY === lift) continue;
    entry.liftY = round(lift, 2);
    touched += 1;
  }
  for (const entry of map.path || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    const key = cellKey(entry.cx, entry.cz);
    if (!island.has(key)) continue;
    const lift = liftByCell.get(key);
    if (lift === undefined) continue;
    if (entry.liftY === lift) continue;
    entry.liftY = round(lift, 2);
    touched += 1;
  }
  return { touched, field };
}

function save() {
  if (!existsSync(BACKUP_PATH)) copyFileSync(MAP_PATH, BACKUP_PATH);
  writeFileSync(MAP_PATH, JSON.stringify(map), 'utf8');
  console.log(`Zapsáno do mapy. Záloha: ${BACKUP_PATH}`);
}

if (doShape) {
  const safe = protectedCells();
  const counts = { coast: 0, low: 0, mid: 0, top: 0 };
  let moved = 0;
  let sand = 0;
  for (const key of island) {
    const entry = floorByCell.get(key);
    if (!entry) continue;
    const [cx, cz] = key.split(',').map(Number);
    const share = distanceShare.get(key) ?? 0;
    const height = terraceHeight(share, cx, cz);
    if (height !== null && !safe.has(key)) {
      const next = round(height, 2);
      if (Math.abs(next - (entry.liftY || 0)) >= 0.05) moved += 1;
      entry.liftY = next;
      liftByCell.set(key, next);
      if (entry.key === 'floor_sand' && next > SAND_TOP) {
        entry.key = 'floor_grass';
        sand += 1;
      }
    }
    counts[bandOf(share, liftByCell.get(key) ?? 0)] += 1;
  }
  const sync = syncLiftY();
  console.log(`Terasy — pobřeží: ${counts.coast}, nízká: ${counts.low}, střední: ${counts.mid}, vrchol: ${counts.top}.`);
  console.log(`Změněno výšek: ${moved}, písek překlopený na trávu: ${sand}, srovnáno dekorací a cesty: ${sync.touched}.`);
  if (dryRun) console.log('Zkušební běh — mapa se nezměnila.');
  else save();
}

if (doCliffs) {
  let marked = 0;
  let candidates = 0;
  for (const key of island) {
    const entry = floorByCell.get(key);
    if (!entry || entry.cliff === true) continue;
    const [cx, cz] = key.split(',').map(Number);
    const height = liftByCell.get(key) ?? 0;
    const step = neighbours(key).some((near) => {
      if (!island.has(near)) return false;
      const other = liftByCell.get(near);
      return other !== undefined && other <= height - CLIFF_STEP;
    });
    if (!step) continue;
    candidates += 1;
    if (valueNoise(cx / 5.1 + 3, cz / 4.4 - 2) < 1 - CLIFF_SHARE) continue;
    entry.cliff = true;
    entry.cliffStyle = CLIFF_STYLE;
    marked += 1;
  }
  console.log(`Skalní okraje: ${marked} z ${candidates} okrajových buněk označeno jako ostrých.`);
  if (dryRun) console.log('Zkušební běh — mapa se nezměnila.');
  else save();
}


if (doPlants) {
  const safe = protectedCells();
  map.decorations = (map.decorations || []).filter((entry) => (
    !(entry && TREE_KEYS.has(entry.key) && island.has(cellKey(entry.cx, entry.cz)))
  ));
  const taken = new Set();
  const treeCells = new Set();
  for (const entry of map.decorations) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    taken.add(cellKey(entry.cx, entry.cz));
    if (TREE_KEYS.has(entry.key)) treeCells.add(cellKey(entry.cx, entry.cz));
  }
  const added = [];
  const addedCount = {};
  const plant = (key, cx, cz) => {
    const entry = { key, cx, cz, rotation: Math.floor(roll(cx, cz, 23) * 4) };
    const offsetX = round((roll(cx, cz, 53) - 0.5) * 0.9);
    const offsetZ = round((roll(cx, cz, 67) - 0.5) * 0.9);
    if (offsetX) entry.offsetX = offsetX;
    if (offsetZ) entry.offsetZ = offsetZ;
    const lift = liftByCell.get(cellKey(cx, cz));
    if (Number.isFinite(lift)) entry.liftY = round(lift, 2);
    added.push(entry);
    addedCount[key] = (addedCount[key] || 0) + 1;
    taken.add(cellKey(cx, cz));
    if (TREE_KEYS.has(key)) treeCells.add(cellKey(cx, cz));
  };
  const pickKey = (keys, cx, cz, salt) => (
    keys[Math.min(keys.length - 1, Math.floor(roll(cx, cz, salt) * keys.length))]
  );
  const crowded = (cx, cz) => {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (treeCells.has(`${cx + dx},${cz + dz}`)) return true;
      }
    }
    return false;
  };
  for (const key of island) {
    const [cx, cz] = key.split(',').map(Number);
    if (safe.has(key) || taken.has(key)) continue;
    const share = distanceShare.get(key) ?? 0;
    const height = liftByCell.get(key) ?? 0;
    const band = share < COAST_BAND ? 'coast' : bandOf(share, height);
    const weights = BANDS[band];
    const value = roll(cx, cz, 13);
    let acc = 0;
    let chosen = null;
    const step = (chance, keys, salt) => {
      if (chosen || !chance) return;
      acc += chance;
      if (value < acc) chosen = pickKey(keys, cx, cz, salt);
    };
    step(weights.araucaria, ARAUCARIA_KEYS, 17);
    step(weights.almond, ['tree_almond'], 19);
    step(weights.palm, PALM_KEYS, 29);
    step(weights.seagrape, ['tree_seagrape'], 31);
    step(weights.rock, ROCK_KEYS, 37);
    step(weights.small, SMALL_KEYS, 41);
    if (!chosen) continue;
    if (TREE_KEYS.has(chosen) && crowded(cx, cz)) continue;
    plant(chosen, cx, cz);
  }
  const grassCells = new Set((map.grass || []).map((cell) => cellKey(cell.cx, cell.cz)));
  let grassAdded = 0;
  for (const key of island) {
    const entry = floorByCell.get(key);
    if (!entry || entry.key !== 'floor_grass') continue;
    if (grassCells.has(key) || safe.has(key)) continue;
    const [cx, cz] = key.split(',').map(Number);
    const patch = valueNoise(cx / 4.2, cz / 3.7);
    if (roll(cx, cz, 47) > GRASS_CHANCE * (0.35 + 1.3 * patch)) continue;
    map.grass.push({ cx, cz });
    grassCells.add(key);
    grassAdded += 1;
  }
  map.decorations = map.decorations.concat(added);
  const summary = Object.entries(addedCount)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  console.log(`Nová výsadba (${added.length}): ${summary || 'nic'}.`);
  console.log(`Tráva: přidáno ${grassAdded} buněk.`);
  if (dryRun) console.log('Zkušební běh — mapa se nezměnila.');
  else save();
}

