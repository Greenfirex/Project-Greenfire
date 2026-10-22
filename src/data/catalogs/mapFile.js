// Sestaví soubor mapy z toho, co je v editoru — hotové dlaždice a objekty bez dopočítávání.
import { getMap } from './maps.js';
import { getDecoration } from './decorations.js';

export function isMapFile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return ['floor', 'path', 'water', 'decorations'].every((name) => Array.isArray(body[name]));
}

export function layoutFromMapFile(file, fallbackSeed = 1) {
  const world = file || {};
  return {
    spawn: world.spawn && Number.isFinite(world.spawn.cx) ? { cx: world.spawn.cx, cz: world.spawn.cz } : { cx: 0, cz: 0 },
    seed: Number.isFinite(world.seed) ? world.seed : fallbackSeed,
    entries: [
      ...(world.floor || []),
      ...(world.path || []),
      ...(world.water || []),
      ...(world.decorations || []),
    ].map((entry) => ({ ...entry })),
  };
}

export function mapFileFromLayout(mapKey, layout) {
  const map = getMap(mapKey);
  if (!map || !layout) return null;
  const floor = [];
  const decorations = [];
  for (const entry of layout.entries || []) {
    if (entry.cx === undefined || entry.cz === undefined) continue;
    if (isFloorTile(entry.key)) floor.push({ ...entry });
    else decorations.push({ ...entry });
  }
  return {
    version: 3,
    mapKey,
    seed: layout.seed,
    spawn: layout.spawn,
    floor,
    path: [],
    water: [],
    decorations,
  };
}

function isFloorTile(key) {
  if (typeof key !== 'string') return false;
  const def = getDecoration(key);
  return Boolean(def && def.kind === 'floor');
}
