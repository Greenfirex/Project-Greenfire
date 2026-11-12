// Řeky — z trasy nakreslené od pramene k ústí spočítá hladinu v každé buňce, směr proudu a koryto.
// Hladina po proudu nikdy nestoupá a drží se pod nejnižším okolním břehem, takže voda nikde nepřeteče.
import { cellKey } from './gridMath.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { AUTO_CLIFF_STEP } from './terrainField.js';
import { valueNoise, hash01 } from './noise.js';

export const RIVER_FREEBOARD = 0.25;
const RIVER_BANK_REACH = 2;
const FLOW_BASE = 0.6;
const FLOW_PER_DROP = 2.5;
const FLOW_MAX = 3;
const RAPIDS_FROM = 0.2;
const RAPIDS_FULL = 0.8;
const DEPTH_WAVE = 5;

function cellSetOf(cells) {
  if (cells instanceof Set) return cells;
  const set = new Set();
  for (const [cx, cz] of cells || []) set.add(cellKey(cx, cz));
  return set;
}

function halfWidth(width) {
  return Math.max(0, Math.round(((Number(width) || 1) - 1) / 2));
}

export function riverPath(from, to) {
  const out = [];
  const lineX = to.cx - from.cx;
  const lineZ = to.cz - from.cz;
  const offLine = (x, z) => Math.abs((x - from.cx) * lineZ - (z - from.cz) * lineX);
  const sx = Math.sign(lineX);
  const sz = Math.sign(lineZ);
  let x = from.cx;
  let z = from.cz;
  while (x !== to.cx || z !== to.cz) {
    const alongX = x !== to.cx && (z === to.cz || offLine(x + sx, z) <= offLine(x, z + sz));
    if (alongX) x += sx;
    else z += sz;
    out.push([x, z]);
  }
  return out;
}

function depthAlong(depths, start, step) {
  const low = Math.min(depths.min, depths.max);
  const high = Math.max(depths.min, depths.max);
  const seed = hash01(start[0], start[1]) * 100;
  const raw = low + (high - low) * valueNoise(step / DEPTH_WAVE, seed);
  return Math.min(high, Math.max(low, Math.round(raw / HEIGHT_STEP) * HEIGHT_STEP));
}

export function planRiver(path, width, depths, cells, heightAtCell, water = new Map(), seaLevel = null) {
  const floor = Number.isFinite(seaLevel) ? seaLevel : -Infinity;
  const present = cellSetOf(cells);
  const reach = halfWidth(width) + RIVER_BANK_REACH;
  const bankAt = (cx, cz) => {
    const key = cellKey(cx, cz);
    return water.has(key) ? water.get(key) + RIVER_FREEBOARD : heightAtCell(cx, cz);
  };
  const planned = [];
  let level = Infinity;
  for (const [cx, cz] of path) {
    if (!present.has(cellKey(cx, cz))) continue;
    const here = bankAt(cx, cz);
    let bank = Infinity;
    for (let dz = -reach; dz <= reach; dz += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        if (!present.has(cellKey(cx + dx, cz + dz))) continue;
        const near = bankAt(cx + dx, cz + dz);
        if (here - near >= AUTO_CLIFF_STEP - 1e-6) continue;
        bank = Math.min(bank, near);
      }
    }
    const top = Math.floor((bank - RIVER_FREEBOARD) / HEIGHT_STEP + 1e-6) * HEIGHT_STEP;
    level = Math.max(floor, Math.min(level, top));
    planned.push([cx, cz, level]);
  }
  const river = { cells: planned, width: halfWidth(width) * 2 + 1 };
  const carve = riverCells(river, present).filter((cell) => !water.has(cellKey(cell.cx, cell.cz))).map((cell) => {
    const ground = heightAtCell(cell.cx, cell.cz);
    return { cx: cell.cx, cz: cell.cz, ground, height: Math.min(ground, cell.level - depthAlong(depths, planned[0], cell.step)) };
  });
  river.ground = carve.filter((cell) => cell.height < cell.ground).map((cell) => [cell.cx, cell.cz, cell.ground]);
  return { river, carve };
}

export function riverGround(river) {
  const ground = new Map();
  for (const entry of (river && river.ground) || []) {
    if (Array.isArray(entry) && entry.length >= 3 && entry.every(Number.isFinite)) ground.set(cellKey(entry[0], entry[1]), entry[2]);
  }
  return ground;
}

export function riverCellKeys(river, cells) {
  return new Set(riverCells(river, cells).map((cell) => cellKey(cell.cx, cell.cz)));
}

export function splitRiver(river, removed, cells) {
  const ground = riverGround(river);
  const pieces = [];
  let run = [];
  const close = () => {
    if (run.length >= 2) {
      const piece = { cells: run, width: river.width };
      const keys = riverCellKeys(piece, cells);
      piece.ground = [...ground].filter(([key]) => keys.has(key)).map(([key, height]) => [...key.split(',').map(Number), height]);
      pieces.push(piece);
    }
    run = [];
  };
  for (const cell of river.cells || []) {
    if (removed.has(cellKey(cell[0], cell[1]))) close();
    else run.push(cell);
  }
  close();
  return pieces;
}

export function riverFalls(river) {
  const path = (river && Array.isArray(river.cells) ? river.cells : [])
    .filter((cell) => Array.isArray(cell) && cell.length >= 3 && cell.every(Number.isFinite));
  const width = halfWidth(river && river.width) * 2 + 1;
  const falls = [];
  for (let index = 0; index + 1 < path.length; index += 1) {
    const [cx, cz, top] = path[index];
    const [nx, nz, bottom] = path[index + 1];
    const dx = nx - cx;
    const dz = nz - cz;
    if (Math.abs(dx) + Math.abs(dz) !== 1) continue;
    if (top - bottom < AUTO_CLIFF_STEP - 1e-6) continue;
    falls.push({ cx, cz, dx, dz, top, bottom, width });
  }
  return falls;
}

export function riverCells(river, cells) {
  const present = cellSetOf(cells);
  const path = (river && Array.isArray(river.cells) ? river.cells : [])
    .filter((cell) => Array.isArray(cell) && cell.length >= 3 && cell.every(Number.isFinite));
  const side = halfWidth(river && river.width);
  const out = [];
  const taken = new Set();
  for (let index = 0; index < path.length; index += 1) {
    const [cx, cz, level] = path[index];
    const first = Math.max(0, index - 1);
    const last = Math.min(path.length - 1, index + 1);
    const before = path[first];
    const after = path[last];
    let dirX = after[0] - before[0];
    let dirZ = after[1] - before[1];
    const length = Math.hypot(dirX, dirZ);
    if (length > 0) {
      dirX /= length;
      dirZ /= length;
    }
    const steps = Math.max(1, last - first);
    const drop = Math.max(0, (before[2] - after[2]) / steps);
    const speed = Math.min(FLOW_MAX, FLOW_BASE + drop * FLOW_PER_DROP);
    const rapids = Math.min(1, Math.max(0, (drop - RAPIDS_FROM) / (RAPIDS_FULL - RAPIDS_FROM)));
    for (let dz = -side; dz <= side; dz += 1) {
      for (let dx = -side; dx <= side; dx += 1) {
        const key = cellKey(cx + dx, cz + dz);
        if (taken.has(key) || !present.has(key)) continue;
        taken.add(key);
        out.push({ cx: cx + dx, cz: cz + dz, level, flowX: dirX * speed, flowZ: dirZ * speed, rapids, step: index });
      }
    }
  }
  return out;
}
