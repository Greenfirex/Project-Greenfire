// Sestaví soubor mapy z toho, co je v editoru — každá vrstva zůstane vrstvou, nic se nedopočítává.
import { getMap } from './maps.js';

export const MAP_VERSION = 4;

export function isMapFile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return ['floor', 'path', 'decorations'].every((name) => Array.isArray(body[name]));
}

export function layoutFromMapFile(file, fallbackSeed = 1) {
  const world = file || {};
  const copy = (list) => (list || []).map((entry) => ({ ...entry }));
  return {
    spawn: world.spawn && Number.isFinite(world.spawn.cx) ? { cx: world.spawn.cx, cz: world.spawn.cz } : { cx: 0, cz: 0 },
    seed: Number.isFinite(world.seed) ? world.seed : fallbackSeed,
    waterLevel: Number.isFinite(world.waterLevel) ? world.waterLevel : null,
    floor: copy(world.floor),
    path: copy(world.path),
    clearing: copy(world.clearing),
    grass: copy(world.grass),
    decorations: copy(world.decorations),
  };
}

export function mapFileFromLayout(mapKey, layout) {
  const fallback = getMap(mapKey);
  if (!fallback || !layout) return null;
  const copy = (list) => (list || []).map((entry) => ({ ...entry }));
  return {
    version: MAP_VERSION,
    mapKey,
    seed: Number.isFinite(layout.seed) ? layout.seed : fallback.seed,
    spawn: layout.spawn ? { cx: layout.spawn.cx, cz: layout.spawn.cz } : { cx: 0, cz: 0 },
    waterLevel: Number.isFinite(layout.waterLevel) ? layout.waterLevel : undefined,
    floor: copy(layout.floor),
    path: copy(layout.path),
    clearing: copy(layout.clearing),
    grass: copy(layout.grass),
    decorations: copy(layout.decorations),
  };
}
