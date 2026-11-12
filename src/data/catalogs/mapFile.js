// Sestaví soubor mapy z toho, co je v editoru — každá vrstva zůstane vrstvou, nic se nedopočítává.
import { getMap } from './maps.js';
import { HEIGHT_STEP } from '../maps/layoutStore.js';
import { PLANE_LAYERS } from '../maps/areaShape.js';

export const MAP_VERSION = 10;
const GRID_025_VERSION = 10;

export function defaultSpawn() {
  return { cx: 0, cz: 0 };
}

function snapHeight(value) {
  return Number.isFinite(value) ? Math.round(value / HEIGHT_STEP) * HEIGHT_STEP : value;
}

function surfaceShifts(file) {
  const shifts = new Map();
  for (const name of PLANE_LAYERS) {
    for (const entry of file[name] || []) {
      if (!entry || entry.level) continue;
      const key = `${entry.cx},${entry.cz}`;
      if (shifts.has(key)) continue;
      const lift = Number.isFinite(entry.liftY) ? entry.liftY : 0;
      shifts.set(key, snapHeight(lift) - lift);
    }
  }
  return shifts;
}

export function quantizeMapFileHeights(file) {
  if (!file || (Number.isFinite(file.version) && file.version >= GRID_025_VERSION)) return file;
  const shifts = surfaceShifts(file);
  for (const name of PLANE_LAYERS) {
    for (const entry of file[name] || []) {
      if (Number.isFinite(entry.liftY)) entry.liftY = snapHeight(entry.liftY);
      if (Number.isFinite(entry.ceilY)) entry.ceilY = snapHeight(entry.ceilY);
    }
  }
  for (const entry of file.decorations || []) {
    const shift = entry ? shifts.get(`${entry.cx},${entry.cz}`) : 0;
    if (!shift) continue;
    const next = Math.round(((entry.liftY || 0) + shift) * 1000) / 1000;
    if (next) entry.liftY = next;
    else delete entry.liftY;
  }
  if (Number.isFinite(file.waterLevel)) file.waterLevel = snapHeight(file.waterLevel);
  for (const lake of file.lakes || []) {
    if (lake && Number.isFinite(lake.level)) lake.level = snapHeight(lake.level);
  }
  for (const river of file.rivers || []) {
    for (const cell of (river && river.cells) || []) {
      if (Array.isArray(cell) && Number.isFinite(cell[2])) cell[2] = snapHeight(cell[2]);
    }
  }
  file.version = MAP_VERSION;
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
    spawn: world.spawn && Number.isFinite(world.spawn.cx) ? { cx: world.spawn.cx, cz: world.spawn.cz } : defaultSpawn(),
    seed: Number.isFinite(world.seed) ? world.seed : fallbackSeed,
    waterLevel: Number.isFinite(world.waterLevel) ? world.waterLevel : null,
    lakes: lakesOf(world.lakes),
    rivers: riversOf(world.rivers),
    floor: copy(world.floor),
    path: copy(world.path),
    clearing: copy(world.clearing),
    grass: copy(world.grass),
    decorations: copy(world.decorations),
    fish: copy(world.fish),
    creatures: Array.isArray(world.creatures) ? copy(world.creatures) : null,
    bridges: copy(world.bridges),
    connectors: copy(world.connectors),
    floorNames: { ...(world.floorNames || {}) },
  };
}

function lakesOf(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((lake) => lake && Number.isFinite(lake.cx) && Number.isFinite(lake.cz) && Number.isFinite(lake.level))
    .map((lake) => ({ cx: lake.cx, cz: lake.cz, level: lake.level }));
}

function riversOf(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((river) => ({
      cells: ((river && river.cells) || [])
        .filter((cell) => Array.isArray(cell) && cell.length >= 3 && cell.slice(0, 3).every(Number.isFinite))
        .map((cell) => [cell[0], cell[1], cell[2]]),
      width: Number.isFinite(river && river.width) ? river.width : 1,
    }))
    .filter((river) => river.cells.length > 1);
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
    spawn: layout.spawn ? { cx: layout.spawn.cx, cz: layout.spawn.cz } : defaultSpawn(),
    waterLevel: Number.isFinite(layout.waterLevel) ? layout.waterLevel : undefined,
    lakes: (layout.lakes || []).length ? lakesOf(layout.lakes) : undefined,
    rivers: (layout.rivers || []).length ? riversOf(layout.rivers) : undefined,
    floor: copy(layout.floor),
    path: copy(layout.path),
    clearing: copy(layout.clearing),
    grass: copy(layout.grass),
    decorations: copy(layout.decorations),
    fish: copy(layout.fish),
    creatures: Array.isArray(layout.creatures) ? copy(layout.creatures) : undefined,
    bridges: copy(layout.bridges),
    connectors: (layout.connectors || []).length ? layout.connectors.map((item) => ({ ...item })) : undefined,
    floorNames: Object.keys(layout.floorNames || {}).length ? { ...layout.floorNames } : undefined,
  };
}
