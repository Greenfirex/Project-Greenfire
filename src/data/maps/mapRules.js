// Pravidla mapy — jak se ze zadaných zón a ručních položek stanou konkrétní objekty.
// Deterministický: stejný seed + stejné zóny = stejná mapa.
import { getMap } from '../catalogs/maps.js';
import { getBrush } from '../catalogs/brushes.js';
import { createRng, seedFor } from '../../utils/rng.js';
import { fillZone } from '../../utils/zoneFill.js';
import { pathKeyAt } from '../../utils/pathTiles.js';
import { waterPlan } from '../../utils/waterTiles.js';
import { cellKey, deriveBlocked, unitCells, heightMap, pathOverrideAt, waterOverrideAt } from './layoutStore.js';
import {
  surfaceHeight, blockStack, cornerCells, faceTile,
  pieceTurn, edgeDepth, pathDistance, rampPlan,
  ridgeLevels, flankStack, cornerKey, SIDES, DIAG_SIDES,
} from './cliffShape.js';

const PATH_GAP = 4;
const ORE_LIFT = 0.002;

function makeEntry(key, cx, cz, rng, extra = {}) {
  const jitterX = Math.round(rng() * 100) / 100 - 0.5;
  const jitterZ = Math.round(rng() * 100) / 100 - 0.5;
  return {
    key,
    cx,
    cz,
    offsetX: jitterX * 0.7,
    offsetZ: jitterZ * 0.7,
    rotation: Math.floor(rng() * 4),
    ...extra,
  };
}

function zoneRngFactory(baseSeed, brushKey) {
  return (cellKeyText) => {
    const [cx, cz] = String(cellKeyText).split(',').map(Number);
    return createRng(seedFor(baseSeed, brushKey, cx, cz));
  };
}

function makeTile(key, cx, cz, rotation, liftY = 0) {
  return { key, cx, cz, offsetX: 0, offsetZ: 0, rotation: rotation || 0, liftY };
}

