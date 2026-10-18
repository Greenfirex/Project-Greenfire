// Vyplňování zón — ze seznamu buněk a předpisu brushu udělá konkrétní dekorace.
// Čtyři tvary: blob (rozhazování), line (spojitá trasa), perimeter (okraj), outline_fill (vnitřek + lem).
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

function fadeEdges(cells, makeRng, blur) {
  const list = sortedCells(cells);
  if (!blur) return list;
  const result = [];
  for (const k of list) {
    const [cx, cz] = parse(k);
    let open = 0;
    for (const [dx, dz] of ORTHO) if (!cells.has(key(cx + dx, cz + dz))) open++;
    if (open > 0 && cellRng(makeRng, k)() < (open / ORTHO.length) * 0.55) continue;
    result.push(k);
  }
  return result;
}

function fillBlob(makeRng, brush, cells, occupied) {
  const opts = brush.opts || {};
  const free = cells.filter((k) => !occupied.has(k));
  if (!free.length) return [];

  const scatter = Boolean(opts.scatter);
  const blur = scatter && Boolean(opts.blur);
  const density = scatter ? (opts.fill ?? 1) : 1;

  const kept = fadeEdges(new Set(free), makeRng, blur);
  const out = [];

  for (const k of kept) {
    const [cx, cz] = parse(k);
    if (cellRng(makeRng, k)() > density) continue;
    out.push({ cx, cz });
  }

  const palette = brush.pool && brush.pool.length ? brush.pool : [];
  if (!palette.length) return out;
  return out.map((cell) => {
    const local = cellRng(makeRng, key(cell.cx, cell.cz));
    return { ...cell, key: pick(local, palette) };
  });
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

function fillPerimeter(makeRng, brush, cells) {
  const edge = edgeCells(cells);
  const stack = Math.max(1, brush.stack || 1);
  const palette = brush.pool && brush.pool.length ? brush.pool : [];
  const out = [];
  for (const k of edge) {
    const [cx, cz] = parse(k);
    const local = cellRng(makeRng, k);
    for (let level = 0; level < stack; level++) {
      out.push({ cx, cz, key: palette.length ? palette[Math.min(level, palette.length - 1)] : null, level });
    }
    if (brush.scatter && brush.scatter.fill && isInner(k, new Set(cells)) && local() <= brush.scatter.fill) {
      out.push({ cx, cz, key: pick(local, brush.scatter.pool) });
    }
  }
  return out;
}

function fillOutline(makeRng, brush, cells) {
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

  if (brush.scatter && brush.scatter.fill) {
    for (const k of cells) {
      if (edge.has(k)) continue;
      const local = cellRng(makeRng, k);
      if (local() > brush.scatter.fill) continue;
      const [cx, cz] = parse(k);
      out.push({ cx, cz, key: pick(local, brush.scatter.pool), liftY: brush.scatter.liftY ?? 0.02 });
    }
  }

  return out;
}

export function fillZone(makeRng, brush, cells, occupied) {
  const list = [...cells].map((k) => String(k));
  switch (brush.shape) {
    case 'line':
      return fillLine(makeRng, brush, list);
    case 'perimeter':
      return fillPerimeter(makeRng, brush, list);
    case 'outline_fill':
      return fillOutline(makeRng, brush, list);
    default:
      return fillBlob(makeRng, brush, list, occupied);
  }
}

