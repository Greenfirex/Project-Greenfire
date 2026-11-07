// Rozdělení sloupce na skálu a vzduch podle podlah a stropů — základ objemového terénu.
// Čistá data bez scény: pro buňku vrátí pruhy skály a pruhy vzduchu v metrech.
import { columnsByCell } from '../data/maps/areaShape.js';
import { MIN_HEIGHT, MAX_HEIGHT, HEIGHT_STEP } from '../data/maps/layoutStore.js';

const WORLD_BOTTOM = MIN_HEIGHT * HEIGHT_STEP;
const WORLD_TOP = MAX_HEIGHT * HEIGHT_STEP;
const EDGE_DEPTH = 2;
const EPS = 1e-4;

function airSpansForColumn(planes, bottom, top) {
  const spans = [];
  if (!planes || !planes.length) return spans;
  for (let i = 0; i < planes.length; i += 1) {
    const plane = planes[i];
    const next = planes[i + 1];
    const upper = Number.isFinite(plane.ceil) ? plane.ceil : (next ? next.lift : top);
    if (!(upper > plane.lift)) continue;
    const y0 = Math.max(plane.lift, bottom);
    const y1 = Math.min(upper, top);
    if (y1 - y0 <= EPS) continue;
    spans.push({ bottom: y0, top: y1, level: plane.level });
  }
  spans.sort((a, b) => a.bottom - b.bottom);
  return spans;
}

function solidRunsForColumn(planes, bottom, top) {
  if (!planes || !planes.length) return [];
  const runs = [];
  let cursor = bottom;
  for (const span of airSpansForColumn(planes, bottom, top)) {
    if (span.bottom > cursor + EPS) runs.push([cursor, Math.min(span.bottom, top)]);
    if (span.top > cursor) cursor = span.top;
    if (cursor >= top - EPS) break;
  }
  if (cursor < top - EPS) runs.push([cursor, top]);
  return runs.filter(([y0, y1]) => y1 - y0 > EPS);
}

export function buildColumnRuns(layout, bottom = WORLD_BOTTOM, top = WORLD_TOP) {
  const columns = columnsByCell(layout || {});
  const out = new Map();
  for (const [id, planes] of columns) {
    out.set(id, solidRunsForColumn(planes, bottom, top));
  }
  return out;
}

export function buildColumnAir(layout, bottom = WORLD_BOTTOM, top = WORLD_TOP) {
  const columns = columnsByCell(layout || {});
  const out = new Map();
  for (const [id, planes] of columns) {
    out.set(id, airSpansForColumn(planes, bottom, top));
  }
  return out;
}

export { WORLD_BOTTOM, WORLD_TOP, EDGE_DEPTH };
