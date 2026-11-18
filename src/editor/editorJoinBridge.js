// Část editoru: spojnice mezi výškami a skalní mosty — výběr dvou bodů a jejich zapsání do mapy.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { bridgeSpan, bridgeCells } from '../utils/bridgeShape.js';
import { parseCell, bresenham, clampLevel } from './editorSettings.js';

const BRIDGE_MIN_GAP = 0.8;
const BRIDGE_MAX_BANK_STEP = 3;

function joinMeters(topMeters, bottomMeters, index, steps) {
  const raw = topMeters + (bottomMeters - topMeters) * (index / steps);
  const level = clampLevel(Math.round(raw / HEIGHT_STEP));
  return level * HEIGHT_STEP;
}

export default {
  pickJoinCell(cx, cz) {
    if (!this.draft || !this.layout) return 'invalid';
    if (!this.canEditCell(cx, cz)) return 'invalid';
    const height = this.cellHeightValue(cx, cz);
    if (!this.joinTop) {
      this.joinTop = { cx, cz, height };
      this.joinHeights = null;
      this.joinInfo = null;
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      return 'top';
    }
    this.buildJoin(cx, cz, height);
    return 'ready';
  },

  buildJoin(cx, cz, bottomHeight) {
    const top = this.joinTop;
    if (!top) return;
    const line = bresenham(top.cx, top.cz, cx, cz);
    const steps = Math.max(1, line.length - 1);
    const width = Math.max(1, Math.round(this.brushOptionValue(this.brushKey, 'width')));
    const radius = Math.floor((width - 1) / 2);
    const heights = new Map();
    const seen = new Set();
    let maxStep = 0;
    let previous = null;
    this.draft.cells.clear();
    for (let index = 0; index < line.length; index += 1) {
      const [lineX, lineZ] = line[index];
      const meters = joinMeters(top.height, bottomHeight, index, steps);
      if (previous !== null) maxStep = Math.max(maxStep, Math.abs(meters - previous));
      previous = meters;
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const cellX = lineX + dx;
          const cellZ = lineZ + dz;
          const key = cellKey(cellX, cellZ);
          if (seen.has(key)) continue;
          if (!this.canDraftCell(cellX, cellZ)) continue;
          seen.add(key);
          heights.set(key, meters);
          this.draft.cells.add(key);
        }
      }
    }
    this.joinHeights = heights;
    this.joinBottom = { cx, cz, height: bottomHeight };
    this.joinInfo = { count: heights.size, maxStep, drop: Math.abs(top.height - bottomHeight) };
    if (this.onDraftChange) this.onDraftChange(this.draft);
  },

  joinMetersAt(cx, cz) {
    if (!this.joinHeights) return null;
    const value = this.joinHeights.get(cellKey(cx, cz));
    return value === undefined ? null : value;
  },

  cancelJoin() {
    if (!this.draft) return false;
    this.resetJoin();
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  },

  resetJoin() {
    this.joinTop = null;
    this.joinBottom = null;
    this.joinHeights = null;
    this.joinInfo = null;
  },

  bridgeWidth() {
    return Math.round(Number(this.brushOptionValue(this.brushKey, 'width')));
  },

  bridgeAt(cx, cz) {
    for (const record of (this.layout && this.layout.bridges) || []) {
      if (!record) continue;
      if (bridgeCells(record).some(([x, z]) => x === cx && z === cz)) return record;
    }
    return null;
  },

  bridgeOverlaps(cells) {
    const taken = new Set();
    for (const record of (this.layout && this.layout.bridges) || []) {
      for (const [cx, cz] of bridgeCells(record)) taken.add(cellKey(cx, cz));
    }
    return cells.some(([cx, cz]) => taken.has(cellKey(cx, cz)));
  },

  resetBridge() {
    this.bridgeTop = null;
    this.pendingBridge = null;
    this.bridgeInfo = null;
  },

  cancelBridge() {
    if (!this.draft) return false;
    this.resetBridge();
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  },

  pickBridgeCell(cx, cz) {
    if (!this.draft || !this.layout) return 'invalid';
    if (!this.canEditCell(cx, cz)) return 'invalid';
    const height = this.cellHeightValue(cx, cz);
    const top = this.bridgeTop;
    if (!top) {
      this.bridgeTop = { cx, cz, height };
      this.bridgeInfo = null;
      this.draft.cells.clear();
      this.draft.cells.add(cellKey(cx, cz));
      if (this.onDraftChange) this.onDraftChange(this.draft);
      return 'top';
    }
    return this.buildBridgeSpan(cx, cz, height) ? 'ready' : 'bad';
  },

  buildBridgeSpan(cx, cz, toHeight) {
    const top = this.bridgeTop;
    if (!top) return false;
    const record = {
      ax: top.cx,
      az: top.cz,
      bx: cx,
      bz: cz,
      width: this.bridgeWidth(),
      style: this.styleFor(this.brushKey),
    };
    this.pendingBridge = null;
    this.bridgeInfo = null;
    const span = bridgeSpan(record);
    const cells = span ? bridgeCells(record) : [];
    const aligned = (top.cx === cx) !== (top.cz === cz);
    if (!aligned) {
      this.draft.cells.clear();
      this.draft.cells.add(cellKey(top.cx, top.cz));
      this.draft.cells.add(cellKey(cx, cz));
      if (this.onDraftChange) this.onDraftChange(this.draft);
      return false;
    }
    let bankLow = Infinity;
    let gapHigh = -Infinity;
    for (const [x, z] of cells) {
      if (!this.canEditCell(x, z)) return false;
      const isBank = span.axis === 'x' ? (x === span.from || x === span.to) : (z === span.from || z === span.to);
      const value = this.cellHeightValue(x, z);
      if (isBank) bankLow = Math.min(bankLow, value);
      else gapHigh = Math.max(gapHigh, value);
    }
    if (!(bankLow > gapHigh + BRIDGE_MIN_GAP)) return false;
    if (!Number.isFinite(toHeight) || Math.abs(top.height - toHeight) > BRIDGE_MAX_BANK_STEP) return false;
    if (this.bridgeOverlaps(cells)) return false;
    this.pendingBridge = { ...record, toHeight };
    this.bridgeInfo = {
      span: Math.abs(span.axis === 'x' ? cx - top.cx : cz - top.cz),
      drop: bankLow - gapHigh,
    };
    this.draft.cells.clear();
    for (const [x, z] of cells) this.draft.cells.add(cellKey(x, z));
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  },

  applyBridge(mode) {
    if (!this.layout) return 0;
    if (!Array.isArray(this.layout.bridges)) this.layout.bridges = [];
    if (mode === 'remove') {
      const targets = new Set(this.draft ? [...this.draft.cells] : []);
      const keep = [];
      let count = 0;
      for (const record of this.layout.bridges) {
        if (bridgeCells(record).some(([cx, cz]) => targets.has(cellKey(cx, cz)))) count += 1;
        else keep.push(record);
      }
      this.layout.bridges = keep;
      return count;
    }
    if (!this.pendingBridge) return 0;
    this.layout.bridges.push({
      ax: this.pendingBridge.ax,
      az: this.pendingBridge.az,
      bx: this.pendingBridge.bx,
      bz: this.pendingBridge.bz,
      width: this.pendingBridge.width,
      style: this.pendingBridge.style,
    });
    return 1;
  },

  applyJoin() {
    if (!this.layout || !this.draft || !this.joinHeights) return 0;
    let count = 0;
    for (const [key, meters] of this.joinHeights) {
      const { cx, cz } = parseCell(key);
      this.setCellHeight(cx, cz, meters);
      count += 1;
    }
    return count;
  },
};
