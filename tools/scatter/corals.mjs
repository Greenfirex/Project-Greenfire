// Korály na dno — shluky rozeseté co nejdál od sebe po celém dně kolem ostrova.
// Počet shluků se počítá z velikosti mapy, aby hustota zůstala stejná i po zvětšení.
import { cellKey } from '../../src/utils/gridMath.js';
import {
  CORAL_KEYS, coralVariant, openMap, occupiedCells, deepCells, waterCellCount,
  pickFarthest, replaceOwned, saveMap, hash,
} from './base.mjs';

const CORAL_DEPTH = 2;
const WATER_PER_CLUSTER = 450;
const CLUSTER_CELLS = 4;
const MIN_CLUSTERS = 4;
const MAX_CLUSTERS = 40;

const { map, mapPath, dryRun, level, field } = openMap();
const taken = occupiedCells(map, CORAL_KEYS);
const water = waterCellCount(map, field, level);
const clusterTarget = Math.max(
  MIN_CLUSTERS,
  Math.min(MAX_CLUSTERS, Math.round(water / WATER_PER_CLUSTER)),
);

const bottom = deepCells(map, field, level, taken, CORAL_DEPTH);
const centers = [];
const centerKeys = new Set();
while (centers.length < clusterTarget) {
  const pick = pickFarthest(bottom, centers, 0, centerKeys);
  if (!pick) break;
  centers.push(pick);
  centerKeys.add(cellKey(pick.cx, pick.cz));
}

const usedCells = new Set();
const coralCells = [];
for (const center of centers) {
  const near = bottom
    .filter((cell) => !usedCells.has(cellKey(cell.cx, cell.cz)))
    .sort((a, b) => (
      Math.hypot(a.cx - center.cx, a.cz - center.cz) - Math.hypot(b.cx - center.cx, b.cz - center.cz)
    ))
    .slice(0, CLUSTER_CELLS);
  for (const cell of near) {
    usedCells.add(cellKey(cell.cx, cell.cz));
    coralCells.push(cell);
  }
}

const added = [];
for (const cell of coralCells) {
  const seed = cell.cx * 131 + cell.cz * 17;
  const entry = { key: coralVariant(seed), cx: cell.cx, cz: cell.cz, rotation: Math.floor(hash(seed, 3) * 4) };
  if (cell.lift) entry.liftY = Math.round(cell.lift * 1000) / 1000;
  added.push(entry);
}

console.log(`Dno: ${added.length} shluků korálů na ${coralCells.length} buňkách (z ${water} vodních buněk).`);

replaceOwned(map, CORAL_KEYS, added);
saveMap(map, mapPath, dryRun);