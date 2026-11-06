// Sestaví soubor mapy z toho, co je v editoru — každá vrstva zůstane vrstvou, nic se nedopočítává.
import { getMap } from './maps.js';
import { HEIGHT_STEP } from '../maps/layoutStore.js';

export const MAP_VERSION = 9;

const HEIGHT_LAYERS = ['floor', 'path', 'clearing', 'grass'];

function snapHeight(value) {
  return Number.isFinite(value) ? Math.round(value / HEIGHT_STEP) * HEIGHT_STEP : value;
}

export function quantizeMapFileHeights(file) {
  if (!file) return file;
  for (const name of HEIGHT_LAYERS) {
    for (const entry of file[name] || []) {
      if (Number.isFinite(entry.liftY)) entry.liftY = snapHeight(entry.liftY);
      if (Number.isFinite(entry.ceilY)) entry.ceilY = snapHeight(entry.ceilY);
    }
  }
  if (Number.isFinite(file.waterLevel)) file.waterLevel = snapHeight(file.waterLevel);
  return file;
}

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
    fish: copy(world.fish),
    creatures: Array.isArray(world.creatures) ? copy(world.creatures) : null,
    bridges: copy(world.bridges),
    connectors: copy(world.connectors),
  };
}

function storedEntry(entry) {
  const out = { ...entry };
  if (!out.level) delete out.level;
  if (!Number.isFinite(out.ceilY)) delete out.ceilY;
  return out;
}

export function mapFileFromLayout(mapKey, layout) {
  const fallback = getMap(mapKey);
  if (!fallback || !layout) return null;
  const copy = (list) => (list || []).map(storedEntry);
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
    fish: copy(layout.fish),
    creatures: Array.isArray(layout.creatures) ? copy(layout.creatures) : undefined,
    bridges: copy(layout.bridges),
    connectors: (layout.connectors || []).length ? layout.connectors.map((item) => ({ ...item })) : undefined,
  };
}
