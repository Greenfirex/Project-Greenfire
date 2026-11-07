// Které buňky mapy existují a jakou vrstvu v nich najdeš — podlaha, cesta, nebo tráva.
// Odsud se počítá hratelná země, mřížka, tráva i chození; plocha (patro) je nepovinný údaj.

import { cellKey } from '../../utils/gridMath.js';

export const PLANE_LAYERS = ['floor', 'clearing', 'grass', 'path'];
export const ENTRY_LAYERS = [...PLANE_LAYERS, 'decorations', 'fish', 'creatures'];
export function levelOfEntry(entry) {
  return entry && Number.isFinite(entry.level) ? entry.level : 0;
}
export function layerCells(entries, level = 0) {
  const cells = [];
  const seen = new Set();
  for (const entry of entries || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    if (levelOfEntry(entry) !== level) continue;
    const key = cellKey(entry.cx, entry.cz);
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push([entry.cx, entry.cz]);
  }
  return cells;
}
export function worldCells(world, level = 0) {
  const layers = world || {};
  const cells = layerCells(layers.floor, level).concat(layerCells(layers.path, level), layerCells(layers.clearing, level), layerCells(layers.grass, level));
  const seen = new Set();
  return cells.filter(([cx, cz]) => {
    const key = cellKey(cx, cz);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function groundCells(world, level = 0) {
  return layerCells((world || {}).floor, level);
}
export function layerAt(world, cx, cz, level = 0) {
  const layers = world || {};
  const hit = (entries) => (entries || []).some((entry) => entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === level);
  if (hit(layers.path)) return 'path';
  if (hit(layers.floor)) return 'floor';
  if (hit(layers.clearing)) return 'clearing';
  if (hit(layers.grass)) return 'grass';
  return null;
}
export function layerEntriesAt(world, cx, cz, level = 0) {
  const layers = world || {};
  const out = [];
  const push = (name) => {
    for (const entry of layers[name] || []) {
      if (entry && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === level) out.push(entry);
    }
  };
  push('path');
  push('floor');
  push('clearing');
  push('grass');
  return out;
}
export function hasFloor(world, cx, cz, level = 0) {
  return Boolean(floorCellAt(world, cx, cz, level));
}
export function hasLayerCell(world, cx, cz) {
  return layerAt(world, cx, cz) !== null;
}
function entryInCell(entry, cx, cz, level) {
  return Boolean(entry) && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === level;
}
export function dropDecorationCell(world, cx, cz, level = 0) {
  if (!world) return false;
  const entries = world.decorations || [];
  const kept = entries.filter((entry) => !entryInCell(entry, cx, cz, level));
  if (kept.length === entries.length) return false;
  world.decorations = kept;
  return true;
}
export function layerLiftAt(world, cx, cz, level = 0) {
  if (!world) return null;
  for (const name of PLANE_LAYERS) {
    const entry = (world[name] || []).find((item) => item && item.cx === cx && item.cz === cz && levelOfEntry(item) === level);
    if (entry) return entry.liftY || 0;
  }
  return null;
}
export function floorCellAt(world, cx, cz, level = 0) {
  if (!world) return null;
  const list = world.floor || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const entry = list[i];
    if (entry && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === level) return entry;
  }
  return null;
}
export function columnsByCell(world) {
  const layers = world || {};
  const grouped = new Map();
  for (const name of PLANE_LAYERS) {
    for (const entry of layers[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const id = `${entry.cx},${entry.cz}`;
      let planes = grouped.get(id);
      if (!planes) {
        planes = new Map();
        grouped.set(id, planes);
      }
      const level = levelOfEntry(entry);
      let plane = planes.get(level);
      if (!plane) {
        plane = { level, entries: [], lift: entry.liftY || 0, ceil: null };
        planes.set(level, plane);
      }
      plane.entries.push(entry);
      if (plane.ceil === null && Number.isFinite(entry.ceilY)) plane.ceil = entry.ceilY;
    }
  }
  const out = new Map();
  for (const [id, planes] of grouped) {
    out.set(id, [...planes.values()].sort((a, b) => a.lift - b.lift));
  }
  return out;
}
export function columnAt(world, cx, cz) {
  const layers = world || {};
  const planes = new Map();
  for (const name of PLANE_LAYERS) {
    for (const entry of layers[name] || []) {
      if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
      const level = levelOfEntry(entry);
      let plane = planes.get(level);
      if (!plane) {
        plane = { level, entries: [], lift: null, ceil: null };
        planes.set(level, plane);
      }
      plane.entries.push(entry);
      if (plane.lift === null) plane.lift = entry.liftY || 0;
      if (plane.ceil === null && Number.isFinite(entry.ceilY)) plane.ceil = entry.ceilY;
    }
  }
  return [...planes.values()].sort((a, b) => a.lift - b.lift);
}
export function planesAt(world, cx, cz) {
  return columnAt(world, cx, cz).map((plane) => plane.level);
}
export function planeLevels(world) {
  const layers = world || {};
  const levels = new Set();
  for (const name of PLANE_LAYERS) {
    for (const entry of layers[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      levels.add(levelOfEntry(entry));
    }
  }
  return [...levels].sort((a, b) => a - b);
}
export function ceilingLiftAt(world, cx, cz, level = 0) {
  const plane = columnAt(world, cx, cz).find((item) => item.level === level);
  return plane ? plane.ceil : null;
}
export function dropFloorCell(world, cx, cz) {
  if (!world) return false;
  const entries = world.floor || [];
  const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
  if (kept.length === entries.length) return false;
  world.floor = kept;
  return true;
}
export function dropLayerCell(world, cx, cz, level = 0) {
  if (!world) return false;
  let dropped = false;
  for (const name of PLANE_LAYERS) {
    const entries = world[name] || [];
    const kept = entries.filter((entry) => !entryInCell(entry, cx, cz, level));
    if (kept.length !== entries.length) {
      world[name] = kept;
      dropped = true;
    }
  }
  return dropped;
}
export function dropAreaCells(world, cells) {
  if (!world || !cells || !cells.length) return 0;
  let dropped = 0;
  for (const [cx, cz] of cells) {
    if (dropLayerCell(world, cx, cz)) dropped += 1;
  }
  return dropped;
}
