// Společná nastavení editoru mapy — čísla a pomocné výpočty, které používá víc jeho částí.
import { levelOfEntry } from '../data/maps/areaShape.js';
import { layoutFromMapFile } from '../data/catalogs/mapFile.js';

export const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function onSurface(entry, cx, cz) {
  return Boolean(entry) && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === 0;
}

export function toWorld(world) {
  return layoutFromMapFile(world, world && world.seed);
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
