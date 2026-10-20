// Recept mapy — zadání, ze kterého se mapa skládá (zóny, ruční položky, start, výšky).
// Drží kroky přípravy; hotovou mapu z něj sestaví pravidla mapy.
import { writeFileSync } from 'node:fs';
import { mapFileFromLayout, recipeMismatch } from '../src/data/catalogs/mapFile.js';
import { getMap } from '../src/data/catalogs/maps.js';
import { createRng } from '../src/utils/rng.js';

const MAP_KEY = process.argv[2] || 'glade';
const OUT = process.argv[3] || `src/data/maps/${MAP_KEY}/map.json`;

const CAMP = { cx: 0, cz: 0 };
const CAMP_CLEAR = 5;
const POND = { cx: 4, cz: 3, radius: 2 };

const map = getMap(MAP_KEY);
if (!map) throw new Error(`Neznámá mapa: ${MAP_KEY}`);

const limit = Math.floor(map.groundSize / 2) - 1;
const cells = [];
for (let cx = -limit; cx <= limit; cx++) for (let cz = -limit; cz <= limit; cz++) cells.push([cx, cz]);

const dist = (cx, cz, ox, oz) => Math.hypot(cx - ox, cz - oz);
const rim = (cx, cz) => Math.max(Math.abs(cx), Math.abs(cz)) >= limit - 1;
const edgeFactor = (cx, cz) => {
  const edge = Math.max(Math.abs(cx), Math.abs(cz));
  return Math.min(1, Math.max(0, (edge - 4) / Math.max(1, limit - 6)));
};

const rng = createRng(map.seed);
const forest = [];
const meadow = [];
const rocks = [];
const deepForest = [];
for (const [cx, cz] of cells) {
  if (rim(cx, cz)) continue;
  if (dist(cx, cz, CAMP.cx, CAMP.cz) < CAMP_CLEAR) continue;
  if (dist(cx, cz, POND.cx, POND.cz) < POND.radius + 2) continue;
  const roll = rng();
  const density = 0.24 + 0.74 * edgeFactor(cx, cz);
  if (roll < density) {
    forest.push([cx, cz]);
    if (density > 0.55) deepForest.push([cx, cz]);
  } else if (roll < density + 0.1) rocks.push([cx, cz]);
  else if (roll > 0.93) meadow.push([cx, cz]);
}

const mushrooms = [];
const stumps = [];
for (const [cx, cz] of deepForest) {
  const roll = rng();
  if (roll < 0.32) mushrooms.push([cx, cz]);
  else if (roll > 0.97) stumps.push([cx, cz]);
}

const pond = [];
for (let cx = POND.cx - POND.radius; cx <= POND.cx + POND.radius; cx++) {
  for (let cz = POND.cz - POND.radius; cz <= POND.cz + POND.radius; cz++) {
    if (dist(cx, cz, POND.cx, POND.cz) <= POND.radius) pond.push([cx, cz]);
  }
}

const trail = [];
const startCz = -limit;
const bendCz = -6;
for (let cz = startCz; cz <= bendCz; cz++) trail.push([CAMP.cx - 2, cz]);
for (let cx = CAMP.cx - 2; cx <= CAMP.cx; cx++) trail.push([cx, bendCz + 1]);
for (let cz = bendCz + 2; cz <= CAMP.cz - CAMP_CLEAR; cz++) trail.push([CAMP.cx, cz]);

const occupied = new Set();
const camp = [
  { key: 'campfire', cx: 0, cz: 0, rotation: 0 },
  { key: 'tent', cx: 2, cz: -1, rotation: 3 },
  { key: 'log_stack', cx: -2, cz: 0, rotation: 1 },
  { key: 'crate', cx: 1, cz: 2, rotation: 0 },
  { key: 'barrel', cx: -1, cz: 2, rotation: 2 },
  { key: 'stump_old', cx: -3, cz: 1, rotation: 1 },
];
for (const item of camp) occupied.add(`${item.cx},${item.cz}`);
const taken = new Set(occupied);
const passable = (list) => list.filter(([cx, cz]) => !taken.has(`${cx},${cz}`));
const takeAll = (list) => { for (const [cx, cz] of list) taken.add(`${cx},${cz}`); };

const keepTrail = passable(trail);
const keepPond = passable(pond);
takeAll(keepTrail);
takeAll(keepPond);

const keepForest = [];
const keepMushrooms = [];
const keepStumps = [];
for (const cell of passable(forest)) {
  const key = `${cell[0]},${cell[1]}`;
  if (taken.has(key)) continue;
  taken.add(key);
  keepForest.push(cell);
}
for (const source of mushrooms) {
  const index = keepForest.findIndex(([fx, fz]) => fx === source[0] && fz === source[1]);
  if (index < 0) continue;
  keepForest.splice(index, 1);
  keepMushrooms.push(source);
}
for (const source of stumps) {
  const index = keepForest.findIndex(([fx, fz]) => fx === source[0] && fz === source[1]);
  if (index < 0) continue;
  keepForest.splice(index, 1);
  keepStumps.push(source);
}
console.info(`vyber: les ${keepForest.length}, houby ${keepMushrooms.length}, parezy ${keepStumps.length}`);

const layout = {
  version: 5,
  seed: map.seed,
  spawn: { cx: 1, cz: 1 },
  zones: [
    { brush: 'trail', cells: keepTrail },
    { brush: 'water', cells: keepPond },
    { brush: 'cliff_rim', cells: [] },
    { brush: 'forest_exact', cells: keepForest },
    { brush: 'mushrooms', cells: keepMushrooms },
    { brush: 'stumps', cells: keepStumps },
    { brush: 'meadow', cells: passable(meadow) },
    { brush: 'rocks', cells: passable(rocks) },
  ],
  manual: [...camp, { key: 'ore_iron', cx: 2, cz: 1, rotation: 0 }],
  pathOverrides: [],
  waterOverrides: [],
  exclude: [],
  height: [],
};

const file = mapFileFromLayout(MAP_KEY, layout);
const mismatch = recipeMismatch(MAP_KEY, file);
if (mismatch) throw new Error(`recept nesedí na mapu: ${mismatch}`);
console.info(`sestaveno: cesty ${file.path.length}, voda ${file.water.length}, dekorace ${file.decorations.length}`);
writeFileSync(OUT, JSON.stringify(file), 'utf8');

const counts = {};
for (const [key, value] of Object.entries(file)) counts[key] = Array.isArray(value) ? value.length : typeof value;
console.info(`Zapsáno do ${OUT}: ${JSON.stringify(counts)}`);
