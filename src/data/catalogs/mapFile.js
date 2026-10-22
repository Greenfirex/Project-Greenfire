// Sestaví soubor mapy z toho, co je v editoru — každá vrstva zůstane vrstvou, nic se nedopočítává.
import { getMap } from './maps.js';

export function isMapFile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return ['floor', 'path', 'water', 'decorations'].every((name) => Array.isArray(body[name]));
}

export function layoutFromMapFile(file, fallbackSeed = 1) {
  const world = file || {};
  const copy = (list) => (list || []).map((entry) => ({ ...entry }));
  return {
    spawn: world.spawn && Number.isFinite(world.spawn.cx) ? { cx: world.spawn.cx, cz: world.spawn.cz } : { cx: 0, cz: 0 },
    seed: Number.isFinite(world.seed) ? world.seed : fallbackSeed,
    floor: copy(world.floor),
    path: copy(world.path),
    water: copy(world.water),
    clearing: copy(world.clearing),
    manual: copy(world.manual),
    decorations: copy(world.decorations),
  };
}

export function mapFileFromLayout(mapKey, layout) {
  const fallback = getMap(mapKey);
  if (!fallback || !layout) return null;
  const copy = (list) => (list || []).map((entry) => ({ ...entry }));
  return {
    version: 3,
    mapKey,
    seed: Number.isFinite(layout.seed) ? layout.seed : fallback.seed,
    spawn: layout.spawn ? { cx: layout.spawn.cx, cz: layout.spawn.cz } : { cx: 0, cz: 0 },
    floor: copy(layout.floor),
    path: copy(layout.path),
    water: copy(layout.water),
    clearing: copy(layout.clearing),
    manual: copy(layout.manual),
    decorations: copy(layout.decorations),
  };
}
