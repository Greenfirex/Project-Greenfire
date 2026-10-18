// Formát mapy — zóny (co vyplnit), ruční položky (co je napevno) a ruční výšky terénu.
// Načítání, normalizace a odvození blokovaných buněk z katalogu; nezná scénu.
import { getDecoration } from '../catalogs/decorations.js';
import { getBrush } from '../catalogs/brushes.js';

export const LAYOUT_VERSION = 5;

const RENAMED_BRUSHES = { pond: 'water', stream: 'water' };

export function migrateBrushKey(brushKey) {
  return RENAMED_BRUSHES[brushKey] || brushKey;
}

export const MAX_HEIGHT = 4;

export function emptyLayout(seed = 1) {
  return {
    version: LAYOUT_VERSION,
    seed,
    spawn: { cx: 0, cz: 0 },
    zones: [],
    manual: [],
    pathOverrides: [],
    waterOverrides: [],
    exclude: [],
    height: [],
  };
}

export function normalizeLayout(raw, fallbackSeed = 1) {
  const base = emptyLayout(fallbackSeed);
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: LAYOUT_VERSION,
    seed: Number.isFinite(raw.seed) ? raw.seed : base.seed,
    spawn: raw.spawn && Number.isFinite(raw.spawn.cx) ? raw.spawn : base.spawn,
    zones: Array.isArray(raw.zones)
      ? raw.zones
        .map((z) => (z && typeof z === 'object' ? { ...z, brush: migrateBrushKey(z.brush) } : z))
        .filter((z) => z && getBrush(z.brush) && Array.isArray(z.cells))
        .map((z) => (z.opts && typeof z.opts === 'object' ? { ...z, opts: { ...z.opts } } : z))
      : [],
    manual: Array.isArray(raw.manual) ? raw.manual.filter((m) => m && getDecoration(m.key)) : [],
    pathOverrides: normalizePathOverrides(raw.pathOverrides),
    waterOverrides: normalizePathOverrides(raw.waterOverrides),
    exclude: Array.isArray(raw.exclude) ? raw.exclude : [],
    height: normalizeHeight(raw.height),
  };
}

function normalizePathOverrides(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || !Number.isFinite(item.cx) || !Number.isFinite(item.cz)) continue;
    if (!getDecoration(item.key)) continue;
    out.push({ cx: item.cx, cz: item.cz, key: item.key, rotation: clampRotation(item.rotation) });
  }
  return out;
}

function clampRotation(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return ((n % 4) + 4) % 4;
}

function normalizeHeight(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const value = clampHeight(item[1]);
    if (value <= 0 || typeof item[0] !== 'string') continue;
    out.push([item[0], value]);
  }
  return out;
}

function clampHeight(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_HEIGHT, n));
}

export function heightMap(layout) {
  const out = new Map();
  for (const [key, value] of layout.height || []) {
    const n = clampHeight(value);
    if (n > 0) out.set(key, n);
  }
  return out;
}

export function heightAt(layout, cx, cz) {
  const key = cellKey(cx, cz);
  for (const [k, value] of layout.height || []) if (k === key) return clampHeight(value);
  return null;
}

export function setHeight(layout, cx, cz, value) {
  const key = cellKey(cx, cz);
  const n = clampHeight(value);
  layout.height = (layout.height || []).filter(([k]) => k !== key);
  if (n > 0) layout.height.push([key, n]);
}

export function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

export function addZoneCell(layout, brushKey, cx, cz, opts) {
  const key = cellKey(cx, cz);
  let zone = layout.zones.find((z) => z.brush === brushKey
    && sameOpts(z.opts, opts)
    && z.cells.some(([ox, oz]) => isNeighbor(ox, oz, cx, cz)));
  if (!zone) {
    zone = { brush: brushKey, cells: [] };
    if (opts) zone.opts = { ...opts };
    layout.zones.push(zone);
  }
  for (const other of layout.zones) {
    if (other === zone) continue;
    const index = other.cells.findIndex(([ox, oz]) => cellKey(ox, oz) === key);
    if (index >= 0) other.cells.splice(index, 1);
  }
  if (zone.cells.some(([ox, oz]) => cellKey(ox, oz) === key)) return;
  zone.cells.push([cx, cz]);
  layout.zones = layout.zones.filter((z) => z.cells.length > 0 || isImplicit(getBrush(z.brush)));
}

export function removeZoneCell(layout, cx, cz) {
  const key = cellKey(cx, cz);
  let removed = false;
  for (const zone of layout.zones) {
    const index = zone.cells.findIndex(([ox, oz]) => cellKey(ox, oz) === key);
    if (index >= 0) {
      zone.cells.splice(index, 1);
      removed = true;
    }
  }
  layout.zones = layout.zones.filter((z) => z.cells.length > 0 || isImplicit(getBrush(z.brush)));
  clearPathOverride(layout, cx, cz);
  return removed;
}

