// Hejna ryb — rozsype je po pásech hloubky po celém moři.
// Počet hejn se počítá z velikosti mapy; víc hejn znamená menší minimální odstup.
import { getFishType } from '../../src/data/catalogs/fish.js';
import { openMap, waterCellCount, depthBandCells, pickFarthest, saveMap } from './base.mjs';

const BASE_PLAN = [
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
const BANDS = {
  deep: { minDepth: 1.8, maxDepth: 9, clearance: 0.7, reach: 3, maxRadius: 6 },
  mid: { minDepth: 0.6, maxDepth: 1.4, clearance: 0.45, reach: 2, maxRadius: 5 },
  shore: { minDepth: 0.45, maxDepth: 0.9, clearance: 0.35, reach: 1, maxRadius: 3 },
  shallow: { minDepth: 0.3, maxDepth: 0.6, clearance: 0.3, reach: 1, maxRadius: 2.5 },
};
const WATER_PER_SCHOOL = 170;
const MIN_SCHOOLS = 6;
const MAX_SCHOOLS = 80;
const SPACING = 1.6;

const { map, mapPath, dryRun, level, field } = openMap();
const water = waterCellCount(map, field, level);
const target = Math.max(MIN_SCHOOLS, Math.min(MAX_SCHOOLS, Math.round(water / WATER_PER_SCHOOL)));

const bandCache = new Map();
const cellsFor = (bandName, band) => {
  if (!bandCache.has(bandName)) bandCache.set(bandName, depthBandCells(map, field, level, band));
  return bandCache.get(bandName);
};

const schools = [];
for (let index = 0; index < target; index += 1) {
  let found = null;
  for (let attempt = 0; attempt < BASE_PLAN.length && !found; attempt += 1) {
    const plan = BASE_PLAN[(index + attempt) % BASE_PLAN.length];
    const band = BANDS[plan.band] || BANDS.deep;
    const cell = pickFarthest(cellsFor(plan.band, band), schools, SPACING);
    if (cell) found = { plan, band, cell };
  }
  if (!found) break;
  schools.push({
    cx: found.cell.cx,
    cz: found.cell.cz,
    kind: found.plan.kind,
    mode: found.plan.mode || 'wander',
    maxRadius: found.band.maxRadius,
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

const kinds = [...new Set(schools.map((school) => school.kind))].join(', ');
console.log(`Ryby: ${schools.length} hejn z ${target} plánovaných (${kinds}) na ${water} vodních buňkách.`);

saveMap(map, mapPath, dryRun);
