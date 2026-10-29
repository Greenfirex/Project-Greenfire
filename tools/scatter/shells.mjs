// Lastury na břeh — rozsype je po písku kolem hladiny a přidá jednu obrovskou mušli.
// Nahradí jen svoje vlastní lastury, ostatní dekorace na mapě nechá být.
import { cellKey } from '../../src/utils/gridMath.js';
import {
  SHELL_KEYS, cellEntry, shellVariant, openMap, occupiedCells, sandCandidates,
  replaceOwned, saveMap, valueNoise, roll,
} from './base.mjs';

const ABOVE_MIN = -0.5;
const ABOVE_MAX = 0.35;
const NEIGHBOUR_WATER = 0.1;
const PATCH_SCALE = 3.2;
const PATCH_MIN = 0.55;
const CELL_CHANCE = 0.6;
const GIANT_ABOVE_MIN = -0.05;
const GIANT_ABOVE_MAX = 0.35;

const { map, mapPath, dryRun, level, field } = openMap();
const taken = occupiedCells(map, SHELL_KEYS);
const candidates = sandCandidates(map, field, level, taken, {
  aboveMin: ABOVE_MIN,
  aboveMax: ABOVE_MAX,
  neighbourWater: NEIGHBOUR_WATER,
});
const added = [];
const spawn = map.spawn || { cx: 0, cz: 0 };

const giantSpot = candidates
  .filter((cell) => cell.above >= GIANT_ABOVE_MIN && cell.above <= GIANT_ABOVE_MAX)
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

const shellCount = added.filter((entry) => entry.key !== 'shell_giant').length;
const giantNote = giantSpot ? ` a 1 obrovská mušle (na buňce ${giantSpot.cx},${giantSpot.cz})` : '';
console.log(`Břeh: ${shellCount} lastur${giantNote}.`);

replaceOwned(map, SHELL_KEYS, added);
saveMap(map, mapPath, dryRun);
