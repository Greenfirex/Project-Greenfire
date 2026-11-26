// Kameny ke sběru rukou — obyčejné kameny náhodně po celé souši a ostré kameny (pazourky) vedle balvanů; oba i po dně jeskyní.
// Výšku bere z podlahy buňky v mapě, takže sedí i v podzemních patrech. Nahradí jen svoje vlastní kameny.
import { getDecoration } from '../../src/data/catalogs/decorations.js';
import { openMap, replaceOwned, saveMap, roll, round } from './base.mjs';

const KINDS = {
  loose_stone: { nearRock: 0, anywhere: 0.04, cave: 0.15, surfaceGap: 3, caveGap: 3, salt: 100 },
  sharp_stone: { nearRock: 0.35, anywhere: 0, cave: 0.12, surfaceGap: 4, caveGap: 3, salt: 0 },
};
const OWN_KEYS = Object.keys(KINDS);
const CAVE_LEVELS = [-1, -2];
const BUILDING_CLEAR = 4;
const SAME_GROUND = 0.6;
const DRY_MARGIN = 0.2;
const OFFSET = 1.1;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const { map, mapPath, dryRun, level: sea } = openMap();
const spot = (level, cx, cz) => `${level}|${cx}|${cz}`;
const levelOf = (entry) => (Number.isFinite(entry.level) ? entry.level : 0);

const floors = new Map();
for (const entry of map.floor || []) floors.set(spot(levelOf(entry), entry.cx, entry.cz), entry);

const taken = new Set();
for (const entry of map.decorations || []) {
  if (!OWN_KEYS.includes(entry.key)) taken.add(spot(levelOf(entry), entry.cx, entry.cz));
}
for (const building of map.buildings || []) {
  for (let dx = -BUILDING_CLEAR; dx <= BUILDING_CLEAR; dx++) {
    for (let dz = -BUILDING_CLEAR; dz <= BUILDING_CLEAR; dz++) taken.add(spot(0, building.cx + dx, building.cz + dz));
  }
}
for (const link of map.connectors || []) {
  for (const end of [link.from, link.to]) if (end) taken.add(spot(end.level || 0, end.cx, end.cz));
}

const wet = new Set();
for (const river of map.rivers || []) for (const [cx, cz] of river.cells || []) wet.add(spot(0, cx, cz));
for (const lake of map.lakes || []) {
  const queue = [[lake.cx, lake.cz]];
  while (queue.length) {
    const [cx, cz] = queue.pop();
    const key = spot(0, cx, cz);
    const floor = floors.get(key);
    if (wet.has(key) || !floor || (floor.liftY || 0) >= lake.level) continue;
    wet.add(key);
    for (const [dx, dz] of SIDES) queue.push([cx + dx, cz + dz]);
  }
}

const dry = (key, floor) => floor && !taken.has(key) && !wet.has(key) && (floor.liftY || 0) >= sea + DRY_MARGIN;

const rocks = (map.decorations || []).filter((entry) => {
  const def = getDecoration(entry.key);
  return def && def.stone && levelOf(entry) === 0;
});

const added = [];
const crowded = (key, level, cx, cz, gap) => added.some((entry) => (
  entry.key === key && levelOf(entry) === level && Math.abs(entry.cx - cx) < gap && Math.abs(entry.cz - cz) < gap
));

function place(key, level, cx, cz, lift) {
  const salt = KINDS[key].salt;
  const entry = { key, cx, cz, rotation: Math.floor(roll(cx, cz, 11 + salt) * 4) };
  if (level) entry.level = level;
  if (lift) entry.liftY = lift;
  const offsetX = round((roll(cx, cz, 53 + salt) - 0.5) * OFFSET);
  const offsetZ = round((roll(cx, cz, 67 + salt) - 0.5) * OFFSET);
  if (offsetX) entry.offsetX = offsetX;
  if (offsetZ) entry.offsetZ = offsetZ;
  added.push(entry);
  taken.add(spot(level, cx, cz));
}

function nearRocks(key, kind) {
  for (const rock of rocks) {
    if (roll(rock.cx, rock.cz, 23 + kind.salt) > kind.nearRock) continue;
    const start = Math.floor(roll(rock.cx, rock.cz, 31 + kind.salt) * AROUND.length);
    for (let i = 0; i < AROUND.length; i++) {
      const [dx, dz] = AROUND[(start + i) % AROUND.length];
      const cx = rock.cx + dx;
      const cz = rock.cz + dz;
      const floor = floors.get(spot(0, cx, cz));
      if (!dry(spot(0, cx, cz), floor) || Math.abs((floor.liftY || 0) - (rock.liftY || 0)) > SAME_GROUND) continue;
      if (crowded(key, 0, cx, cz, kind.surfaceGap)) break;
      place(key, 0, cx, cz, floor.liftY || 0);
      break;
    }
  }
}

function onFloors(key, kind) {
  for (const [spotKey, floor] of floors) {
    const level = levelOf(floor);
    const cave = CAVE_LEVELS.includes(level);
    const chance = cave ? kind.cave : level === 0 ? kind.anywhere : 0;
    if (!chance || roll(floor.cx, floor.cz, 41 + level + kind.salt) > chance) continue;
    if (cave ? taken.has(spotKey) : !dry(spotKey, floor)) continue;
    if (crowded(key, level, floor.cx, floor.cz, cave ? kind.caveGap : kind.surfaceGap)) continue;
    place(key, level, floor.cx, floor.cz, floor.liftY || 0);
  }
}

for (const [key, kind] of Object.entries(KINDS)) {
  const before = added.length;
  nearRocks(key, kind);
  const byRocks = added.length - before;
  onFloors(key, kind);
  const caves = added.filter((entry) => entry.key === key && levelOf(entry) !== 0).length;
  console.log(`${getDecoration(key).displayName}: ${byRocks} u balvanů, ${added.length - before - byRocks - caves} jinde po souši, ${caves} v jeskyních.`);
}

replaceOwned(map, OWN_KEYS, added);
saveMap(map, mapPath, dryRun);
