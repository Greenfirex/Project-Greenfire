// Spojitá výška země — přesná ve středu buňky, plynule dopočítaná mezi středy; přes
// hranu útesu ani přes schod nad 2,4 m se nevyhlazuje, takže vrch zůstane nad stěnou.
// Za okrajem mapy a u děr bere výšku nejbližší buňky, aby se zem na okraji nezvedala.
import { CELL_SIZE, cellKey } from './gridMath.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { worldCells } from '../data/maps/areaShape.js';

const MARGIN = 2;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AUTO_CLIFF_STEP = 2.4;
const STEP_EPSILON = 1e-6;
export const SAME_LEVEL_STEP = HEIGHT_STEP + 0.01;
const LAYER_ORDER = ['floor', 'clearing', 'grass', 'path'];

function catmull(p0, p1, p2, p3, t) {
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

function layerLifts(world) {
  const lifts = new Map();
  const layers = world || {};
  for (const name of LAYER_ORDER) {
    for (const entry of layers[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (lifts.has(key)) continue;
      lifts.set(key, entry.liftY || 0);
    }
  }
  return lifts;
}

export function createTerrainField(world) {
  const heights = new Map();
  const sharp = new Set();
  const marked = new Set();
  const sharpStyles = new Map();
  const lifts = layerLifts(world);
  for (const [cx, cz] of worldCells(world || {})) {
    const lift = lifts.get(cellKey(cx, cz));
    if (Number.isFinite(lift)) heights.set(cellKey(cx, cz), lift);
  }
  for (const entry of (world || {}).floor || []) {
    if (!entry || entry.cliff !== true) continue;
    const key = cellKey(entry.cx, entry.cz);
    sharp.add(key);
    marked.add(key);
    sharpStyles.set(key, entry.cliffStyle === 'stone' ? 'stone' : 'dirt');
  }
  for (const [key, height] of heights) {
    if (sharp.has(key)) continue;
    const [cx, cz] = key.split(',').map(Number);
    let lowest = Infinity;
    for (const [dx, dz] of AROUND) {
      const near = heights.get(cellKey(cx + dx, cz + dz));
      if (near !== undefined) lowest = Math.min(lowest, near);
    }
    if (!Number.isFinite(lowest) || height - lowest < AUTO_CLIFF_STEP - STEP_EPSILON) continue;
    sharp.add(key);
    sharpStyles.set(key, 'stone');
  }

  const hardSides = new Map();
  for (const [key, height] of heights) {
    const [cx, cz] = key.split(',').map(Number);
    const hereMarked = marked.has(key);
    let mask = 0;
    for (const [dx, dz] of AROUND) {
      const nearKey = cellKey(cx + dx, cz + dz);
      const near = heights.get(nearKey);
      if (near === undefined) continue;
      const step = Math.abs(height - near);
      if (step <= SAME_LEVEL_STEP) continue;
      const hard = step > AUTO_CLIFF_STEP - STEP_EPSILON || hereMarked !== marked.has(nearKey);
      if (!hard) continue;
      mask |= dx > 0 ? 1 : dx < 0 ? 2 : dz > 0 ? 4 : 8;
    }
    if (mask) hardSides.set(key, mask);
  }

  const nearest = new Map();
  if (heights.size) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let frontier = [];
    for (const [key, lift] of heights) {
      const [cx, cz] = key.split(',').map(Number);
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minZ = Math.min(minZ, cz);
      maxZ = Math.max(maxZ, cz);
      frontier.push([cx, cz, lift]);
    }
    const seen = new Set(heights.keys());
    while (frontier.length) {
      const next = [];
      for (const [cx, cz, lift] of frontier) {
        for (const [dx, dz] of AROUND) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < minX - MARGIN || nx > maxX + MARGIN) continue;
          if (nz < minZ - MARGIN || nz > maxZ + MARGIN) continue;
          const key = cellKey(nx, nz);
          if (seen.has(key)) continue;
          seen.add(key);
          nearest.set(key, lift);
          next.push([nx, nz, lift]);
        }
      }
      frontier = next;
    }
  }

  const cellHeight = (cx, cz) => {
    const value = heights.get(cellKey(cx, cz));
    return value === undefined ? null : value;
  };

  const sample = (cx, cz) => {
    const value = heights.get(cellKey(cx, cz));
    if (value !== undefined) return value;
    const near = nearest.get(cellKey(cx, cz));
    return near === undefined ? 0 : near;
  };

  const cellAt = (value) => Math.floor((value + CELL_SIZE / 2) / CELL_SIZE);

  const hardMaskAt = (cx, cz) => hardSides.get(cellKey(cx, cz)) || 0;

  function acrossHard(ax, az, bx, bz) {
    let x = ax;
    let z = az;
    let guard = 0;
    while ((x !== bx || z !== bz) && guard < 8) {
      guard += 1;
      const nx = x + Math.sign(bx - x);
      const nz = z + Math.sign(bz - z);
      if (nx !== x && (hardMaskAt(x, z) & (nx > x ? 1 : 2))) return true;
      if (nz !== z && (hardMaskAt(nx, z) & (nz > z ? 4 : 8))) return true;
      x = nx;
      z = nz;
    }
    return false;
  }

  function patched(px, pz, cx, cz) {
    const ix = Math.floor(px);
    const iz = Math.floor(pz);
    const fx = px - ix;
    const fz = pz - iz;
    const own = sample(cx, cz);
    const hasHardEdges = hardSides.size > 0;
    const trusted = (col, row) => (hasHardEdges && acrossHard(cx, cz, col, row) ? own : sample(col, row));
    const rows = [];
    const used = [];
    for (let j = 0; j < 4; j += 1) {
      const row = iz - 1 + j;
      const values = [];
      for (let i = 0; i < 4; i += 1) {
        const col = ix - 1 + i;
        values.push(trusted(col, row));
      }
      used.push(...values);
      rows.push(catmull(values[0], values[1], values[2], values[3], fx));
    }
    const value = catmull(rows[0], rows[1], rows[2], rows[3], fz);
    const low = Math.min(...used);
    const high = Math.max(...used);
    return Math.min(high, Math.max(low, value));
  }

  function heightAtSide(x, z, cx, cz) {
    return patched(x / CELL_SIZE, z / CELL_SIZE, cx, cz);
  }

  function heightAt(x, z) {
    const cx = cellAt(x);
    const cz = cellAt(z);
    return patched(x / CELL_SIZE, z / CELL_SIZE, cx, cz);
  }

  function heightAtCell(cx, cz) {
    const value = cellHeight(cx, cz);
    return value === null ? 0 : value;
  }

  return {
    heightAt,
    heightAtCell,
    heightAtSide,
    isHardEdge: (cx, cz, dx, dz) => {
      const mask = hardMaskAt(cx, cz);
      if (!mask) return false;
      return (mask & (dx > 0 ? 1 : dx < 0 ? 2 : dz > 0 ? 4 : 8)) !== 0;
    },
    cliffStyleAt: (cx, cz) => sharpStyles.get(cellKey(cx, cz)) || null,
  };
}
