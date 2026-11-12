// Jezera — od jedné buňky rozlije vodu do prohlubně až po zadanou hladinu.
// Když voda doteče na kraj mapy, jezero přeteče a nevznikne; nejvyšší hladinu, která ještě nepřeteče, umí najít.
import { cellKey } from './gridMath.js';
import { HEIGHT_STEP, MAX_HEIGHT } from '../data/maps/layoutStore.js';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function cellSetOf(cells) {
  if (cells instanceof Set) return cells;
  const set = new Set();
  for (const [cx, cz] of cells || []) set.add(cellKey(cx, cz));
  return set;
}

export function fillLake(cx, cz, level, cells, heightAtCell) {
  const present = cellSetOf(cells);
  const start = cellKey(cx, cz);
  if (!Number.isFinite(level) || !present.has(start) || !(heightAtCell(cx, cz) < level)) {
    return { cells: [], overflow: false, lowest: null };
  }
  const seen = new Set([start]);
  const out = [];
  const stack = [[cx, cz]];
  let overflow = false;
  let lowest = { cx, cz, height: heightAtCell(cx, cz) };
  while (stack.length) {
    const [x, z] = stack.pop();
    out.push([x, z]);
    for (const [dx, dz] of SIDES) {
      const nx = x + dx;
      const nz = z + dz;
      const key = cellKey(nx, nz);
      if (!present.has(key)) {
        overflow = true;
        continue;
      }
      if (seen.has(key)) continue;
      const height = heightAtCell(nx, nz);
      if (!(height < level)) continue;
      seen.add(key);
      stack.push([nx, nz]);
      if (height < lowest.height) lowest = { cx: nx, cz: nz, height };
    }
  }
  return { cells: out, overflow, lowest };
}

export function brimLevel(cx, cz, cells, heightAtCell) {
  const present = cellSetOf(cells);
  if (!present.has(cellKey(cx, cz))) return null;
  const ground = heightAtCell(cx, cz);
  let low = Math.floor(ground / HEIGHT_STEP) + 1;
  let high = MAX_HEIGHT;
  if (fillLake(cx, cz, low * HEIGHT_STEP, present, heightAtCell).overflow) return null;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fillLake(cx, cz, mid * HEIGHT_STEP, present, heightAtCell).overflow) high = mid - 1;
    else low = mid;
  }
  return low * HEIGHT_STEP;
}

export function fillLakes(lakes, cells, heightAtCell) {
  const present = cellSetOf(cells);
  const list = [];
  const levels = new Map();
  for (const [index, lake] of (lakes || []).entries()) {
    if (!lake || !Number.isFinite(lake.cx) || !Number.isFinite(lake.cz)) continue;
    if (levels.has(cellKey(lake.cx, lake.cz))) continue;
    const fill = fillLake(lake.cx, lake.cz, lake.level, present, heightAtCell);
    if (!fill.cells.length || fill.overflow) continue;
    for (const [cx, cz] of fill.cells) levels.set(cellKey(cx, cz), lake.level);
    list.push({ index, level: lake.level, cells: fill.cells });
  }
  return { list, levels };
}