function isImplicit(brush) {
  return Boolean(brush && brush.shape === 'perimeter');
}

function sameOpts(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

function isNeighbor(ox, oz, cx, cz) {
  return Math.abs(ox - cx) + Math.abs(oz - cz) === 1;
}

export function brushAt(layout, cx, cz) {
  const key = cellKey(cx, cz);
  for (const zone of layout.zones) {
    if (zone.cells.some(([ox, oz]) => cellKey(ox, oz) === key)) return zone.brush;
  }
  return null;
}

export function manualAt(layout, cx, cz) {
  const list = layout.manual.filter((m) => m.cx === cx && m.cz === cz);
  return list.length ? list[list.length - 1] : null;
}

export function addManualEntry(layout, key, cx, cz, rotation = 0) {
  if (!getDecoration(key)) return null;
  layout.manual = (layout.manual || []).filter((m) => m.cx !== cx || m.cz !== cz);
  const entry = { key, cx, cz, rotation: clampRotation(rotation) };
  layout.manual.push(entry);
  clearPathOverride(layout, cx, cz);
  return entry;
}

export function removeManualAt(layout, cx, cz) {
  const before = (layout.manual || []).length;
  layout.manual = (layout.manual || []).filter((m) => m.cx !== cx || m.cz !== cz);
  return layout.manual.length !== before;
}

export function rotateManualAt(layout, cx, cz, delta = 1) {
  const entry = (layout.manual || []).find((m) => m.cx === cx && m.cz === cz);
  if (!entry) return false;
  entry.rotation = clampRotation((entry.rotation || 0) + delta);
  return true;
}

export function pathOverrideAt(layout, cx, cz) {
  const list = layout.pathOverrides || [];
  for (const item of list) if (item.cx === cx && item.cz === cz) return item;
  return null;
}

export function setPathOverride(layout, cx, cz, key, rotation = 0) {
  if (!getDecoration(key)) return null;
  const entry = { cx, cz, key, rotation: clampRotation(rotation) };
  layout.pathOverrides = (layout.pathOverrides || []).filter((m) => m.cx !== cx || m.cz !== cz);
  layout.pathOverrides.push(entry);
  removeManualAt(layout, cx, cz);
  return entry;
}

export function clearPathOverride(layout, cx, cz) {
  const before = (layout.pathOverrides || []).length;
  layout.pathOverrides = (layout.pathOverrides || []).filter((m) => m.cx !== cx || m.cz !== cz);
  return layout.pathOverrides.length !== before;
}

export function rotatePathOverrideAt(layout, cx, cz, delta = 1) {
  const entry = pathOverrideAt(layout, cx, cz);
  if (!entry) return false;
  entry.rotation = clampRotation((entry.rotation || 0) + delta);
  return true;
}

export function waterOverrideAt(layout, cx, cz) {
  const list = layout.waterOverrides || [];
  for (const item of list) if (item.cx === cx && item.cz === cz) return item;
  return null;
}

export function setWaterOverride(layout, cx, cz, key, rotation = 0) {
  if (!getDecoration(key)) return null;
  const entry = { cx, cz, key, rotation: clampRotation(rotation) };
  layout.waterOverrides = (layout.waterOverrides || []).filter((m) => m.cx !== cx || m.cz !== cz);
  layout.waterOverrides.push(entry);
  removeManualAt(layout, cx, cz);
  return entry;
}

export function clearWaterOverride(layout, cx, cz) {
  const before = (layout.waterOverrides || []).length;
  layout.waterOverrides = (layout.waterOverrides || []).filter((m) => m.cx !== cx || m.cz !== cz);
  return layout.waterOverrides.length !== before;
}

export function rotateWaterOverrideAt(layout, cx, cz, delta = 1) {
  const entry = waterOverrideAt(layout, cx, cz);
  if (!entry) return false;
  entry.rotation = clampRotation((entry.rotation || 0) + delta);
  return true;
}

export function deriveBlocked(entries) {
  const out = [];
  for (const entry of entries) {
    if (entry.blocks === false) continue;
    const def = getDecoration(entry.key);
    if (!def || def.blocks === false) continue;
    out.push({ cx: entry.cx, cz: entry.cz, radius: def.radius || 0.8 });
  }
  return out;
}

export function unitCells(limit) {
  const out = [];
  for (let cx = -limit; cx <= limit; cx++) for (let cz = -limit; cz <= limit; cz++) out.push([cx, cz]);
  return out;
}

export function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}
