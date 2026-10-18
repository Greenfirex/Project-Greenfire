// Instance mapy „Temný hvozd" — rozvržení lesní mýtiny.
// Rozvržení se generuje deterministicky ze seedu v katalogu maps.js, žádná logika hry.
import { MAPS } from '../catalogs/maps.js';
import { createRng, pick, shuffle } from '../../utils/rng.js';
import { pathKeyAt } from '../../utils/pathTiles.js';

const TREE_POOL = [
  'tree_pine_tall', 'tree_pine_tall_b', 'tree_pine_tall_c',
  'tree_pine_round', 'tree_pine_round_c', 'tree_pine_small',
  'tree_default', 'tree_oak', 'tree_thin', 'tree_fat',
  'tree_cone', 'tree_detailed', 'tree_blocks', 'tree_plateau',
  'tree_simple', 'tree_small', 'tree_tall',
];

const CLEARING_DETAIL_POOL = [
  'grass', 'grass', 'grass', 'grass_leafs', 'grass_leafs',
  'bush', 'bush_small', 'mushroom_red', 'mushroom_tan',
  'flower', 'flower_red', 'rock_small', 'rock_small_flat', 'stump',
];

const RIM_PROP_POOL = ['rock_large', 'rock_large_c', 'rock_tall', 'stump_old', 'log'];

function isInsideClearing(map, cx, cz) {
  const dx = cx - map.clearingCenter.cx;
  const dz = cz - map.clearingCenter.cz;
  return Math.sqrt(dx * dx + dz * dz) <= map.clearingRadius;
}

function makeEntry(key, cx, cz, rng) {
  const jitterX = Math.round(rng() * 100) / 100 - 0.5;
  const jitterZ = Math.round(rng() * 100) / 100 - 0.5;
  return {
    key,
    cx,
    cz,
    offsetX: jitterX * 0.7,
    offsetZ: jitterZ * 0.7,
    rotation: Math.floor(rng() * 4),
  };
}

function makeTile(key, cx, cz, rotation, liftY = 0) {
  return { key, cx, cz, offsetX: 0, offsetZ: 0, rotation: rotation || 0, liftY };
}

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const PATH_GAP = 4;

function hillCells(rng, map, limit, occupied, pathCells) {
  const entries = [];
  const clusters = 14 + Math.floor(rng() * 8);
  const reach = limit - 3;

  for (let c = 0; c < clusters; c++) {
    const seedX = Math.max(-reach, Math.min(reach, Math.floor((rng() * 2 - 1) * limit)));
    const seedZ = Math.max(-reach, Math.min(reach, Math.floor((rng() * 2 - 1) * limit)));
    const size = 6 + Math.floor(rng() * 7);
    const queue = [[seedX, seedZ]];
    const cells = [];

    while (queue.length && cells.length < size) {
      const [hx, hz] = queue.shift();
      const id = `${hx},${hz}`;
      if (Math.abs(hx) > reach || Math.abs(hz) > reach) continue;
      if (occupied.has(id) || pathCells.has(id)) continue;
      if (isInsideClearing(map, hx, hz)) continue;
      if (pathDistance(hx, hz, pathCells, PATH_GAP) < PATH_GAP) continue;

      const dx = hx - map.clearingCenter.cx;
      const dz = hz - map.clearingCenter.cz;
      if (Math.sqrt(dx * dx + dz * dz) - map.clearingRadius < 2) continue;

      occupied.add(id);
      cells.push([hx, hz]);

      for (const [ox, oz] of ORTHO) {
        const nx = hx + ox;
        const nz = hz + oz;
        if (Math.abs(nx - seedX) > 3 || Math.abs(nz - seedZ) > 3) continue;
        if (rng() > 0.25) queue.push([nx, nz]);
      }
    }

    if (cells.length < 3) continue;

    const members = new Set(cells.map(([mx, mz]) => `${mx},${mz}`));
    for (const [hx, hz] of cells) {
      let open = 0;
      for (const [ox, oz] of ORTHO) {
        if (!members.has(`${hx + ox},${hz + oz}`)) open++;
      }
      const key = open <= 1 ? 'cliff_levelHigh' : 'cliff_levelMid';
      entries.push(makeTile(key, hx, hz, 0));
    }
  }

  return entries;
}

