// Spojitá výška země — přesná ve středu buňky, plynule dopočítaná mezi středy; přes
// hranu útesu ani přes schod nad 2,0 m se nevyhlazuje, takže vrch zůstane nad stěnou.
// Za okrajem mapy a u děr bere výšku nejbližší buňky, aby se zem na okraji nezvedala.
import { CELL_SIZE, cellKey } from './gridMath.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { PLANE_LAYERS, worldCells, levelOfEntry, planeLevels } from '../data/maps/areaShape.js';

const MARGIN = 2;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const AUTO_CLIFF_STEP = 2.0;
const STEP_EPSILON = 1e-6;
const DOOR_HALF_CELL = 0.5;
const DOOR_SIDE_FADE = 1;
export const SAME_LEVEL_STEP = HEIGHT_STEP + 0.01;

function catmull(p0, p1, p2, p3, t) {
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

function ease(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function layerLifts(world, level) {
  const lifts = new Map();
  const layers = world || {};
  for (const name of PLANE_LAYERS) {
    for (const entry of layers[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      if (levelOfEntry(entry) !== level) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (lifts.has(key)) continue;
      lifts.set(key, entry.liftY || 0);
    }
  }
  return lifts;
}

function createPlane(world, level, below) {
  const heights = new Map();
  const sharp = new Set();
  const marked = new Set();
  const sharpStyles = new Map();
  const lifts = layerLifts(world, level);
  for (const [cx, cz] of worldCells(world || {}, level)) {
    const lift = lifts.get(cellKey(cx, cz));
    if (Number.isFinite(lift)) heights.set(cellKey(cx, cz), lift);
  }
  for (const entry of (world || {}).floor || []) {
    if (!entry || entry.cliff !== true) continue;
    if (levelOfEntry(entry) !== level) continue;
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
    const xBit = (step) => (step > 0 ? 1 : 2);
    const zBit = (step) => (step > 0 ? 4 : 8);
    let x = ax;
    let z = az;
    let guard = 0;
    while ((x !== bx || z !== bz) && guard < 8) {
      guard += 1;
      const sx = Math.sign(bx - x);
      const sz = Math.sign(bz - z);
      if (sx !== 0 && sz !== 0) {
        const here = hardMaskAt(x, z);
        if (here & (xBit(sx) | zBit(sz))) return true;
        if (hardMaskAt(x + sx, z) & zBit(sz)) return true;
        if (hardMaskAt(x, z + sz) & xBit(sx)) return true;
      } else if (sx !== 0) {
        if (hardMaskAt(x, z) & xBit(sx)) return true;
      } else if (sz !== 0) {
        if (hardMaskAt(x, z) & zBit(sz)) return true;
      }
      x += sx;
      z += sz;
    }
    return false;
  }

  const doorBlends = [];

  function doorBlendAt(px, pz) {
    let total = 0;
    for (const door of doorBlends) {
      const offsetX = px - door.cx;
      const offsetZ = pz - door.cz;
      const along = offsetX * door.dx + offsetZ * door.dz;
      if (along <= 0 || along > DOOR_HALF_CELL) continue;
      const side = offsetX * door.dz - offsetZ * door.dx;
      if (Math.abs(side) >= DOOR_SIDE_FADE) continue;
      const edgeSide = Math.max(-DOOR_HALF_CELL, Math.min(DOOR_HALF_CELL, side));
      const edgeX = door.cx + door.dx * DOOR_HALF_CELL + door.dz * edgeSide;
      const edgeZ = door.cz + door.dz * DOOR_HALF_CELL - door.dx * edgeSide;
      const own = smoothed(edgeX, edgeZ, door.cx, door.cz);
      const other = door.other.smoothedAt(edgeX, edgeZ, door.cx + door.dx, door.cz + door.dz);
      const fade = 1 - ease((Math.abs(side) - DOOR_HALF_CELL) / (DOOR_SIDE_FADE - DOOR_HALF_CELL));
      total += (other - own) * ease(along / DOOR_HALF_CELL) * fade;
    }
    return total;
  }

  function smoothed(px, pz, cx, cz) {
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

  function patched(px, pz, cx, cz) {
    return smoothed(px, pz, cx, cz) + doorBlendAt(px, pz);
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

  const holes = new Set();
  for (const key of below) {
    if (!heights.has(key)) holes.add(key);
  }

  return {
    heightAt,
    heightAtCell,
    heightAtSide,
    smoothedAt: smoothed,
    isHardEdge: (cx, cz, dx, dz) => {
      const mask = hardMaskAt(cx, cz);
      if (!mask) return false;
      return (mask & (dx > 0 ? 1 : dx < 0 ? 2 : dz > 0 ? 4 : 8)) !== 0;
    },
    cliffStyleAt: (cx, cz) => sharpStyles.get(cellKey(cx, cz)) || null,
    isHole: (cx, cz) => holes.has(cellKey(cx, cz)),
    cells: heights,
    doorBlends,
  };
}

function emptyPlane() {
  return {
    heightAt: () => 0,
    heightAtCell: () => 0,
    heightAtSide: () => 0,
    smoothedAt: () => 0,
    isHardEdge: () => false,
    cliffStyleAt: () => null,
    isHole: () => false,
    doorBlends: [],
  };
}

export function createTerrainField(world) {
  const planes = new Map();
  const below = new Set();
  for (const level of planeLevels(world)) {
    const plane = createPlane(world, level, below);
    planes.set(level, plane);
    for (const [key] of plane.cells) below.add(key);
  }
  const empty = emptyPlane();
  const planeFor = (level) => planes.get(level) || empty;
  return {
    heightAt: (x, z, level = 0) => planeFor(level).heightAt(x, z),
    heightAtCell: (cx, cz, level = 0) => planeFor(level).heightAtCell(cx, cz),
    heightAtSide: (x, z, cx, cz, level = 0) => planeFor(level).heightAtSide(x, z, cx, cz),
    isHardEdge: (cx, cz, dx, dz, level = 0) => planeFor(level).isHardEdge(cx, cz, dx, dz),
    cliffStyleAt: (cx, cz, level = 0) => planeFor(level).cliffStyleAt(cx, cz),
    isHole: (cx, cz, level = 0) => planeFor(level).isHole(cx, cz),
    setDoorBlends: (doors) => {
      for (const door of doors) {
        planeFor(door.level).doorBlends.push({ cx: door.cx, cz: door.cz, dx: door.dx, dz: door.dz, other: planeFor(door.otherLevel) });
      }
    },
  };
}
