// Společná nastavení editoru mapy — čísla a pomocné výpočty, které používá víc jeho částí.
import { levelOfEntry } from '../data/maps/areaShape.js';
import { layoutFromMapFile } from '../data/catalogs/mapFile.js';
import { MIN_HEIGHT, MAX_HEIGHT } from '../data/maps/layoutStore.js';

export const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export const MARK_COLORS = {
  door: [0.25, 0.95, 0.5],
  thin: [1, 0.6, 0.15],
  problem: [1, 0.2, 0.2],
  draft: [0.15, 1, 0.85],
  draftGlow: [0.2, 0.95, 0.8],
  erase: [1, 0.3, 0.25],
  eraseGlow: [0.95, 0.25, 0.2],
  slope: [0.95, 0.7, 0.2],
  slopeGlow: [0.85, 0.6, 0.15],
  rim: [0.95, 0.88, 0.55],
  rimGlow: [0.85, 0.78, 0.4],
  spawn: [0.95, 0.9, 0.45],
  spawnGlow: [0.85, 0.75, 0.25],
  riverStroke: [0.75, 1, 0.95],
  river: [0.35, 0.7, 1],
};

export const NO_BRUSH_HINT = 'Vyber štětec v paletě — teprve pak jde do mapy kreslit';

export function clampLevel(level) {
  return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, level));
}

export function onSurface(entry, cx, cz) {
  return Boolean(entry) && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === 0;
}

export function toWorld(world) {
  return layoutFromMapFile(world, world && world.seed);
}

export function countWord(n, one, few, many) {
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}

export function cellWord(n) {
  return countWord(n, 'buňka', 'buňky', 'buněk');
}

export function creatureWord(n) {
  return countWord(n, 'tvor', 'tvoři', 'tvorů');
}

export function cellCount(n) {
  return `${n} ${cellWord(n)}`;
}

export function parseCell(cellKeyValue) {
  const [cx, cz] = String(cellKeyValue).split(',').map(Number);
  return { cx, cz };
}

export function rectCells(x0, z0, x1, z1) {
  const out = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minZ = Math.min(z0, z1);
  const maxZ = Math.max(z0, z1);
  for (let cx = minX; cx <= maxX; cx += 1) {
    for (let cz = minZ; cz <= maxZ; cz += 1) out.push([cx, cz]);
  }
  return out;
}

export function bresenham(x0, z0, x1, z1) {
  const out = [];
  let dx = Math.abs(x1 - x0);
  let dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let x = x0;
  let z = z0;
  while (true) {
    out.push([x, z]);
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return out;
}