export function buildGladeLayout(mapKey) {
  const map = MAPS[mapKey];
  if (!map) return { floor: [], decorations: [], blocked: [], path: [], clearing: [] };

  const rng = createRng(map.seed);
  const limit = Math.floor(map.groundSize / 2) - 1;

  const floor = [];
  const decorations = [];
  const blocked = [];
  const path = [];
  const clearing = [];
  const occupied = new Set();
  const pathCells = new Set();

  const reserve = (cx, cz) => occupied.add(`${cx},${cz}`);

  for (let cx = -limit; cx <= limit; cx++) {
    for (let cz = -limit; cz <= limit; cz++) {
      floor.push(makeTile('floor_grass', cx, cz, 0));
    }
  }

  for (const raw of buildPath(map, limit)) {
    pathCells.add(`${raw.cx},${raw.cz}`);
  }
  for (const cell of pathCells) {
    const [px, pz] = cell.split(',').map(Number);
    const tile = pathKeyAt(pathCells, px, pz);
    path.push(makeTile(tile.key, px, pz, tile.rotation));
    reserve(px, pz);
  }

  for (const entry of buildCamp(map, rng)) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
    blocked.push({ cx: entry.cx, cz: entry.cz, radius: 0.8 });
  }

  const borderCliffs = buildBorderCliffs(limit, pathCells);
  const rampCells = new Set();
  for (const entry of borderCliffs) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
    if (entry.blocks) {
      blocked.push({ cx: entry.cx, cz: entry.cz, radius: 1.2 });
    } else if (entry.key.startsWith('cliff_slope') || entry.key.startsWith('cliff_steps')) {
      rampCells.add(`${entry.cx},${entry.cz}`);
    }
  }

  for (const [ccx, ccz] of cornerCells(limit)) {
    rampCells.add(`${ccx},${ccz}`);
  }

  for (const entry of hillCells(rng, map, limit, occupied, pathCells)) {
    decorations.push(entry);
    blocked.push({ cx: entry.cx, cz: entry.cz, radius: 1.2 });
  }

  for (const entry of buildRidgeFlanks(decorations, limit, rampCells)) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
  }

  const ridgeCorners = buildRidgeCorners(decorations, limit, rampCells);
  for (const entry of ridgeCorners) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
  }

  for (const entry of buildRimProps(map, rng, limit, occupied)) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
    blocked.push({ cx: entry.cx, cz: entry.cz, radius: 0.9 });
  }

  for (const entry of buildClearing(map, rng, occupied)) {
    clearing.push(entry);
    reserve(entry.cx, entry.cz);
  }

  for (const entry of buildForest(map, rng, limit, occupied)) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
    blocked.push({ cx: entry.cx, cz: entry.cz, radius: entry.radius });
  }

  for (const entry of buildGroundDetails(rng, limit, occupied)) {
    decorations.push(entry);
    reserve(entry.cx, entry.cz);
  }

  return { floor, decorations, blocked, path, clearing };
}

const PATH_CAMP_GAP = 3;

function buildPath(map, limit) {
  const entries = [];
  const startCz = -limit;
  const endCz = map.clearingCenter.cz - PATH_CAMP_GAP;
  const bendCz = Math.max(startCz + 2, Math.min(endCz - 2, Math.round((startCz + endCz) / 2)));
  const bendCx = map.clearingCenter.cx - 2;

  for (let cz = startCz; cz <= bendCz; cz++) {
    entries.push({ cx: bendCx, cz });
  }

  for (let cx = bendCx; cx <= map.clearingCenter.cx; cx++) {
    entries.push({ cx, cz: bendCz + 1 });
  }

  for (let cz = bendCz + 2; cz <= endCz; cz++) {
    entries.push({ cx: map.clearingCenter.cx, cz });
  }

  return entries;
}

