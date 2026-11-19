// Stavby skládané z dílů na mřížce — rozměr v buňkách a podlaha; stěny, dveře a střecha přibudou.
// Plán po etapách je v DEV.md, sekce „Stavby".
import { PLANKS_TEXTURE } from './assetPaths.js';

export const BUILDINGS = {
  pirate_cabin: {
    displayName: 'Opuštěný pirátský srub',
    width: 4,
    depth: 3,
    floor: {
      texture: PLANKS_TEXTURE,
      tile: 2,
      lift: 0.06,
      tint: [0.72, 0.62, 0.5],
      beam: 0.22,
      beamLift: 0.05,
      beamTint: [0.5, 0.4, 0.3],
      stepKey: 'planks',
    },
  },
};

export function getBuilding(key) {
  return BUILDINGS[key] || null;
}

export function buildingSize(entry) {
  const def = getBuilding(entry && entry.key);
  if (!def) return null;
  const turned = ((((entry.rotation || 0) % 4) + 4) % 4) % 2 === 1;
  return turned ? { width: def.depth, depth: def.width } : { width: def.width, depth: def.depth };
}

export function buildingCells(entry) {
  const size = buildingSize(entry);
  if (!size) return [];
  const cells = [];
  for (let x = 0; x < size.width; x += 1) {
    for (let z = 0; z < size.depth; z += 1) cells.push([entry.cx + x, entry.cz + z]);
  }
  return cells;
}
