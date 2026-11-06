// Odvození pevných výseků skály ve sloupci z podlah a stropů — základ objemového terénu.
// Čistá data bez scény: pro buňku vrátí seznam pevných pruhů [spodní, horní] v metrech.
import { columnsByCell } from '../data/maps/areaShape.js';
import { MIN_HEIGHT, MAX_HEIGHT, HEIGHT_STEP } from '../data/maps/layoutStore.js';

const WORLD_BOTTOM = MIN_HEIGHT * HEIGHT_STEP;
const WORLD_TOP = MAX_HEIGHT * HEIGHT_STEP;
const EPS = 1e-4;

function solidRunsForColumn(planes, bottom, top) {
  if (!planes || !planes.length) return [];
  const air = [];
  for (let i = 0; i < planes.length; i += 1) {
    const plane = planes[i];
    const next = planes[i + 1];
    const upper = Number.isFinite(plane.ceil) ? plane.ceil : (next ? next.lift : top);
    if (!(upper > plane.lift)) continue;
    air.push([plane.lift, Math.min(upper, top)]);
  }
  air.sort((a, b) => a[0] - b[0]);
  const runs = [];
  let cursor = bottom;
  for (const [a0, a1] of air) {
    if (a0 > cursor + EPS) runs.push([cursor, Math.min(a0, top)]);
    if (a1 > cursor) cursor = a1;
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

export { WORLD_BOTTOM, WORLD_TOP };