function buildBorderCliffs(limit, pathCells) {
  const entries = [];
  const occupied = new Set();
  const isFree = (cx, cz) => !pathCells.has(`${cx},${cz}`);
  const inGap = (cx, cz) => pathDistance(cx, cz, pathCells, PATH_GAP) < PATH_GAP;
  const heightAt = (cx, cz) => surfaceHeight(cx, cz, limit, PATH_GAP, pathCells);
  const reserve = (cx, cz) => {
    const key = `${cx},${cz}`;
    if (occupied.has(key)) return false;
    if (Math.abs(cx) > limit || Math.abs(cz) > limit) return false;
    occupied.add(key);
    return true;
  };
  const own = (cx, cz) => {
    const key = `${cx},${cz}`;
    if (occupied.has(key)) return true;
    if (Math.abs(cx) > limit || Math.abs(cz) > limit) return false;
    occupied.add(key);
    return true;
  };

  for (const [cx, cz] of cornerCells(limit)) {
    if (!isFree(cx, cz)) continue;
    if (!reserve(cx, cz)) continue;

    const height = heightAt(cx, cz);
    if (height <= 0) continue;

    for (const [part, lift] of blockStack(height)) {
      const slab = makeTile(part, cx, cz, 0, lift);
      slab.blocks = true;
      entries.push(slab);
    }
  }

  for (let cz = -limit; cz <= limit; cz++) {
    for (let cx = -limit; cx <= limit; cx++) {
      const inner = faceTile(cx, cz, limit);
      if (!inner) continue;
      if (!isFree(cx, cz)) continue;
      if (!own(cx, cz)) continue;

      const piece = { rotation: inner.rotation, inDx: inner.dx, inDz: inner.dz };
      const edgeHeight = heightAt(cx, cz);
      if (edgeHeight <= 0) continue;

      for (const [part, lift] of blockStack(edgeHeight)) {
        const slab = makeTile(part, cx, cz, 0, lift);
        slab.blocks = true;
        entries.push(slab);
      }

      const depth = edgeDepth(cx, cz);
      for (let k = 1; k < depth; k++) {
        const tx = cx + inner.dx * k;
        const tz = cz + inner.dz * k;
        if (inGap(tx, tz)) break;
        const height = heightAt(tx, tz);
        if (height <= 0) break;
        if (!isFree(tx, tz)) break;
        if (!reserve(tx, tz)) break;

        const ramp = rampPlan(tx, tz, limit, PATH_GAP, pathCells);
        if (ramp) {
          for (const [part, lift] of blockStack(ramp.liftY)) {
            const base = makeTile(part, tx, tz, pieceTurn(part, piece), lift);
            base.blocks = true;
            entries.push(base);
          }
          const tile = makeTile(ramp.key, tx, tz, pieceTurn(ramp.key, piece), ramp.liftY);
          tile.blocks = false;
          entries.push(tile);
          continue;
        }

        for (const [part, lift] of blockStack(height)) {
          const tile = makeTile(part, tx, tz, pieceTurn(part, piece), lift);
          tile.blocks = true;
          entries.push(tile);
        }
      }
    }
  }

  return entries;
}


function ridgeLevels(decorations) {
  const levels = new Map();
  for (const entry of decorations) {
    if (!entry.key.startsWith('cliff_level')) continue;
    const key = `${entry.cx},${entry.cz}`;
    const height = (entry.liftY || 0) + (entry.key === 'cliff_levelHigh' ? 2 : 1);
    levels.set(key, Math.max(levels.get(key) || 0, height));
  }
  return levels;
}

function buildRidgeFlanks(decorations, limit, rampCells) {
  const levels = ridgeLevels(decorations);
  const entries = [];
  const placed = new Set();

  for (const [key, height] of levels) {
    const [cx, cz] = key.split(',').map(Number);

    for (const side of SIDES) {
      const nx = cx + side.dx;
      const nz = cz + side.dz;
      if (Math.abs(nx) > limit || Math.abs(nz) > limit) continue;
      const nkey = `${nx},${nz}`;
      if (rampCells.has(nkey)) continue;
      const neighbour = levels.get(nkey) || 0;
      if (neighbour >= height) continue;
      if (height - neighbour > 2) continue;
      for (const [part, lift] of flankStack(neighbour, height)) {
        const slot = `${nkey},${side.dir},${lift}`;
        if (placed.has(slot)) continue;
        placed.add(slot);
        const flank = makeTile(part, nx, nz, side.dir, lift);
        flank.blocks = false;
        entries.push(flank);
      }
    }
  }
  return entries;
}

function buildRidgeCorners(decorations, limit, rampCells) {
  const levels = ridgeLevels(decorations);
  const flankCells = new Set();
  for (const entry of decorations) {
    if (entry.key !== 'cliff_top' && entry.key !== 'cliff_half') continue;
    flankCells.add(`${entry.cx},${entry.cz}`);
  }

  const entries = [];
  const placed = new Set();

  for (const [key, height] of levels) {
    if (height < 1) continue;
    const [cx, cz] = key.split(',').map(Number);

    for (const side of DIAG_SIDES) {
      const nx = cx + side.dx;
      const nz = cz + side.dz;
      if (Math.abs(nx) > limit || Math.abs(nz) > limit) continue;
      const nkey = `${nx},${nz}`;
      if (rampCells.has(nkey)) continue;
      const neighbour = levels.get(nkey) || 0;
      if (neighbour >= height) continue;
      if (height - neighbour > 2) continue;
      if (flankCells.has(nkey)) continue;

      for (const [part, lift] of flankStack(neighbour, height)) {
        const slot = `${nkey},${side.dir},${lift}`;
        if (placed.has(slot)) continue;
        placed.add(slot);
        const corner = makeTile(cornerKey(part), nx, nz, side.dir, lift);
        corner.blocks = false;
        entries.push(corner);
      }
    }
  }
  return entries;
}

