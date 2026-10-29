// Květiny na louku — rozsype je po travnatých buňkách do shluků.
// Nahradí jen svoje květiny, ostatní dekorace na mapě nechá být.
import { cellKey } from '../../src/utils/gridMath.js';
import {
  FLOWER_KEYS, openMap, replaceOwned, saveMap, valueNoise, roll, round,
} from './base.mjs';

const FLOWER_POOL = ['flower_white', 'flower_yellow', 'flower_pink', 'flower_coral'];
const CHANCE = 0.12;
const MIN_PER_CELL = 1;
const MAX_PER_CELL = 2;
const SPREAD = 0.9;
const SCALE_MIN = 0.7;
const SCALE_MAX = 1;
const PATCH_SCALE = 3.4;

const { map, mapPath, dryRun } = openMap();

const liftByCell = new Map();
for (const entry of map.floor || []) {
  if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
  liftByCell.set(cellKey(entry.cx, entry.cz), entry.liftY || 0);
}

const added = [];
for (const cell of map.grass || []) {
  if (!cell || !Number.isFinite(cell.cx) || !Number.isFinite(cell.cz)) continue;
  const { cx, cz } = cell;
  const patch = valueNoise(cx / PATCH_SCALE, cz / PATCH_SCALE);
  if (roll(cx, cz, 37) > CHANCE * (0.25 + 1.3 * patch)) continue;
  const lift = liftByCell.get(cellKey(cx, cz)) || 0;
  const amount = MIN_PER_CELL
    + Math.floor(roll(cx, cz, 41) * (MAX_PER_CELL - MIN_PER_CELL + 1 + patch));
  for (let index = 0; index < amount; index += 1) {
    const key = FLOWER_POOL[Math.min(
      FLOWER_POOL.length - 1,
      Math.floor(roll(cx + index * 3, cz - index, 43) * FLOWER_POOL.length),
    )];
    const entry = {
      key,
      cx,
      cz,
      rotation: 0,
      scale: round(SCALE_MIN + roll(cx + index, cz + index, 47) * (SCALE_MAX - SCALE_MIN)),
      offsetX: round((roll(cx - index, cz + index * 2, 53) - 0.5) * SPREAD * 2),
      offsetZ: round((roll(cx + index * 2, cz - index, 59) - 0.5) * SPREAD * 2),
    };
    if (lift) entry.liftY = lift;
    added.push(entry);
  }
}

console.log(`Květiny: ${added.length} kusů na travnatých buňkách.`);

replaceOwned(map, FLOWER_KEYS, added);
saveMap(map, mapPath, dryRun);
