// Objem terénu — svislé stěny a spodní víka tam, kde skála sousedí se vzduchem, po dílcích.
// Čistá data bez scény: vrací líce k vytvoření meshů, vzhled řeší terénní systém.
import { CELL_SIZE } from '../../utils/gridMath.js';
import { HEIGHT_STEP } from '../../data/maps/layoutStore.js';
import { floorCellAt } from '../../data/maps/areaShape.js';
import { DEFAULT_FLOOR } from '../../data/catalogs/decorations.js';
import { buildColumnRuns, buildColumnAir, EDGE_DEPTH } from '../../utils/terrainRuns.js';

const EPS = 1e-4;
const PLATE = HEIGHT_STEP;
const PLATE_SPAN = 6;
const BAND_TILE = 1;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function hash01(value) {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function exposedPieces(runs, y0, y1) {
  const pieces = [];
  let cursor = y0;
  for (const [start, end] of runs) {
    if (end <= cursor + EPS) continue;
    if (start >= y1 - EPS) break;
    if (start > cursor) pieces.push([cursor, Math.min(start, y1)]);
    if (end > cursor) cursor = end;
    if (cursor >= y1 - EPS) break;
  }
  if (cursor < y1 - EPS) pieces.push([cursor, y1]);
  return pieces;
}

function overlapPieces(spans, y0, y1) {
  const pieces = [];
  for (const span of spans) {
    const bottom = Math.max(y0, span.bottom);
    const top = Math.min(y1, span.top);
    if (top - bottom > EPS) pieces.push({ bottom, top, level: span.level });
  }
  return pieces;
}

export function buildRunVolumeBuckets(layout, options = {}) {
  const world = layout || {};
  const cellSize = Number.isFinite(options.cellSize) ? options.cellSize : CELL_SIZE;
  const tileOf = typeof options.tileOf === 'function' ? options.tileOf : () => 3;
  const chunkSize = Number.isFinite(options.chunkSize) ? options.chunkSize : 4;
  const subdivisions = Number.isFinite(options.subdivisions) ? options.subdivisions : 4;
  const depth = Number.isFinite(options.depth) ? options.depth : 1;
  const styleOf = typeof options.styleOf === 'function' ? options.styleOf : () => null;
  const surface = typeof options.surface === 'function' ? options.surface : null;
  const hardEdge = typeof options.hardEdge === 'function' ? options.hardEdge : () => false;
  const solids = buildColumnRuns(world);
  const air = buildColumnAir(world);
  const half = cellSize / 2;
  const buckets = [];
  const ids = new Map();

  const bucketOf = (cx, cz, kind, name) => {
    const chunkX = Math.floor(cx / chunkSize);
    const chunkZ = Math.floor(cz / chunkSize);
    const id = `${chunkX}|${chunkZ}|${kind}|${name}`;
    let group = ids.get(id);
    if (!group) {
      group = { chunkX, chunkZ, kind, name, positions: [], indices: [], uvs: [], shades: [] };
      ids.set(id, group);
      buckets.push(group);
    }
    return group;
  };

  const quad = (group, points, uvs) => {
    const start = group.positions.length / 3;
    for (const point of points) group.positions.push(point[0], point[1], point[2]);
    for (const value of uvs) group.uvs.push(value);
    group.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  const layerUvs = (uvs, layer) => {
    const su = hash01(layer * 0.731 + 3.1);
    const sv = hash01(layer * 1.937 - 8.4);
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] += su;
      uvs[i + 1] += sv;
    }
    return uvs;
  };

  const wall = (group, cx, cz, dx, dz, y0, y1, tile) => {
    const x0 = cx * cellSize - half;
    const x1 = x0 + cellSize;
    const z0 = cz * cellSize - half;
    const z1 = z0 + cellSize;
    const v0 = y0 / tile;
    const v1 = y1 / tile;
    const layer = Math.round(y0 / PLATE);
    if (dx !== 0) {
      const x = dx > 0 ? x1 : x0;
      const u0 = z0 / tile;
      const u1 = z1 / tile;
      if (dx > 0) quad(group, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], layerUvs([u0, v0, u0, v1, u1, v1, u1, v0], layer));
      else quad(group, [[x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]], layerUvs([u1, v0, u1, v1, u0, v1, u0, v0], layer));
      return;
    }
    const z = dz > 0 ? z1 : z0;
    const u0 = x0 / tile;
    const u1 = x1 / tile;
    if (dz > 0) quad(group, [[x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]], layerUvs([u1, v0, u1, v1, u0, v1, u0, v0], layer));
    else quad(group, [[x0, y0, z], [x0, y1, z], [x1, y1, z], [x1, y0, z]], layerUvs([u0, v0, u0, v1, u1, v1, u1, v0], layer));
  };

  const cap = (group, cx, cz, y, tile) => {
    const x0 = cx * cellSize - half;
    const x1 = x0 + cellSize;
    const z0 = cz * cellSize - half;
    const z1 = z0 + cellSize;
    quad(
      group,
      [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]],
      [x0 / tile, z0 / tile, x1 / tile, z0 / tile, x1 / tile, z1 / tile, x0 / tile, z1 / tile],
    );
  };

  const floorKey = (cx, cz, level) => {
    const entry = floorCellAt(world, cx, cz, level);
    return entry && entry.key ? entry.key : DEFAULT_FLOOR;
  };

  const boundaryAt = (cx, cz, dx, dz, a) => {
    const x0 = cx * cellSize - half;
    const z0 = cz * cellSize - half;
    if (dx !== 0) return { gx: dx > 0 ? x0 + cellSize : x0, gz: z0 + cellSize * a };
    return { gx: x0 + cellSize * a, gz: dz > 0 ? z0 + cellSize : z0 };
  };

  const sideQuad = (group, cx, cz, dx, dz, a0, a1, bottomA, bottomB, topA, topB, tile, layer, faceBottom, faceTop) => {
    const x0 = cx * cellSize - half;
    const z0 = cz * cellSize - half;
    const start = group.positions.length / 3;
    const seed = layer === null ? Math.round(bottomA / PLATE) : layer;
    const span = Math.max(1e-4, faceTop - faceBottom);
    const depthT = (value) => Math.min(1, Math.max(0, (value - faceBottom) / span));
    let heights;
    if (dx !== 0) {
      const x = dx > 0 ? x0 + cellSize : x0;
      const za = z0 + cellSize * a0;
      const zb = z0 + cellSize * a1;
      if (dx > 0) {
        group.positions.push(x, bottomA, za, x, topA, za, x, topB, zb, x, bottomB, zb);
        heights = [bottomA, topA, topB, bottomB];
      } else {
        group.positions.push(x, bottomB, zb, x, topB, zb, x, topA, za, x, bottomA, za);
        heights = [bottomB, topB, topA, bottomA];
      }
      group.uvs.push(...layerUvs([za / tile, bottomA / tile, za / tile, topA / tile, zb / tile, topB / tile, zb / tile, bottomB / tile], seed));
    } else {
      const z = dz > 0 ? z0 + cellSize : z0;
      const xa = x0 + cellSize * a0;
      const xb = x0 + cellSize * a1;
      if (dz > 0) {
        group.positions.push(xb, bottomB, z, xb, topB, z, xa, topA, z, xa, bottomA, z);
        heights = [bottomB, topB, topA, bottomA];
      } else {
        group.positions.push(xa, bottomA, z, xa, topA, z, xb, topB, z, xb, bottomB, z);
        heights = [bottomA, topA, topB, bottomB];
      }
      group.uvs.push(...layerUvs([xb / tile, bottomB / tile, xb / tile, topB / tile, xa / tile, topA / tile, xa / tile, bottomA / tile], seed));
    }
    for (const value of heights) group.shades.push(depthT(value));
    group.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  const plateBands = (from, to) => {
    const bands = [];
    let cursor = from;
    let guard = 0;
    while (to - cursor > EPS && guard < 512) {
      guard += 1;
      const next = Math.min(to, (Math.floor(cursor / PLATE + 1e-6) + 1) * PLATE);
      bands.push([cursor, next]);
      cursor = next;
    }
    return bands;
  };

  const sideFace = (cx, cz, dx, dz, y0, y1, key, openEdge = false) => {
    const style = styleOf(cx, cz) || 'dirt';
    const rockTile = tileOf('cliff', style);
    const hard = hardEdge(cx, cz, dx, dz);
    const bandDepth = hard ? PLATE : depth;
    const strips = Math.max(1, Math.round(bandDepth / PLATE));

    const heights = [];
    for (let i = 0; i <= subdivisions; i += 1) {
      const p = boundaryAt(cx, cz, dx, dz, i / subdivisions);
      heights.push(surface ? surface(p.gx, p.gz, cx, cz, dx, dz, y1) : y1);
    }
    const lowTop = Math.min(...heights);
    const bottom = openEdge ? Math.max(y0, lowTop - EDGE_DEPTH) : y0 - depth;
    const tops = heights.map((value) => Math.max(value, bottom));
    const faceTop = Math.max(...tops);
    if (bottom >= faceTop - EPS) return;
    const rockTop = Math.max(bottom, Math.floor((lowTop - bandDepth) / PLATE + 1e-6) * PLATE);
    const rockFrom = Math.max(bottom, rockTop - PLATE_SPAN);
    const rock = bucketOf(cx, cz, 'cliff', style);
    const band = bucketOf(cx, cz, 'soil', key);
    if (rockFrom > bottom + EPS) {
      sideQuad(rock, cx, cz, dx, dz, 0, 1, bottom, bottom, rockFrom, rockFrom, rockTile, null, bottom, faceTop);
    }
    for (const [b, t] of plateBands(rockFrom, rockTop)) {
      sideQuad(rock, cx, cz, dx, dz, 0, 1, b, b, t, t, rockTile, null, bottom, faceTop);
    }
    for (let i = 0; i < subdivisions; i += 1) {
      const a0 = i / subdivisions;
      const a1 = (i + 1) / subdivisions;
      const shoulderA = Math.max(rockTop, tops[i] - bandDepth);
      const shoulderB = Math.max(rockTop, tops[i + 1] - bandDepth);
      if (shoulderA > rockTop + EPS || shoulderB > rockTop + EPS) {
        sideQuad(rock, cx, cz, dx, dz, a0, a1, rockTop, rockTop, shoulderA, shoulderB, rockTile, null, bottom, faceTop);
      }
      for (let k = 0; k < strips; k += 1) {
        sideQuad(
          band, cx, cz, dx, dz, a0, a1,
          tops[i] - (k + 1) * PLATE, tops[i + 1] - (k + 1) * PLATE,
          tops[i] - k * PLATE, tops[i + 1] - k * PLATE,
          BAND_TILE,
          k,
          bottom,
          faceTop,
        );
      }
    }
  };

  for (const [id, runs] of solids) {
    if (!runs.length) continue;
    const [cx, cz] = id.split(',').map(Number);
    const ownAir = air.get(id) || [];
    for (const [bottom, top] of runs) {
      for (const [dx, dz] of DIRECTIONS) {
        const nx = cx + dx;
        const nz = cz + dz;
        const neighborId = `${nx},${nz}`;
        const hasNeighbor = solids.has(neighborId);
        const neighborRuns = solids.get(neighborId) || [];
        const neighborAir = air.get(neighborId) || [];
        for (const [y0, y1] of exposedPieces(neighborRuns, bottom, top)) {
          if (!hasNeighbor) {
            sideFace(cx, cz, dx, dz, y0, y1, floorKey(cx, cz, 0), true);
            continue;
          }
          for (const piece of overlapPieces(neighborAir, y0, y1)) {
            if (piece.level >= 0) {
              sideFace(cx, cz, dx, dz, piece.bottom, piece.top, floorKey(cx, cz, 0));
              continue;
            }
            const key = floorKey(nx, nz, piece.level);
            const caveWall = bucketOf(cx, cz, 'cave', key);
            const caveTile = tileOf('cave', key);
            for (const [b, t] of plateBands(piece.bottom, piece.top)) {
              wall(caveWall, cx, cz, dx, dz, b, t, caveTile);
            }
          }
        }
      }
      const below = ownAir.find((span) => Math.abs(span.top - bottom) <= EPS);
      if (below) {
        const key = floorKey(cx, cz, below.level);
        cap(bucketOf(cx, cz, 'ceiling', key), cx, cz, bottom, tileOf('ceiling', key));
      }
    }
  }

  return buckets;
}