function cornerKey(part) {
  return part === 'cliff_top' ? 'cliff_cornerTop' : 'cliff_cornerHalf';
}

function flankStack(from, to) {
  const parts = [];
  let level = from;
  while (level < to) {
    if (to - level >= 2) {
      parts.push(['cliff_top', level]);
      level += 2;
    } else {
      parts.push(['cliff_half', level]);
      level += 1;
    }
  }
  return parts;
}

const SIDES = [
  { dx: 0, dz: 1, dir: 2 },
  { dx: 1, dz: 0, dir: 3 },
  { dx: 0, dz: -1, dir: 0 },
  { dx: -1, dz: 0, dir: 1 },
];

const DIAG_SIDES = [
  { dx: -1, dz: 1, dir: 2 },
  { dx: 1, dz: 1, dir: 3 },
  { dx: 1, dz: -1, dir: 0 },
  { dx: -1, dz: -1, dir: 1 },
];

function faceTile(cx, cz, limit) {
  const onX = cx === limit || cx === -limit;
  const onZ = cz === limit || cz === -limit;
  if (onX && onZ) return null;

  for (const side of SIDES) {
    const on = side.dx === 1 ? cx === limit
      : side.dx === -1 ? cx === -limit
        : side.dz === 1 ? cz === limit
          : cz === -limit;
    if (!on) continue;
    return { dx: -side.dx, dz: -side.dz, rotation: side.dir };
  }
  return null;
}