function buildRim(limit, pathCells, overrides) {
  const entries = [];
  const occupied = new Set();
  const isFree = (cx, cz) => !pathCells.has(cellKey(cx, cz));
  const inGap = (cx, cz) => pathDistance(cx, cz, pathCells, PATH_GAP) < PATH_GAP;
  const heightAt = (cx, cz) => surfaceHeight(cx, cz, limit, PATH_GAP, pathCells, overrides);
  const reserve = (cx, cz) => {
    const key = cellKey(cx, cz);
    if (occupied.has(key)) return false;
    if (Math.abs(cx) > limit || Math.abs(cz) > limit) return false;
    occupied.add(key);
    return true;
  };
  const own = (cx, cz) => {
    const key = cellKey(cx, cz);
    if (occupied.has(key)) return true;
    if (Math.abs(cx) > limit || Math.abs(cz) > limit) return false;
    occupied.add(key);
    return true;
  };

  for (const [cx, cz] of cornerCells(limit)) {
    if (!isFree(cx, cz) || !reserve(cx, cz)) continue;
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
      if (!inner || !isFree(cx, cz) || !own(cx, cz)) continue;

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
        if (height <= 0 || !isFree(tx, tz) || !reserve(tx, tz)) break;

        const ramp = rampPlan(tx, tz, limit, PATH_GAP, pathCells, overrides);
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

function buildFlanks(decorations, limit, rampCells, overrides) {
  const levels = ridgeLevels(decorations, overrides);
  const entries = [];
  const placed = new Set();

  for (const [key, height] of levels) {
    const [cx, cz] = key.split(',').map(Number);

    for (const side of SIDES) {
      const nx = cx + side.dx;
      const nz = cz + side.dz;
      if (Math.abs(nx) > limit || Math.abs(nz) > limit) continue;
      const nkey = cellKey(nx, nz);
      if (rampCells.has(nkey)) continue;
      const neighbour = levels.get(nkey) || 0;
      if (neighbour >= height) continue;
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

function buildFlankCorners(decorations, limit, rampCells, overrides) {
  const levels = ridgeLevels(decorations, overrides);
  const flankCells = new Set();
  for (const entry of decorations) {
    if (entry.key === 'cliff_top' || entry.key === 'cliff_half') flankCells.add(cellKey(entry.cx, entry.cz));
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
      const nkey = cellKey(nx, nz);
      if (rampCells.has(nkey) || flankCells.has(nkey)) continue;
      const neighbour = levels.get(nkey) || 0;
      if (neighbour >= height) continue;

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

export function generateLayout(mapKey, layout) {
  const map = getMap(mapKey);
  const empty = { floor: [], path: [], clearing: [], decorations: [], blocked: [] };
  if (!map || !layout) return empty;

  const limit = Math.floor(map.groundSize / 2) - 1;

  const floor = unitCells(limit).map(([cx, cz]) => makeTile('floor_grass', cx, cz, 0));

  const excluded = new Set((layout.exclude || []).map(([cx, cz]) => cellKey(cx, cz)));
  const occupied = new Set(excluded);
  for (const item of layout.manual || []) occupied.add(cellKey(item.cx, item.cz));

  const overrides = heightMap(layout);
  const underHeight = (cx, cz) => overrides.has(cellKey(cx, cz));

  const pathCells = new Set();
  const pathStyleCells = new Map();
  const waterCells = new Set();
  const decorationCells = new Set();
  const decorations = [];

  const rimZones = (layout.zones || []).filter((z) => {
    const brush = getBrush(z.brush);
    return brush && brush.shape === 'perimeter';
  });
  const contentZones = (layout.zones || []).filter((z) => {
    const brush = getBrush(z.brush);
    return brush && brush.shape !== 'perimeter' && brush.shape !== 'manual';
  });

  for (const zone of contentZones) {
    if (getBrush(zone.brush).shape !== 'line') continue;
    const cells = zone.cells.map(([cx, cz]) => cellKey(cx, cz)).filter((k) => !excluded.has(k));
    if (!cells.length) continue;
    const style = zone.opts?.style || 'dirt';
    const makeRng = zoneRngFactory(layout.seed, zone.brush);
    for (const cell of fillZone(makeRng, getBrush(zone.brush), cells, occupied)) {
      const id = cellKey(cell.cx, cell.cz);
      pathCells.add(id);
      pathStyleCells.set(id, style);
    }
  }

  for (const zone of contentZones) {
    if (zone.brush !== 'water') continue;
    const cells = zone.cells.map(([cx, cz]) => cellKey(cx, cz)).filter((k) => !excluded.has(k));
    if (!cells.length) continue;
    const makeRng = zoneRngFactory(layout.seed, zone.brush);
    for (const cell of fillZone(makeRng, getBrush(zone.brush), cells, occupied)) {
      waterCells.add(cellKey(cell.cx, cell.cz));
    }
  }

  for (const [key, height] of overrides) {
    const [cx, cz] = key.split(',').map(Number);
    if (Math.abs(cx) > limit || Math.abs(cz) > limit) continue;
    pathCells.delete(key);
    for (const [part, lift] of blockStack(height)) {
      const slab = makeTile(part, cx, cz, 0, lift);
      slab.blocks = true;
      decorations.push(slab);
    }
    occupied.add(key);
  }

  for (const zone of contentZones) {
    const brush = getBrush(zone.brush);
    if (!brush.height) continue;
    for (const [cx, cz] of zone.cells) {
      if (excluded.has(cellKey(cx, cz))) continue;
      pathCells.delete(cellKey(cx, cz));
      for (const [part, lift] of blockStack(brush.height)) {
        const slab = makeTile(part, cx, cz, 0, lift);
        slab.blocks = true;
        decorations.push(slab);
      }
      occupied.add(cellKey(cx, cz));
    }
  }

  const path = [];
  for (const key of pathCells) {
    const [cx, cz] = key.split(',').map(Number);
    const override = pathOverrideAt(layout, cx, cz);
    const tile = override
      ? { key: override.key, rotation: override.rotation }
      : pathKeyAt(pathCells, cx, cz, pathStyleCells.get(key) || 'dirt');
    const entry = makeTile(tile.key, cx, cz, tile.rotation);
    entry.blocks = false;
    path.push(entry);
  }

  for (const override of layout.pathOverrides || []) {
    if (pathCells.has(cellKey(override.cx, override.cz))) continue;
    const entry = makeTile(override.key, override.cx, override.cz, override.rotation);
    entry.blocks = false;
    path.push(entry);
  }

  const water = [];
  const waterTiles = waterPlan(waterCells);
  for (const key of waterCells) {
    if (overrides.has(key)) continue;
    const [cx, cz] = key.split(',').map(Number);
    const override = waterOverrideAt(layout, cx, cz);
    const tile = override ? { key: override.key, rotation: override.rotation } : waterTiles.get(key);
    const entry = makeTile(tile.key, cx, cz, tile.rotation);
    entry.blocks = false;
    water.push(entry);
  }

  for (const override of layout.waterOverrides || []) {
    if (waterCells.has(cellKey(override.cx, override.cz))) continue;
    if (overrides.has(cellKey(override.cx, override.cz))) continue;
    const entry = makeTile(override.key, override.cx, override.cz, override.rotation);
    entry.blocks = false;
    water.push(entry);
  }

  const blocked = [];
  for (const item of layout.manual || []) {
    decorations.push({ ...item, offsetX: item.offsetX || 0, offsetZ: item.offsetZ || 0, rotation: item.rotation || 0 });
  }

  if (rimZones.length) {
    for (const entry of buildRim(limit, pathCells, overrides)) {
      if (entry.key.startsWith('cliff_level') || entry.key.startsWith('cliff_slope') || entry.key.startsWith('cliff_steps')) {
        decorations.push(entry);
        occupied.add(cellKey(entry.cx, entry.cz));
      }
    }
  }

  const ramps = new Set();
  for (const entry of decorations) {
    if (entry.blocks === false && (entry.key.startsWith('cliff_slope') || entry.key.startsWith('cliff_steps'))) {
      ramps.add(cellKey(entry.cx, entry.cz));
    }
  }
  for (const [cx, cz] of cornerCells(limit)) ramps.add(cellKey(cx, cz));

  for (const entry of buildFlanks(decorations, limit, ramps, overrides)) decorations.push(entry);
  for (const entry of buildFlankCorners(decorations, limit, ramps, overrides)) decorations.push(entry);

  for (const entry of decorations) {
    if (entry.cx !== undefined) occupied.add(cellKey(entry.cx, entry.cz));
  }

  for (const zone of contentZones) {
    const brush = getBrush(zone.brush);
    if (brush.shape === 'line' || brush.height) continue;
    const cells = zone.cells.map(([cx, cz]) => cellKey(cx, cz)).filter((k) => !excluded.has(k));
    if (!cells.length) continue;

    const spec = zone.opts ? { ...brush, opts: zone.opts } : brush;
    const pool = spec.poolByStyle ? spec.poolByStyle[zone.opts?.style || ''] : null;
    if (pool) spec.pool = pool;
    const makeRng = zoneRngFactory(layout.seed, zone.brush);
    const scatterBrush = Boolean(brush.scatter);
    for (const cell of fillZone(makeRng, spec, cells, occupied)) {
      const key = cellKey(cell.cx, cell.cz);
      if (!cell.key) {
        occupied.add(key);
        continue;
      }
      if (decorationCells.has(`${key}|${cell.key}`)) continue;
      decorationCells.add(`${key}|${cell.key}`);
      if (!scatterBrush) occupied.add(key);
      const extra = {};
      if (cell.rotation) extra.rotation = cell.rotation;
      if (cell.liftY) extra.liftY = cell.liftY;
      const entry = makeEntry(cell.key, cell.cx, cell.cz, makeRng(key), extra);
      if (cell.key.startsWith('ore_')) {
        entry.offsetX = 0;
        entry.offsetZ = 0;
        entry.liftY = ORE_LIFT;
      }
      decorations.push(entry);
    }
  }

  return { floor, path, water, clearing: [], decorations, blocked: blocked.concat(deriveBlocked(decorations)) };
}
