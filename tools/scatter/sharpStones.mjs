// Ostré kameny (pazourky) — rozhodí je vedle kamenů a balvanů na povrchu a po dně jeskyní.
// Výšku bere z podlahy buňky v mapě, takže sedí i v podzemních patrech. Nahradí jen svoje vlastní kameny.
import { getDecoration } from '../../src/data/catalogs/decorations.js';
import { openMap, replaceOwned, saveMap, roll, round } from './base.mjs';

const OWN_KEYS = ['sharp_stone'];
const CAVE_LEVELS = [-1, -2];
const ROCK_CHANCE = 0.35;
const CAVE_CHANCE = 0.12;
const SURFACE_GAP = 4;
const CAVE_GAP = 3;
const SAME_GROUND = 0.6;
const DRY_MARGIN = 0.3;
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

const added = [];
const crowded = (level, cx, cz, gap) => added.some((entry) => (
  levelOf(entry) === level && Math.abs(entry.cx - cx) < gap && Math.abs(entry.cz - cz) < gap
));

function place(level, cx, cz, lift) {
  const entry = { key: OWN_KEYS[0], cx, cz, rotation: Math.floor(roll(cx, cz, 11) * 4) };
  if (level) entry.level = level;
  if (lift) entry.liftY = lift;
  const offsetX = round((roll(cx, cz, 53) - 0.5) * OFFSET);
  const offsetZ = round((roll(cx, cz, 67) - 0.5) * OFFSET);
  if (offsetX) entry.offsetX = offsetX;
  if (offsetZ) entry.offsetZ = offsetZ;
  added.push(entry);
  taken.add(spot(level, cx, cz));
}

const rocks = (map.decorations || []).filter((entry) => {
  const def = getDecoration(entry.key);
  return def && def.stone && levelOf(entry) === 0;
});
for (const rock of rocks) {
  if (roll(rock.cx, rock.cz, 23) > ROCK_CHANCE) continue;
  const start = Math.floor(roll(rock.cx, rock.cz, 31) * AROUND.length);
  for (let i = 0; i < AROUND.length; i++) {
    const [dx, dz] = AROUND[(start + i) % AROUND.length];
    const cx = rock.cx + dx;
    const cz = rock.cz + dz;
    const key = spot(0, cx, cz);
    const floor = floors.get(key);
    if (!floor || taken.has(key) || wet.has(key)) continue;
    const lift = floor.liftY || 0;
    if (lift < sea + DRY_MARGIN || Math.abs(lift - (rock.liftY || 0)) > SAME_GROUND) continue;
    if (crowded(0, cx, cz, SURFACE_GAP)) break;
    place(0, cx, cz, lift);
    break;
  }
}
const surface = added.length;

for (const [key, floor] of floors) {
  const level = levelOf(floor);
  if (!CAVE_LEVELS.includes(level) || taken.has(key)) continue;
  if (roll(floor.cx, floor.cz, 41 + level) > CAVE_CHANCE) continue;
  if (crowded(level, floor.cx, floor.cz, CAVE_GAP)) continue;
  place(level, floor.cx, floor.cz, floor.liftY || 0);
}

console.log(`Kamenů a balvanů na povrchu: ${rocks.length}. Ostré kameny: ${surface} u kamenů, ${added.length - surface} v jeskyních.`);
replaceOwned(map, OWN_KEYS, added);
saveMap(map, mapPath, dryRun);
