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
const CAVE_WALL_SKIRT = 1;
export const DOOR_LINTEL_DEPTH = 0.25;
const BURIED_WALL_INSET = 0.02;
const SURFACE_CLEARANCE = 0.02;

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
  const shiftAt = typeof options.shiftAt === 'function' ? options.shiftAt : null;
  const keptAt = typeof options.keptAt === 'function' ? options.keptAt : () => false;
  const keptDownTo = Number.isFinite(options.keptDownTo) ? options.keptDownTo : null;
  const doorSteps = new Map();
  for (const door of options.doors || []) {
    const top = Math.max(door.floor, door.ground);
    doorSteps.set(`${door.cx},${door.cz}|${door.dx},${door.dz}`, top);
    doorSteps.set(`${door.cx + door.dx},${door.cz + door.dz}|${-door.dx},${-door.dz}`, top);
  }
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

  const shifted = (gx, gz) => {
    if (!shiftAt) return { x: gx, z: gz };
    const shift = shiftAt(gx, gz);
    return shift ? { x: gx + shift.x, z: gz + shift.z } : { x: gx, z: gz };
  };

  const sideQuad = (group, cx, cz, dx, dz, a0, a1, bottomA, bottomB, topA, topB, tile, layer, faceBottom, faceTop, inset = 0) => {
    const x0 = cx * cellSize - half;
    const z0 = cz * cellSize - half;
    const place = inset ? (gx, gz) => ({ x: gx, z: gz }) : shifted;
    const start = group.positions.length / 3;
    const seed = layer === null ? Math.round(bottomA / PLATE) : layer;
    const span = Math.max(1e-4, faceTop - faceBottom);
    const depthT = (value) => Math.min(1, Math.max(0, (value - faceBottom) / span));
    let heights;
    if (dx !== 0) {
      const x = (dx > 0 ? x0 + cellSize : x0) - dx * inset;
      const za = z0 + cellSize * a0;
      const zb = z0 + cellSize * a1;
      const pa = place(x, za);
      const pb = place(x, zb);
      if (dx > 0) {
        group.positions.push(pa.x, bottomA, pa.z, pa.x, topA, pa.z, pb.x, topB, pb.z, pb.x, bottomB, pb.z);
        heights = [bottomA, topA, topB, bottomB];
      } else {
        group.positions.push(pb.x, bottomB, pb.z, pb.x, topB, pb.z, pa.x, topA, pa.z, pa.x, bottomA, pa.z);
        heights = [bottomB, topB, topA, bottomA];
      }
      group.uvs.push(...layerUvs([za / tile, bottomA / tile, za / tile, topA / tile, zb / tile, topB / tile, zb / tile, bottomB / tile], seed));
    } else {
      const z = (dz > 0 ? z0 + cellSize : z0) - dz * inset;
      const xa = x0 + cellSize * a0;
      const xb = x0 + cellSize * a1;
      const pa = place(xa, z);
      const pb = place(xb, z);
      if (dz > 0) {
        group.positions.push(pb.x, bottomB, pb.z, pb.x, topB, pb.z, pa.x, topA, pa.z, pa.x, bottomA, pa.z);
        heights = [bottomB, topB, topA, bottomA];
      } else {
        group.positions.push(pa.x, bottomA, pa.z, pa.x, topA, pa.z, pb.x, topB, pb.z, pb.x, bottomB, pb.z);
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

  const sideFace = (cx, cz, dx, dz, y0, y1, key, openEdge = false, reach = depth) => {
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
    const bottom = openEdge ? Math.max(y0, lowTop - EDGE_DEPTH) : y0 - reach;
    const tops = heights.map((value) => Math.max(value, bottom));
    const faceTop = Math.max(...tops);
    if (bottom >= faceTop - EPS) return;
    const rockTop = Math.max(bottom, Math.floor((lowTop - bandDepth) / PLATE + 1e-6) * PLATE);
    const rockFrom = Math.max(bottom, rockTop - PLATE_SPAN);
    const rock = bucketOf(cx, cz, 'cliff', style);
    const band = bucketOf(cx, cz, 'soil', key);
    const rockSpan = (b0, b1) => {
      for (let i = 0; i < subdivisions; i += 1) {
        sideQuad(rock, cx, cz, dx, dz, i / subdivisions, (i + 1) / subdivisions, b0, b0, b1, b1, rockTile, null, bottom, faceTop);
      }
    };
    if (rockFrom > bottom + EPS) rockSpan(bottom, rockFrom);
    for (const [b, t] of plateBands(rockFrom, rockTop)) rockSpan(b, t);
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

  const caveAt = (cx, cz) => (air.get(`${cx},${cz}`) || []).some((span) => span.level < 0);

  const buriedFace = (cx, cz, dx, dz, y0, y1) => {
    const style = styleOf(cx, cz) || 'dirt';
    const rockTile = tileOf('cliff', style);
    const rock = bucketOf(cx, cz, 'cliff', style);
    const tops = [];
    for (let i = 0; i <= subdivisions; i += 1) {
      const p = boundaryAt(cx, cz, dx, dz, i / subdivisions);
      const height = surface ? surface(p.gx, p.gz, cx, cz, dx, dz, y1) : y1;
      tops.push(Math.max(y0, Math.min(y1, height - SURFACE_CLEARANCE)));
    }
    const rockTop = Math.max(y0, Math.floor(Math.min(...tops) / PLATE + 1e-6) * PLATE);
    const alongX = dx !== 0 ? 0 : 1;
    const alongZ = dx !== 0 ? 1 : 0;
    const reach = BURIED_WALL_INSET / cellSize;
    const coversWall = (x, z) => !caveAt(x, z) && (solids.get(`${x},${z}`) || []).some(([, top]) => top >= y1 - EPS);
    const startA = coversWall(cx - alongX, cz - alongZ) ? -reach : 0;
    const endA = coversWall(cx + alongX, cz + alongZ) ? 1 + reach : 1;
    for (let i = 0; i < subdivisions; i += 1) {
      const a0 = i === 0 ? startA : i / subdivisions;
      const a1 = i === subdivisions - 1 ? endA : (i + 1) / subdivisions;
      for (const [b, t] of plateBands(y0, rockTop)) {
        sideQuad(rock, cx, cz, dx, dz, a0, a1, b, b, t, t, rockTile, null, y0, y1, BURIED_WALL_INSET);
      }
      if (tops[i] > rockTop + EPS || tops[i + 1] > rockTop + EPS) {
        sideQuad(rock, cx, cz, dx, dz, a0, a1, rockTop, rockTop, tops[i], tops[i + 1], rockTile, null, y0, y1, BURIED_WALL_INSET);
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
          const doorTop = doorSteps.get(`${id}|${dx},${dz}`);
          for (const piece of overlapPieces(neighborAir, y0, y1)) {
            if (doorTop !== undefined && piece.top <= doorTop + EPS) continue;
            if (piece.level >= 0) {
              const overDoor = ownAir.some((span) => span.level < 0 && Math.abs(span.top - piece.bottom) <= EPS);
              sideFace(cx, cz, dx, dz, piece.bottom, piece.top, floorKey(cx, cz, 0), false, overDoor ? DOOR_LINTEL_DEPTH : depth);
              continue;
            }
            const ownFloor = ownAir.find((span) => span.level === piece.level);
            if (ownFloor && piece.top <= ownFloor.bottom + EPS && !hardEdge(cx, cz, dx, dz, piece.level)) continue;
            const key = floorKey(nx, nz, piece.level);
            const caveWall = bucketOf(cx, cz, 'cave', key);
            const caveTile = tileOf('cave', key);
            for (const [b, t] of plateBands(piece.bottom - CAVE_WALL_SKIRT, piece.top)) {
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

  if (keptDownTo !== null) {
    for (const [id, runs] of solids) {
      const [cx, cz] = id.split(',').map(Number);
      if (caveAt(cx, cz)) continue;
      const kept = keptAt(cx, cz);
      for (const [dx, dz] of DIRECTIONS) {
        if (!caveAt(cx + dx, cz + dz) && (!kept || keptAt(cx + dx, cz + dz))) continue;
        for (const [neighborBottom, neighborTop] of solids.get(`${cx + dx},${cz + dz}`) || []) {
          for (const [bottom, top] of runs) {
            const y0 = Math.max(bottom, neighborBottom, keptDownTo - CAVE_WALL_SKIRT);
            const y1 = Math.min(top, neighborTop);
            if (y1 - y0 > EPS) buriedFace(cx, cz, dx, dz, y0, y1);
          }
        }
      }
    }
  }

  return buckets;
}
