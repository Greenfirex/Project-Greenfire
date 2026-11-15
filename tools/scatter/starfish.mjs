// Hvězdice na dno — rozeseté po mělčině i hlouběji, nikdy na suchu.
// Nahradí jen svoje vlastní hvězdice, ostatní dekorace na mapě nechá být.
import { cellKey } from '../../src/utils/gridMath.js';
import {
  STARFISH_KEYS, cellEntry, deepCells, occupiedCells, openMap, pickFarthest,
  replaceOwned, saveMap,
} from './base.mjs';

const MIN_DEPTH = 0.5;
const SHALLOW_DEPTH = 2;
const MAX_DEPTH = 4;
const SHALLOW_TARGET = 50;
const DEEP_TARGET = 20;
const MIN_GAP = 2;
const SPAWN_RADIUS = 12;
const SPAWN_MAX = 6;
const SPAWN_SEED = 4;

const { map, mapPath, dryRun, level, field } = openMap();
const spawn = map.spawn || { cx: 0, cz: 0 };
const taken = occupiedCells(map, STARFISH_KEYS);
const cells = deepCells(map, field, level, taken, MIN_DEPTH)
  .filter((cell) => cell.depth <= MAX_DEPTH);
const shallow = cells.filter((cell) => cell.depth <= SHALLOW_DEPTH);
const deep = cells.filter((cell) => cell.depth > SHALLOW_DEPTH);
const picked = [];
const used = new Set();
let spawnPicked = 0;

function nearSpawn(cell) {
  return Math.hypot(cell.cx - spawn.cx, cell.cz - spawn.cz) <= SPAWN_RADIUS;
}

function add(cell) {
  picked.push(cell);
  used.add(cellKey(cell.cx, cell.cz));
  if (nearSpawn(cell)) spawnPicked += 1;
}

function fill(pool, target) {
  const skip = new Set();
  while (picked.length < target) {
    const pick = pickFarthest(pool, picked, MIN_GAP, skip);
    if (!pick) break;
    if (used.has(cellKey(pick.cx, pick.cz)) || (nearSpawn(pick) && spawnPicked >= SPAWN_MAX)) {
      skip.add(cellKey(pick.cx, pick.cz));
      continue;
    }
    add(pick);
  }
}

const seeds = shallow
  .filter((cell) => nearSpawn(cell))
  .sort((a, b) => (
    Math.hypot(a.cx - spawn.cx, a.cz - spawn.cz)
    - Math.hypot(b.cx - spawn.cx, b.cz - spawn.cz)
  ))
  .slice(0, SPAWN_SEED);
for (const cell of seeds) add(cell);

fill(shallow, SHALLOW_TARGET);
fill(deep, SHALLOW_TARGET + DEEP_TARGET);

const added = picked.map((cell) => cellEntry('starfish', cell.cx, cell.cz, cell.lift));
console.log(`Dno: ${added.length} hvězdic v hloubce ${MIN_DEPTH}–${MAX_DEPTH} m (${spawnPicked} u spawnu).`);

replaceOwned(map, STARFISH_KEYS, added);
saveMap(map, mapPath, dryRun);
