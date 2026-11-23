// Část editoru: výšky — tvary kopců a prohlubní, pláž, a rozpracovaný výběr v režimu Výška.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { floorCellAt, layerLiftAt } from '../data/maps/areaShape.js';
import { hash01, valueNoise } from '../utils/noise.js';
import { SIDES, AROUND, parseCell, clampLevel } from './editorSettings.js';

const ROUGH_SKIP = 0.32;
const HEIGHT_BRUSH_MAX = 3;
const HEIGHT_JITTER_MAX = 2;

export default {
  setHeightLevel(level) {
    const n = clampLevel(Math.round(Number(level)));
    if (!Number.isFinite(n)) return;
    this.heightLevel = n;
    if (this.onHeightChange) this.onHeightChange(n);
  },

  stepHeightLevel(delta) {
    this.setHeightLevel(this.heightLevel + delta);
  },

  setHeightBrushSize(size) {
    const value = Math.max(0, Math.min(HEIGHT_BRUSH_MAX, Math.round(Number(size) || 0)));
    if (value === this.heightBrushSize) return;
    this.heightBrushSize = value;
    if (this.onHeightBrushChange) this.onHeightBrushChange(value);
  },

  setHeightStepSign(sign) {
    const value = Math.sign(Number(sign) || 0);
    if (value === this.heightStepSign) return;
    this.heightStepSign = value;
    if (this.onHeightStepChange) this.onHeightStepChange(value);
  },

  setHeightJitter(value) {
    const next = Math.max(0, Math.min(HEIGHT_JITTER_MAX, Math.round(Number(value) || 0)));
    if (next === this.heightJitter) return;
    this.heightJitter = next;
    if (this.onHeightJitterChange) this.onHeightJitterChange(next);
  },

  setHeightFromNeighbors(on) {
    const value = Boolean(on);
    if (value === this.heightFromNeighbors) return;
    this.heightFromNeighbors = value;
    if (this.onHeightNeighborsChange) this.onHeightNeighborsChange(value);
  },

  neighborHeightLevel(cx, cz) {
    let sum = 0;
    let count = 0;
    for (const [dx, dz] of AROUND) {
      const x = cx + dx;
      const z = cz + dz;
      if (this.heightDraft && this.heightDraft.has(cellKey(x, z))) continue;
      if (!floorCellAt(this.layout, x, z)) continue;
      sum += this.cellHeightValue(x, z);
      count += 1;
    }
    const meters = count ? sum / count : this.cellHeightValue(cx, cz);
    return clampLevel(Math.round(meters / HEIGHT_STEP));
  },

  refreshAutoHeights() {
    if (!this.heightDraft) return;
    for (const key of this.heightAuto) {
      const { cx, cz } = parseCell(key);
      this.heightDraft.set(key, this.neighborHeightLevel(cx, cz));
    }
  },

  beginHeightStroke() {
    this.heightStrokeStep = 0;
  },

  heightStampCells(cx, cz) {
    const radius = this.heightBrushSize || 0;
    const cells = [];
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) cells.push([cx + dx, cz + dz]);
    }
    return cells;
  },

  cellHeightValue(cx, cz) {
    return layerLiftAt(this.layout, cx, cz) || 0;
  },

  heightShape(brushKey, zone, mode = 'add') {
    const brush = BRUSHES[brushKey];
    const level = this.brushHeight(brushKey) * HEIGHT_STEP;
    const zoneEntries = zone.map(({ cx, cz }) => ({ cx, cz, height: level, zone: true }));
    if (!brush || !brush.falloff || !level) return { zone: zoneEntries, slope: [] };
    const sign = Math.sign(level);
    const steep = this.brushOptionValue(brushKey, 'steep');
    const rough = this.brushOptionValue(brushKey, 'rough');
    const drop = HEIGHT_STEP * (steep ? 2 : 1);
    const present = this.presentCells();
    const affected = new Map();
    for (const entry of zoneEntries) affected.set(cellKey(entry.cx, entry.cz), entry);
    let frontier = new Map(zoneEntries.map((entry) => [cellKey(entry.cx, entry.cz), entry]));
    let nextLevel = level - sign * drop;
    while (Math.abs(nextLevel) > 1e-6) {
      const next = new Map();
      for (const entry of frontier.values()) {
        for (const [dx, dz] of AROUND) {
          const cx = entry.cx + dx;
          const cz = entry.cz + dz;
          const key = cellKey(cx, cz);
          if (!present.has(key) || affected.has(key)) continue;
          if (rough && valueNoise(cx / 2.6 + 17.3, cz / 2.3 - 9.1) < ROUGH_SKIP) continue;
          const ring = { cx, cz, height: nextLevel, zone: false };
          affected.set(key, ring);
          next.set(key, ring);
        }
      }
      if (!next.size) break;
      frontier = next;
      nextLevel -= sign * drop;
    }
    const slope = [];
    for (const entry of affected.values()) {
      if (entry.zone) continue;
      if (mode === 'remove') {
        slope.push(entry);
        continue;
      }
      const current = this.cellHeightValue(entry.cx, entry.cz);
      if (sign > 0 ? entry.height > current : entry.height < current) slope.push(entry);
    }
    return { zone: zoneEntries, slope };
  },

  heightDraftShape(draft) {
    if (!draft) return null;
    const brush = BRUSHES[draft.brushKey];
    if (!brush || !(brush.height || brush.heights)) return null;
    const zone = [...draft.cells].map(parseCell);
    if (brush.surface) {
      if (draft.mode === 'remove') return this.beachRemoveShape(draft.brushKey, zone);
      return this.surfaceHeightShape(draft.brushKey, zone, draft.mode);
    }
    return this.heightShape(draft.brushKey, zone, draft.mode);
  },

  beachRemoveShape(brushKey, zone) {
    const brush = BRUSHES[brushKey];
    const surface = brush.surface;
    const chosen = Math.abs(this.brushHeight(brushKey));
    const depth = Number.isFinite(chosen) ? chosen : 0;
    const present = this.presentCells();
    const seen = new Set(zone.map((entry) => cellKey(entry.cx, entry.cz)));
    const slope = [];
    let frontier = zone.map((entry) => ({ cx: entry.cx, cz: entry.cz }));
    for (let level = depth - 1; level >= 0; level -= 1) {
      const next = [];
      for (const entry of frontier) {
        for (const [dx, dz] of AROUND) {
          const cx = entry.cx + dx;
          const cz = entry.cz + dz;
          const key = cellKey(cx, cz);
          if (seen.has(key) || !present.has(key)) continue;
          if (this.cellHeightValue(cx, cz) >= 0 && this.surfaceAt(cx, cz) !== surface) continue;
          seen.add(key);
          const ring = { cx, cz };
          slope.push(ring);
          next.push(ring);
        }
      }
      if (!next.length) break;
      frontier = next;
    }
    return { zone, slope, rim: [] };
  },

  surfaceHeightShape(brushKey, zone, mode) {
    const shape = this.heightShape(brushKey, zone, mode);
    const brush = BRUSHES[brushKey];
    if (!brush || !brush.option || !this.brushOptionValue(brushKey, brush.option.key)) {
      return { zone: shape.zone, slope: shape.slope, rim: [] };
    }
    const used = new Set([...shape.zone, ...shape.slope].map((entry) => cellKey(entry.cx, entry.cz)));
    const present = this.presentCells();
    const rim = [];
    for (const entry of shape.slope) {
      for (const [dx, dz] of AROUND) {
        const cx = entry.cx + dx;
        const cz = entry.cz + dz;
        const key = cellKey(cx, cz);
        if (used.has(key) || !present.has(key)) continue;
        used.add(key);
        rim.push({ cx, cz });
      }
    }
    return { zone: shape.zone, slope: shape.slope, rim };
  },

  applyHeightDraft(brushKey, zone, mode) {
    const shape = this.heightShape(brushKey, zone, mode);
    const sign = Math.sign(this.brushHeight(brushKey));
    let count = 0;
    if (mode === 'remove') {
      for (const entry of [...shape.zone, ...shape.slope]) {
        const current = this.cellHeightValue(entry.cx, entry.cz);
        if (sign > 0 ? current > 0 : current < 0) {
          this.setCellHeight(entry.cx, entry.cz, 0);
          count += 1;
        }
      }
      return count;
    }
    for (const entry of shape.zone) {
      this.setCellHeight(entry.cx, entry.cz, entry.height);
      count += 1;
    }
    for (const entry of shape.slope) {
      this.setCellHeight(entry.cx, entry.cz, entry.height);
      count += 1;
    }
    return count;
  },

  markHeightCell(cx, cz) {
    if (!this.layout) return;
    if (!this.heightDraft) this.heightDraft = new Map();
    if (this.heightFromNeighbors) {
      let added = false;
      for (const [x, z] of this.heightStampCells(cx, cz)) {
        const key = cellKey(x, z);
        if (this.heightAuto.has(key)) continue;
        this.heightAuto.add(key);
        this.heightDraft.set(key, 0);
        added = true;
      }
      if (!added) return;
      this.refreshAutoHeights();
      if (this.onHeightDraftChange) this.onHeightDraftChange(this.heightDraft);
      return;
    }
    const stepping = this.heightStepSign !== 0;
    const base = this.strokeHeightLevel();
    let changed = false;
    for (const [x, z] of this.heightStampCells(cx, cz)) {
      const key = cellKey(x, z);
      const wasAuto = this.heightAuto.delete(key);
      if (wasAuto) changed = true;
      const level = this.stampLevel(base, x, z);
      if (stepping) {
        if (this.heightDraft.has(key) && !wasAuto) continue;
        this.heightDraft.set(key, level);
        changed = true;
        continue;
      }
      if (this.heightDraft.get(key) === level) continue;
      this.heightDraft.set(key, level);
      changed = true;
    }
    if (!changed) return;
    if (stepping) this.heightStrokeStep += 1;
    this.refreshAutoHeights();
    if (this.onHeightDraftChange) this.onHeightDraftChange(this.heightDraft);
  },

  stampLevel(base, cx, cz) {
    const jitter = this.heightJitter || 0;
    if (!jitter) return base;
    const offset = Math.round((hash01(cx * 7.31 + 3.7, cz * 5.13 - 1.9) * 2 - 1) * jitter);
    return clampLevel(base + offset);
  },

  strokeHeightLevel() {
    const level = this.heightLevel + this.heightStepSign * this.heightStrokeStep;
    return clampLevel(level);
  },

  unmarkHeightCell(cx, cz) {
    if (!this.heightDraft) return false;
    let changed = false;
    for (const [x, z] of this.heightStampCells(cx, cz)) {
      const key = cellKey(x, z);
      this.heightAuto.delete(key);
      if (this.heightDraft.delete(key)) changed = true;
    }
    if (!changed) return false;
    this.refreshAutoHeights();
    if (this.onHeightDraftChange) this.onHeightDraftChange(this.heightDraft);
    return true;
  },

  heightLevelAt(cx, cz) {
    if (!this.heightDraft) return null;
    const level = this.heightDraft.get(cellKey(cx, cz));
    return Number.isFinite(level) ? level : null;
  },

  heightDraftGroups() {
    if (!this.heightDraft || !this.heightDraft.size) return [];
    const groups = new Map();
    for (const [key, level] of this.heightDraft) {
      const { cx, cz } = parseCell(key);
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push([cx, cz]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([level, cells]) => ({ level, cells }));
  },

  applyHeightSelection() {
    if (!this.layout || !this.heightDraft || !this.heightDraft.size) return 0;
    this.pushHistory();
    let count = 0;
    const touched = [];
    for (const [key, level] of this.heightDraft) {
      const { cx, cz } = parseCell(key);
      const value = Number.isFinite(level) ? level : this.heightLevel;
      this.setCellHeight(cx, cz, value * HEIGHT_STEP);
      touched.push([cx, cz]);
      count += 1;
    }
    this.cleanFlatCliffs(touched);
    this.cancelHeightDraft();
    this.repaintHeights();
    return count;
  },

  cleanFlatCliffs(cells) {
    const seen = new Set();
    for (const [cx, cz] of cells) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) seen.add(cellKey(cx + dx, cz + dz));
      }
    }
    for (const key of seen) {
      const { cx, cz } = parseCell(key);
      const floor = floorCellAt(this.layout, cx, cz);
      if (!floor || floor.cliff !== true) continue;
      const height = floor.liftY || 0;
      const stepped = SIDES.some(([dx, dz]) => {
        const near = layerLiftAt(this.layout, cx + dx, cz + dz);
        return Number.isFinite(near) && Math.abs(near - height) > HEIGHT_STEP + 0.01;
      });
      if (stepped) continue;
      delete floor.cliff;
      delete floor.cliffStyle;
    }
  },

  cancelHeightDraft() {
    if (!this.heightDraft) return false;
    this.heightDraft = null;
    this.heightAuto.clear();
    if (this.onHeightDraftChange) this.onHeightDraftChange(null);
    return true;
  },

  repaintHeights() {
    this.commitHistory();
    this.contentIndex = null;
    this.presentCache = null;
    if (this.onHeightsChange) this.onHeightsChange(this.layout);
    else this.repaint();
  },
};
