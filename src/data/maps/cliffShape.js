// Výška terénu na okraji mapy — útesový rám se odvozuje z polohy buňky.
// Deterministické: stejná buňka = stejná výška, bez ohledu na zóny.
const SIDES = [
  { dx: 0, dz: 1, dir: 2 },
  { dx: 1, dz: 0, dir: 3 },
  { dx: 0, dz: -1, dir: 0 },
  { dx: -1, dz: 0, dir: 1 },
];

function cellHash(cx, cz, salt) {
  let h = (cx * 73856093) ^ (cz * 19349663) ^ (salt * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % 100;
}

export function edgeProjection(cx, cz, limit) {
  const kx = limit - Math.abs(cx);
  const kz = limit - Math.abs(cz);
  if (kx <= kz) return { ex: cx > 0 ? limit : -limit, ez: cz, k: kx };
  return { ex: cx, ez: cz > 0 ? limit : -limit, k: kz };
}

export function edgeDepth(ex, ez) {
  return 3 + (cellHash(ex, ez, 6) % 3);
}

export function surfaceHeight(cx, cz, limit, carve = 0, pathCells = null, overrides = null) {
  if (Math.abs(cx) > limit || Math.abs(cz) > limit) return 0;
  if (overrides) {
    const forced = overrides.get(`${cx},${cz}`);
    if (forced !== undefined) return forced;
  }
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

export function cornerCells(limit) {
  return [
    [-limit, -limit],
    [limit, -limit],
    [-limit, limit],
    [limit, limit],
  ];
}

export function faceTile(cx, cz, limit) {
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

export function pieceTurn(key, piece) {
  if (key === 'cliff_slope' || key === 'cliff_slopeWalls' || key === 'cliff_steps') {
    return (piece.rotation + 2) % 4;
  }
  return piece.rotation;
}

export function blockStack(height) {
  if (height >= 4) return [['cliff_levelHigh', 0], ['cliff_levelHigh', 2]];
  if (height === 3) return [['cliff_levelHigh', 0], ['cliff_levelMid', 2]];
  if (height === 2) return [['cliff_levelHigh', 0]];
  return [['cliff_levelMid', 0]];
}

export function pathDistance(cx, cz, pathCells, maxDist) {
  let best = maxDist + 1;
  for (const cell of pathCells) {
    const [px, pz] = String(cell).split(',').map(Number);
    const d = Math.max(Math.abs(cx - px), Math.abs(cz - pz));
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

export function pickupRampKey(cx, cz) {
  if (cellHash(cx, cz, 9) >= 60) return 'cliff_steps';
  return cellHash(cx, cz, 47) < 50 ? 'cliff_slope' : 'cliff_slopeWalls';
}

export function rampPlan(cx, cz, limit, carve = 0, pathCells = null, overrides = null) {
  const height = surfaceHeight(cx, cz, limit, carve, pathCells, overrides);
  if (height < 3) return null;
  if (cellHash(cx, cz, 7) >= 8) return null;

  const { ex, ez, k } = edgeProjection(cx, cz, limit);
  const kx = limit - Math.abs(cx);
  const kz = limit - Math.abs(cz);
  if (Math.min(kx, kz) !== k) return null;

  const dirX = ex === limit ? -1 : ex === -limit ? 1 : 0;
  const dirZ = ez === limit ? -1 : ez === -limit ? 1 : 0;

  const upward = surfaceHeight(cx - dirX, cz - dirZ, limit, carve, pathCells, overrides);
  const downward = surfaceHeight(cx + dirX, cz + dirZ, limit, carve, pathCells, overrides);
  if (upward !== height + 1) return null;
  if (downward !== height - 1) return null;

  return { key: pickupRampKey(cx, cz), liftY: height - 1 };
}

export const DIAG_SIDES = [
  { dx: -1, dz: 1, dir: 2 },
  { dx: 1, dz: 1, dir: 3 },
  { dx: 1, dz: -1, dir: 0 },
  { dx: -1, dz: -1, dir: 1 },
];

export { SIDES };

export function ridgeLevels(decorations, overrides = null) {
  const levels = new Map();
  if (overrides) for (const [key, height] of overrides) if (height > 0) levels.set(key, height);
  for (const entry of decorations) {
    if (!entry.key.startsWith('cliff_level')) continue;
    const key = `${entry.cx},${entry.cz}`;
    if (overrides && overrides.has(key)) continue;
    const height = (entry.liftY || 0) + (entry.key === 'cliff_levelHigh' ? 2 : 1);
    levels.set(key, Math.max(levels.get(key) || 0, height));
  }
  return levels;
}

export function flankStack(from, to) {
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

export function cornerKey(part) {
  return part === 'cliff_top' ? 'cliff_cornerTop' : 'cliff_cornerHalf';
}

