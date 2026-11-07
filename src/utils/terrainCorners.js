// Které svislé hrany terénu jsou skutečné rohy — ze čtyř buněk kolem hrany, po výškových vrstvách.
// Čistá data bez scény: vrací intervaly výšek, druh hrany a směr od hrany do vzduchu.
import { CELL_SIZE } from './gridMath.js';
import { buildColumnRuns, WORLD_BOTTOM, WORLD_TOP, EDGE_DEPTH } from './terrainRuns.js';

const EPS = 1e-4;
const QUADRANTS = [[0, 0], [1, 0], [0, 1], [1, 1]];
const QUADRANT_SIDES = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];

function solidAt(runs, y) {
  if (!runs) return false;
  for (const [bottom, top] of runs) {
    if (y > bottom + EPS && y < top - EPS) return true;
  }
  return false;
}

function solidCount(mask) {
  let count = 0;
  for (let bit = 0; bit < 4; bit += 1) if (mask & (1 << bit)) count += 1;
  return count;
}

function adjacentPair(mask) {
  return (mask & 0b0011) === 0b0011
    || (mask & 0b1100) === 0b1100
    || (mask & 0b0101) === 0b0101
    || (mask & 0b1010) === 0b1010;
}

function kindOf(mask) {
  const count = solidCount(mask);
  if (count === 1) return 'corner';
  if (count === 3) return 'inner';
  if (count === 2) return adjacentPair(mask) ? 'seam' : 'diagonal';
  return null;
}

function hardAt(hardEdge, cx, cz, ox, oz) {
  if (!hardEdge) return true;
  const sideX = ox === 0 ? 1 : -1;
  const sideZ = oz === 0 ? 1 : -1;
  return hardEdge(cx, cz, sideX, 0) && hardEdge(cx, cz, 0, sideZ);
}

function hardKinds(kind, mask, hardEdge, ix, iz) {
  if (!hardEdge) return true;
  const wanted = kind !== 'inner';
  for (let bit = 0; bit < 4; bit += 1) {
    const solid = (mask & (1 << bit)) !== 0;
    if (solid !== wanted) continue;
    const [ox, oz] = QUADRANTS[bit];
    if (!hardAt(hardEdge, ix + ox, iz + oz, ox, oz)) return false;
  }
  return true;
}

function bitOf(mask, wanted) {
  for (let bit = 0; bit < 4; bit += 1) {
    const solid = (mask & (1 << bit)) !== 0;
    if (solid === wanted) return bit;
  }
  return -1;
}

function outDirection(kind, mask) {
  if (kind === 'corner') {
    const side = QUADRANT_SIDES[bitOf(mask, true)];
    const length = Math.hypot(side[0], side[1]);
    return { x: -side[0] / length, z: -side[1] / length };
  }
  if (kind === 'inner') {
    const side = QUADRANT_SIDES[bitOf(mask, false)];
    const length = Math.hypot(side[0], side[1]);
    return { x: side[0] / length, z: side[1] / length };
  }
  if (kind === 'diagonal') {
    const side = QUADRANT_SIDES[bitOf(mask, false)];
    return { x: Math.sign(side[0]), z: 0 };
  }
  return { x: 0, z: 0 };
}

export function buildCornerEdges(layout, options = {}) {
  const columnRuns = options.runs || buildColumnRuns(layout || {});
  const bottom = Number.isFinite(options.bottom) ? options.bottom : WORLD_BOTTOM;
  const top = Number.isFinite(options.top) ? options.top : WORLD_TOP;
  const hardEdge = typeof options.hardEdge === 'function' ? options.hardEdge : null;
  const vertices = new Set();
  for (const id of columnRuns.keys()) {
    const [cx, cz] = id.split(',').map(Number);
    vertices.add(`${cx},${cz}`);
    vertices.add(`${cx + 1},${cz}`);
    vertices.add(`${cx},${cz + 1}`);
    vertices.add(`${cx + 1},${cz + 1}`);
  }
  const edges = [];
  for (const id of vertices) {
    const [ix, iz] = id.split(',').map(Number);
    const lists = QUADRANTS.map(([ox, oz]) => columnRuns.get(`${ix + ox},${iz + oz}`) || null);
    let missingTop = -Infinity;
    for (const list of lists) {
      if (list && list.length) missingTop = Math.max(missingTop, list[list.length - 1][1]);
    }
    if (!Number.isFinite(missingTop)) continue;
    const openTop = missingTop - EDGE_DEPTH;
    const cuts = new Set([bottom, top]);
    if (openTop > bottom && openTop < top) cuts.add(openTop);
    for (const list of lists) {
      for (const [y0, y1] of list || []) {
        if (y0 > bottom) cuts.add(y0);
        if (y1 < top) cuts.add(y1);
      }
    }
    const sorted = [...cuts].filter((y) => y >= bottom - EPS && y <= top + EPS).sort((a, b) => a - b);
    const solidIn = (bit, y) => {
      const list = lists[bit];
      return list ? solidAt(list, y) : y < openTop - EPS;
    };
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const y0 = sorted[index];
      const y1 = sorted[index + 1];
      if (y1 - y0 <= EPS) continue;
      const mid = (y0 + y1) / 2;
      let mask = 0;
      for (let bit = 0; bit < 4; bit += 1) {
        if (solidIn(bit, mid)) mask |= 1 << bit;
      }
      const kind = kindOf(mask);
      if (!kind) continue;
      if (!hardKinds(kind, mask, hardEdge, ix, iz)) continue;
      const out = outDirection(kind, mask);
      edges.push({
        gx: (ix + 0.5) * CELL_SIZE,
        gz: (iz + 0.5) * CELL_SIZE,
        y0,
        y1,
        kind,
        mask,
        outX: out.x,
        outZ: out.z,
      });
    }
  }
  return edges;
}
