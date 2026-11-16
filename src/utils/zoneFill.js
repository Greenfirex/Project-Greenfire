// Vyplňování zón — ze seznamu buněk a předpisu brushu udělá konkrétní dekorace.
// Tři tvary: blob (plošné vyplnění), line (spojitá trasa), outline_fill (vnitřek + lem).

import { pick } from './rng.js';

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function key(cx, cz) {
  return `${cx},${cz}`;
}

function parse(k) {
  const s = String(k);
  const i = s.indexOf(',');
  return [Number(s.slice(0, i)), Number(s.slice(i + 1))];
}

function neighborsOf(k, cells) {
  const [cx, cz] = parse(k);
  return ORTHO.map(([dx, dz]) => cells.has(key(cx + dx, cz + dz)));
}

function isInner(k, cells) {
  return neighborsOf(k, cells).every(Boolean);
}

function edgeCells(cells) {
  const set = cells instanceof Set ? cells : new Set([...cells].map((k) => String(k)));
  return [...set].filter((k) => !isInner(k, set));
}

function sortedCells(cells) {
  return [...cells].sort((a, b) => {
    const [ax, az] = parse(a);
    const [bx, bz] = parse(b);
    return az - bz || ax - bx;
  });
}

function cellRng(makeRng, k) {
  return makeRng(k);
}

function fillBlob(makeRng, brush, cells) {
  if (!cells.length) return [];

  const pool = brush.pool && brush.pool.length
    ? brush.pool
    : [...new Set(Object.values(brush.poolByStyle || {}).flat())];

  const out = cells.map((k) => parse(k));
  if (!pool.length) return out.map(([cx, cz]) => ({ cx, cz }));
  const cluster = brush.cluster;
  const entries = [];
  for (const [cx, cz] of out) {
    const local = cellRng(makeRng, key(cx, cz));
    if (brush.fill && local() > brush.fill) continue;
    const species = pick(local, pool);
    if (!cluster) {
      entries.push({ cx, cz, key: species });
      continue;
    }
    const amount = cluster.min
      + Math.floor(local() * Math.max(1, cluster.max - cluster.min + 1));
    for (let index = 0; index < amount; index += 1) {
      const entry = {
        cx,
        cz,
        key: species,
        offsetX: Math.round((local() - 0.5) * cluster.spread * 2 * 100) / 100,
        offsetZ: Math.round((local() - 0.5) * cluster.spread * 2 * 100) / 100,
        scale: Math.round((cluster.scaleMin + local() * (cluster.scaleMax - cluster.scaleMin)) * 100) / 100,
      };
      entries.push(entry);
    }
  }
  return entries;
}

function fillLine(makeRng, brush, cells) {
  if (!cells.length) return [];
  const set = new Set(cells);
  const ends = [...set].filter((k) => neighborsOf(k, set).filter(Boolean).length <= 1);
  const order = [];
  const seen = new Set();
  const starts = ends.length ? ends : [sortedCells(set)[0]];

  for (const start of starts) {
    if (seen.has(start)) continue;
    let current = start;
    while (current && !seen.has(current)) {
      seen.add(current);
      order.push(current);
      const [cx, cz] = parse(current);
      const [next] = ORTHO
        .map(([dx, dz]) => key(cx + dx, cz + dz))
        .filter((n) => set.has(n) && !seen.has(n));
      current = next || null;
    }
  }

  for (const k of set) if (!seen.has(k)) order.push(k);

  const out = [];
  for (const k of order) {
    const [cx, cz] = parse(k);
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
    out.push({ cx, cz });
  }

  const dedup = new Map();
  for (const cell of out) dedup.set(key(cell.cx, cell.cz), cell);
  return [...dedup.values()];
}

function fillOutline(makeRng, brush, cells) {
  if (!brush.bed && !brush.inner && !brush.edge) {
    return cells.map((k) => {
      const [cx, cz] = parse(k);
      return { cx, cz };
    });
  }

  const set = new Set(cells);
  const edge = new Set(edgeCells(cells));
  const out = [];

  for (const k of cells) {
    if (edge.has(k)) continue;
    const [cx, cz] = parse(k);
    const local = cellRng(makeRng, k);
    if (brush.bed) out.push({ cx, cz, key: pick(local, brush.bed.pool), liftY: brush.bed.liftY ?? 0 });
    if (brush.inner) out.push({ cx, cz, key: pick(local, brush.inner.pool), liftY: brush.inner.liftY ?? 0 });
  }

  for (const k of edge) {
    const [cx, cz] = parse(k);
    const local = cellRng(makeRng, k);
    const neighbours = neighborsOf(k, set);
    const dry = neighbours.map((has, i) => (has ? -1 : i)).filter((i) => i >= 0);
    const rotation = brush.edge.rotateToDry && dry.length ? (dry[0] + 2) % 4 : 0;
    out.push({ cx, cz, key: pick(local, brush.edge.pool), rotation, liftY: brush.edge.liftY ?? 0 });
  }

  return out;
}

export function fillZone(makeRng, brush, cells) {
  const list = [...cells].map((k) => String(k));
  switch (brush.shape) {
    case 'line':
      return fillLine(makeRng, brush, list);
    case 'outline_fill':
      return fillOutline(makeRng, brush, list);
    default:
      return fillBlob(makeRng, brush, list);
  }
}