function cellHash(cx, cz, salt) {
  let h = (cx * 73856093) ^ (cz * 19349663) ^ (salt * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % 100;
}

function pieceTurn(key, piece) {
  if (key === 'cliff_slope' || key === 'cliff_slopeWalls' || key === 'cliff_steps') {
    return (piece.rotation + 2) % 4;
  }
  return piece.rotation;
}

function edgeProjection(cx, cz, limit) {
  const kx = limit - Math.abs(cx);
  const kz = limit - Math.abs(cz);
  if (kx <= kz) return { ex: cx > 0 ? limit : -limit, ez: cz, k: kx };
  return { ex: cx, ez: cz > 0 ? limit : -limit, k: kz };
}

function edgeDepth(ex, ez) {
  return 3 + (cellHash(ex, ez, 6) % 3);
}

function pathDistance(cx, cz, pathCells, maxDist) {
  let best = maxDist + 1;
  for (const cell of pathCells) {
    const [px, pz] = cell.split(',').map(Number);
    const d = Math.max(Math.abs(cx - px), Math.abs(cz - pz));
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

function surfaceHeight(cx, cz, limit, carve = 0, pathCells = null) {
  if (Math.abs(cx) > limit || Math.abs(cz) > limit) return 0;
  const { ex, ez, k } = edgeProjection(cx, cz, limit);
  const top = cellHash(ex, ez, 5) < 55 ? 4 : 3;
  if (k >= edgeDepth(ex, ez)) return 0;

  const along = Math.abs(ex) === limit ? cz : cx;
  const salt = Math.abs(ex) === limit ? 20 : 60;

  let height = top;
  for (let i = 1; i <= k; i++) {
    height -= cellHash(along, i * 7 + salt, 33) >= 62 ? 2 : 1;
    if (height <= 0) return 0;
  }

  if (carve > 0 && pathCells) {
    const dist = pathDistance(cx, cz, pathCells, carve);
    if (dist < carve) {
      height -= carve - dist;
      if (height <= 0) return 0;
    }
  }
  return height;
}

function rampPlan(cx, cz, limit, carve = 0, pathCells = null) {
  const height = surfaceHeight(cx, cz, limit, carve, pathCells);
  if (height < 3) return null;
  if (cellHash(cx, cz, 7) >= 8) return null;

  const { ex, ez, k } = edgeProjection(cx, cz, limit);
  const kx = limit - Math.abs(cx);
  const kz = limit - Math.abs(cz);
  if (Math.min(kx, kz) !== k) return null;

  const dirX = ex === limit ? -1 : ex === -limit ? 1 : 0;
  const dirZ = ez === limit ? -1 : ez === -limit ? 1 : 0;

  const upward = surfaceHeight(cx - dirX, cz - dirZ, limit, carve, pathCells);
  const downward = surfaceHeight(cx + dirX, cz + dirZ, limit, carve, pathCells);
  if (upward !== height + 1) return null;
  if (downward !== height - 1) return null;

  return {
    key: pickupRampKey(cx, cz),
    liftY: height - 1,
  };
}

function pickupRampKey(cx, cz) {
  if (cellHash(cx, cz, 9) >= 60) return 'cliff_steps';
  return cellHash(cx, cz, 47) < 50 ? 'cliff_slope' : 'cliff_slopeWalls';
}

function blockStack(height) {
  if (height >= 4) return [['cliff_levelHigh', 0], ['cliff_levelHigh', 2]];
  if (height === 3) return [['cliff_levelHigh', 0], ['cliff_levelMid', 2]];
  if (height === 2) return [['cliff_levelHigh', 0]];
  return [['cliff_levelMid', 0]];
}

function cornerCells(limit) {
  return [
    [-limit, -limit],
    [limit, -limit],
    [-limit, limit],
    [limit, limit],
  ];
}

function buildCamp(map, rng) {
  const base = map.clearingCenter;
  const campfire = makeEntry('campfire', base.cx, base.cz, rng);
  const logStack = makeEntry('log_stack', base.cx - 2, base.cz + 1, rng);
  const tent = makeEntry('tent', base.cx + 2, base.cz - 1, rng);
  const crate = makeEntry('crate', base.cx + 1, base.cz + 2, rng);
  const barrel = makeEntry('barrel', base.cx - 1, base.cz - 2, rng);
  return [campfire, logStack, tent, crate, barrel];
}

function buildRimProps(map, rng, limit, occupied) {
  const entries = [];
  for (let cx = -limit; cx <= limit; cx++) {
    for (let cz = -limit; cz <= limit; cz++) {
      if (occupied.has(`${cx},${cz}`)) continue;
      if (isInsideClearing(map, cx, cz)) continue;
      const dx = cx - map.clearingCenter.cx;
      const dz = cz - map.clearingCenter.cz;
      const ring = Math.sqrt(dx * dx + dz * dz) - map.clearingRadius;
      if (ring > 5) continue;
      if (rng() > 0.12) continue;
      const key = pick(rng, RIM_PROP_POOL);
      entries.push(makeEntry(key, cx, cz, rng));
    }
  }
  return entries;
}

function buildClearing(map, rng, occupied) {
  const entries = [];
  const detailCount = Math.round(map.clearingRadius * map.clearingRadius * 0.35);
  let attempts = 0;

  while (entries.length < detailCount && attempts < detailCount * 4) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * map.clearingRadius;
    const cx = Math.round(map.clearingCenter.cx + Math.cos(angle) * dist);
    const cz = Math.round(map.clearingCenter.cz + Math.sin(angle) * dist);
    if (occupied.has(`${cx},${cz}`)) continue;
    const key = pick(rng, CLEARING_DETAIL_POOL);
    const entry = makeEntry(key, cx, cz, rng);
    entries.push(entry);
    occupied.add(`${cx},${cz}`);
  }

  return entries;
}

function buildForest(map, rng, limit, occupied) {
  const entries = [];
  const pool = shuffle(rng, TREE_POOL);

  const candidates = [];
  for (let cx = -limit; cx <= limit; cx++) {
    for (let cz = -limit; cz <= limit; cz++) {
      if (occupied.has(`${cx},${cz}`)) continue;
      if (isInsideClearing(map, cx, cz)) continue;

      const dx = cx - map.clearingCenter.cx;
      const dz = cz - map.clearingCenter.cz;
      const ring = Math.sqrt(dx * dx + dz * dz) - map.clearingRadius;

      candidates.push({ cx, cz, ring, order: rng() });
    }
  }

  candidates.sort((a, b) => a.order - b.order);

  const near = candidates.filter((c) => c.ring < 4);
  const far = candidates.filter((c) => c.ring >= 4);
  const nearCount = Math.min(near.length, 60);
  const farCount = Math.min(far.length, 140);

  const chosen = [...near.slice(0, nearCount), ...far.slice(0, farCount)];

  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    const key = pool[i % pool.length];
    const entry = makeEntry(key, c.cx, c.cz, rng);
    entry.radius = 0.9;
    entries.push(entry);
  }

  return entries;
}

function buildGroundDetails(rng, limit, occupied) {
  const entries = [];
  for (let cx = -limit; cx <= limit; cx++) {
    for (let cz = -limit; cz <= limit; cz++) {
      if (occupied.has(`${cx},${cz}`)) continue;
      if (rng() > 0.14) continue;
      const key = pick(rng, ['grass', 'grass_leafs', 'bush_small', 'mushroom_red', 'flower']);
      entries.push(makeEntry(key, cx, cz, rng));
    }
  }
  return entries;
}
