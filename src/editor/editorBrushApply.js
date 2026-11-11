// Část editoru: použití štětce — co který štětec do vybraných buněk zapíše (pláž, útes, ryby, tvorové, rostliny).
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { BRUSHES, brushPaintParts, PAINT_TERRAIN } from '../data/catalogs/brushes.js';
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { cellKey } from '../utils/gridMath.js';
import { floorCellAt, layerLiftAt, dropLayerCell, dropDecorationCell } from '../data/maps/areaShape.js';
import { fillZone } from '../utils/zoneFill.js';
import { createRng, seedFor } from '../utils/rng.js';
import { getFishType, FISH_SWIM_DEPTH } from '../data/catalogs/fish.js';
import { getCreatureType } from '../data/catalogs/creatures/index.js';
import { hash01, valueNoise } from '../utils/noise.js';
import { SIDES, onSurface, parseCell } from './editorSettings.js';

function round2(value) {
  return Math.round(value * 100) / 100;
}

export default {
  applyDraft() {
    if (!this.draft) return 0;
    this.resetDraftDrag();
    const { brushKey, cells, mode } = this.draft;
    if (!cells.size) {
      if (this.onDraftChange) this.onDraftChange(this.draft);
      return 0;
    }
    const brush = BRUSHES[brushKey] || {};
    const parts = brushPaintParts(brushKey);
    this.pushHistory(parts);
    if (brush.bridge) {
      const count = this.applyBridge(mode);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      this.resetBridge();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    if (brush.join) {
      const joined = this.applyJoin(mode);
      if (!joined) this.history.pop();
      this.draft.cells.clear();
      this.resetJoin();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return joined;
    }
    if (brush.cliff) {
      const zone = [...cells].map(parseCell);
      const foot = this.brushOptionValue(brushKey, 'foot');
      const count = this.applyCliffMarks(zone, mode, this.styleFor(brushKey), foot);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    if (brush.creature) {
      const zone = [...cells].map(parseCell);
      const count = this.applyCreatureBrush(brushKey, brush, zone, mode);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    if (brush.fish) {
      const zone = [...cells].map(parseCell);
      const count = this.applyFishBrush(brushKey, brush, zone, mode);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    if (brush.spawn) {
      const zone = [...cells].map(parseCell);
      const count = this.applySpawnCell(zone);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    if (brush.erase) {
      const zone = [...cells].map(parseCell);
      const bridgesBefore = (this.layout.bridges || []).length;
      const count = this.applyEraser(zone);
      const eraseParts = (this.layout.bridges || []).length !== bridgesBefore ? [...new Set([...parts, PAINT_TERRAIN])] : parts;
      if (!count) this.history.pop();
      else this.history[this.history.length - 1].parts = eraseParts;
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(eraseParts);
      return count;
    }
    if (brush.surface) {
      const zone = [...cells].map(parseCell);
      const count = this.applyBeach(brushKey, zone, mode);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    if (brush.height || brush.heights) {
      const zone = [...cells].map(parseCell);
      const count = this.applyHeightDraft(brushKey, zone, mode);
      if (!count) this.history.pop();
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate(parts);
      return count;
    }
    const shape = brush.shape;
    const filled = this.zoneEntries(brushKey, brush, [...cells], mode);
    const clearedDeco = new Set();
    const level = this.paintLevel;
    let changed = 0;
    for (const cell of filled) {
      const { cx, cz } = cell;
      if (mode === 'remove') {
        if (brush.surfaceOnly) {
          if (this.paintSurface(cx, cz, DEFAULT_FLOOR)) changed += 1;
          continue;
        }
        let dropped = dropDecorationCell(this.layout, cx, cz, level);
        if (brush.flora) {
          if (this.dropGrassCell(cx, cz)) dropped = true;
          if (this.scatterDecorations(brushKey, brush, cx, cz, true)) dropped = true;
          if (dropped) changed += 1;
          continue;
        }
        if (brush.deco) {
          if (dropped) changed += 1;
          continue;
        }
        if (dropLayerCell(this.layout, cx, cz)) dropped = true;
        if (this.dropTopEntry(cx, cz)) dropped = true;
        this.dropOrphans();
        if (dropped) changed += 1;
        continue;
      }
      if (brush.flora) {
        if (!this.layout.grass) this.layout.grass = [];
        const mix = this.brushOptionValue(brushKey, 'mix');
        const layer = this.brushOptionValue(brushKey, 'layer');
        const entry = { cx, cz };
        if (mix && mix !== 'auto') entry.mix = mix;
        if (layer && layer !== 'both') entry.layer = layer;
        const previous = this.layout.grass.find((item) => onSurface(item, cx, cz));
        const had = !!previous
          && (previous.mix || 'auto') === (entry.mix || 'auto')
          && (previous.layer || 'both') === (entry.layer || 'both');
        this.layout.grass = this.layout.grass.filter((item) => item && !onSurface(item, cx, cz));
        this.layout.grass.push(entry);
        const scattered = this.scatterDecorations(brushKey, brush, cx, cz, false);
        if (!had || scattered) changed += 1;
        continue;
      }
      const key = brush.deco ? (cell.key || this.tileKey) : cell.key;
      const painted = brush.deco ? getDecoration(key) : null;
      if (brush.deco && !painted) continue;
      if (brush.deco) {
        const cellId = cellKey(cx, cz);
        if (!clearedDeco.has(cellId)) {
          if (painted.stackable) this.dropStackableDecorations(cx, cz, level);
          else dropDecorationCell(this.layout, cx, cz, level);
          clearedDeco.add(cellId);
        }
        const lift = layerLiftAt(this.layout, cx, cz, level) || 0;
        const entry = { key, cx, cz, rotation: cell.rotation || 0 };
        if (level) entry.level = level;
        if (Number.isFinite(cell.offsetX) && cell.offsetX) entry.offsetX = cell.offsetX;
        if (Number.isFinite(cell.offsetZ) && cell.offsetZ) entry.offsetZ = cell.offsetZ;
        if (Number.isFinite(cell.scale) && cell.scale) entry.scale = cell.scale;
        if (lift) entry.liftY = lift;
        this.layout.decorations.push(entry);
        changed += 1;
        continue;
      }
      if (brush.surfaceOnly) {
        if (key && this.paintSurface(cx, cz, key)) changed += 1;
        continue;
      }
      if (shape === 'line') this.placePath(cx, cz);
      else this.placeEntry(key, cx, cz, 0, cell.liftY || 0, 'floor');
      changed += 1;
    }
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    if (!changed) {
      this.history.pop();
      return 0;
    }
    this.fixMissingFloor();
    this.scheduleRegenerate(parts);
    return changed;
  },

  applyBeach(brushKey, zone, mode) {
    const brush = BRUSHES[brushKey];
    const surface = brush.surface;
    const shape = mode === 'remove'
      ? this.beachRemoveShape(brushKey, zone)
      : this.surfaceHeightShape(brushKey, zone, mode);
    let count = 0;
    if (mode === 'remove') {
      for (const entry of shape.zone) {
        this.dropGrassCell(entry.cx, entry.cz);
        this.setCellHeight(entry.cx, entry.cz, 0);
        this.paintSurface(entry.cx, entry.cz, DEFAULT_FLOOR);
        count += 1;
      }
      for (const entry of [...shape.slope, ...shape.rim]) {
        const height = this.cellHeightValue(entry.cx, entry.cz);
        if (height >= 0 && this.surfaceAt(entry.cx, entry.cz) !== surface) continue;
        if (height < 0) this.setCellHeight(entry.cx, entry.cz, 0);
        this.paintSurface(entry.cx, entry.cz, DEFAULT_FLOOR);
        count += 1;
      }
      return count;
    }
    for (const entry of shape.zone) {
      dropDecorationCell(this.layout, entry.cx, entry.cz);
      this.dropGrassCell(entry.cx, entry.cz);
      this.paintSurface(entry.cx, entry.cz, surface);
      this.setCellHeight(entry.cx, entry.cz, entry.height);
      count += 1;
    }
    for (const entry of shape.slope) {
      this.paintSurface(entry.cx, entry.cz, surface);
      this.setCellHeight(entry.cx, entry.cz, entry.height);
      count += 1;
    }
    for (const entry of shape.rim) {
      this.paintSurface(entry.cx, entry.cz, surface);
      count += 1;
    }
    return count;
  },

  applyCliffMarks(zone, mode, style = 'stone', foot = 'auto') {
    const on = mode !== 'remove';
    const repaintFoot = on && Boolean(foot) && foot !== 'auto';
    let count = 0;
    for (const entry of zone) {
      const floor = floorCellAt(this.layout, entry.cx, entry.cz);
      if (!floor) continue;
      if (!on) {
        if (floor.cliff !== true) continue;
        delete floor.cliff;
        delete floor.cliffStyle;
        count += 1;
        continue;
      }
      if (repaintFoot) this.paintCliffFoot(entry.cx, entry.cz, foot);
      if (floor.cliff === true && (floor.cliffStyle || 'dirt') === style) continue;
      floor.cliff = true;
      floor.cliffStyle = style;
      count += 1;
    }
    return count;
  },

  paintCliffFoot(cx, cz, key) {
    const present = this.presentCells();
    if (!present.has(cellKey(cx, cz))) return;
    const here = this.cellHeightValue(cx, cz);
    let self = false;
    for (const [dx, dz] of SIDES) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!present.has(cellKey(nx, nz))) continue;
      const step = this.cellHeightValue(nx, nz) - here;
      if (Math.abs(step) < 1e-6) continue;
      if (step < 0) this.paintSurface(nx, nz, key);
      else self = true;
    }
    if (self) this.paintSurface(cx, cz, key);
  },

  surfaceAt(cx, cz) {
    const cell = this.contentAt(cx, cz);
    return cell && cell.floor ? cell.floor.key : null;
  },

  applyFishBrush(brushKey, brush, zone, mode) {
    if (!this.layout.fish) this.layout.fish = [];
    const style = this.styleFor(brushKey);
    const kind = brush.styles && brush.styles.includes(style) ? style : 'fish_blue';
    const type = getFishType(kind);
    const level = Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
    let changed = 0;
    for (const { cx, cz } of zone) {
      const key = cellKey(cx, cz);
      const before = this.layout.fish.length;
      this.layout.fish = this.layout.fish.filter((school) => !school || cellKey(school.cx, school.cz) !== key);
      if (mode === 'remove') {
        if (this.layout.fish.length !== before) changed += 1;
        continue;
      }
      if (level === null) continue;
      const depth = level - layerLiftAt(this.layout, cx, cz);
      if (depth < FISH_SWIM_DEPTH) continue;
      const roll = Math.abs(Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453) % 1;
      this.layout.fish.push({
        cx,
        cz,
        radius: Math.min(type.radius, 4),
        count: type.count,
        kind,
        mode: roll < 0.35 ? 'orbit' : 'wander',
      });
      changed += 1;
    }
    return changed;
  },

  applyCreatureBrush(brushKey, brush, zone, mode) {
    if (!this.layout.creatures) this.layout.creatures = [];
    const kind = brush.creatureKind;
    if (!getCreatureType(kind)) return 0;
    const tier = this.creatureTierFor(brushKey);
    const level = this.paintLevel;
    let changed = 0;
    for (const { cx, cz } of zone) {
      const key = cellKey(cx, cz);
      const before = this.layout.creatures.length;
      this.layout.creatures = this.layout.creatures.filter((entry) => !entry || (entry.level || 0) !== level || cellKey(entry.cx, entry.cz) !== key);
      if (mode === 'remove') {
        if (this.layout.creatures.length !== before) changed += 1;
        continue;
      }
      const placed = { kind, tier, cx, cz };
      if (level) placed.level = level;
      this.layout.creatures.push(placed);
      changed += 1;
    }
    return changed;
  },

  scatterDecorations(brushKey, brush, cx, cz, removing) {
    const scatter = brush.scatter;
    if (!scatter || !scatter.pool || !scatter.pool.length) return false;
    if (!this.layout.decorations) this.layout.decorations = [];
    const pool = scatter.pool;
    const entries = this.layout.decorations;
    const kept = entries.filter((entry) => (
      !onSurface(entry, cx, cz) || !pool.includes(entry.key)
    ));
    let touched = kept.length !== entries.length;
    this.layout.decorations = kept;
    if (removing) return touched;
    const gate = brush.scatterGate || (brush.option ? brush.option.key : null);
    if (gate && !this.brushOptionValue(brushKey, gate)) return touched;
    const patch = valueNoise(cx / 3.4, cz / 3.4);
    if (hash01(cx * 91.7, cz * 47.3) > scatter.chance * (0.25 + 1.3 * patch)) return touched;
    const amount = scatter.min + Math.floor(hash01(cx * 13.1, cz * 71.9) * (scatter.max - scatter.min + 1 + patch));
    const lift = layerLiftAt(this.layout, cx, cz) || 0;
    for (let index = 0; index < amount; index += 1) {
      const seed = cx * 37 + cz * 11 + index * 5;
      const entry = {
        key: pool[Math.floor(hash01(seed * 1.7, seed * 0.9) * pool.length)],
        cx,
        cz,
        rotation: 0,
        scale: round2(scatter.scaleMin + hash01(seed * 3.1, seed * 1.3) * (scatter.scaleMax - scatter.scaleMin)),
        offsetX: round2((hash01(seed * 5.3, seed * 2.1) - 0.5) * scatter.spread * 2),
        offsetZ: round2((hash01(seed * 7.9, seed * 3.3) - 0.5) * scatter.spread * 2),
      };
      if (lift) entry.liftY = lift;
      this.layout.decorations.push(entry);
      touched = true;
    }
    return touched;
  },

  zoneEntries(brushKey, brush, cellKeys, mode) {
    if (mode === 'remove') return cellKeys.map(parseCell);
    const pool = this.brushPool(brushKey);
    const cluster = this.clusterConfigFor(brushKey, brush);
    const filled = fillZone(
      this.cellRng(brushKey),
      {
        ...brush,
        cluster,
        pool: pool.length ? pool : brush.pool,
      },
      cellKeys,
    );
    if (!brush.deco) {
      const fallback = brush.tile || pool[0];
      return filled.map((cell) => (cell.key || !fallback ? cell : { ...cell, key: fallback }));
    }
    const list = pool.length ? pool : (brush.pool || []);
    const rotation = this.decoRotation();
    return filled.map((cell) => ({
      ...cell,
      key: this.speciesKeyAt(brush, list, cell.cx, cell.cz),
      rotation,
    }));
  },

  cellRng(brushKey) {
    const seed = this.layout.seed || 1;
    return (label) => createRng(seedFor(seed, `${brushKey}:${label}`, 0, 0));
  },

  clusterConfigFor(brushKey, brush) {
    const base = brush && brush.cluster;
    if (!base) return null;
    const density = Math.round(Number(this.brushOptionValue(brushKey, 'density')) || 1);
    const jitter = this.brushOptionValue(brushKey, 'jitter');
    const min = Math.max(1, jitter ? density - 1 : density);
    const max = Math.max(min, jitter ? density + 1 : density);
    if (max <= 1) return null;
    return { ...base, min, max };
  },

  clusterCountAt(brushKey) {
    const config = this.clusterConfigFor(brushKey, BRUSHES[brushKey]);
    return config ? { min: config.min, max: config.max } : { min: 1, max: 1 };
  },

  speciesKeyAt(brush, pool, cx, cz) {
    if (!pool || !pool.length) return this.tileKey;
    if (this.brushOptionValue(this.brushKey, 'random')) {
      const value = hash01(cx * 41.7 + 13.1, cz * 67.3 - 7.9);
      return pool[Math.min(pool.length - 1, Math.floor(value * pool.length))];
    }
    if (brush.patch && this.brushOptionValue(this.brushKey, 'patch')) {
      const px = Math.floor(cx / brush.patch + valueNoise(cx / 3.1, cz / 3.1) * 0.85);
      const pz = Math.floor(cz / brush.patch + valueNoise(cx / 2.7 + 5, cz / 2.7 - 3) * 0.85);
      const value = valueNoise(px * 17.3, pz * 11.7);
      return pool[Math.min(pool.length - 1, Math.floor(value * pool.length))];
    }
    return pool.includes(this.tileKey) ? this.tileKey : pool[0];
  },

  applySpawnCell(zone) {
    const cell = zone[zone.length - 1];
    if (!cell) return 0;
    const spawn = this.spawnCell();
    if (spawn && spawn.cx === cell.cx && spawn.cz === cell.cz) return 0;
    this.layout.spawn = { cx: cell.cx, cz: cell.cz };
    return 1;
  },
};
