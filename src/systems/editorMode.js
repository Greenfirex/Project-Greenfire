// Editační režim mapy — malování zón štětcem, modelování výšek a okamžité přegenerování.
// Přepíná se F1, drží jen layout a historii úprav; vykreslování si řídí scéna.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import {
  addZoneCell, removeZoneCell, brushAt, manualAt, heightAt, setHeight,
  cloneLayout, cellKey, MAX_HEIGHT,
  addManualEntry, removeManualAt, rotateManualAt,
  pathOverrideAt, setPathOverride, clearPathOverride, rotatePathOverrideAt,
  waterOverrideAt, setWaterOverride, clearWaterOverride, rotateWaterOverrideAt,
} from '../data/maps/layoutStore.js';

const HISTORY_LIMIT = 100;

export default class EditorMode {

  constructor() {
    this.active = false;
    this.mode = 'zone';
    this.brushKey = 'forest_exact';
    this.tileKey = null;
    this.pathStyle = 'dirt';
    this.erasing = false;
    this.manualMode = false;
    this.heightLevel = 2;
    this.layout = null;
    this.draft = null;
    this.brushOpts = {};
    this.history = [];
    this.pending = false;
    this.onRegenerate = null;
    this.onChange = null;
    this.onModeChange = null;
    this.onHeightChange = null;
    this.onDraftChange = null;
    this.onStyleChange = null;
    this.onTileChange = null;
    this.onManualModeChange = null;
  }

  attach(layout) {
    this.layout = layout;
    this.history = [];
  }

  toggle() {
    this.active = !this.active;
    if (this.onChange) this.onChange(this.active);
    return this.active;
  }

  pushHistory() {
    if (!this.layout) return;
    this.history.push(cloneLayout(this.layout));
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  undo() {
    if (this.draft) {
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
    }
    if (!this.history.length) return false;
    this.restoreLayout(this.history.pop());
    this.repaint();
    return true;
  }

  get canUndo() {
    return this.history.length > 0;
  }

  setBrush(key) {
    if (!BRUSHES[key]) return;
    if (this.brushKey !== key && this.draft) this.cancelDraft();
    this.brushKey = key;
    this.manualMode = false;
    this.pathStyle = this.styleFor(key);
    this.syncTileKey();
    if (this.onBrushChange) this.onBrushChange(key);
  }

  syncTileKey() {
    const pool = this.brushPool();
    if (!pool.length) {
      this.tileKey = null;
      return;
    }
    if (!pool.includes(this.tileKey)) this.tileKey = pool[0];
  }

  brushPool(brushKey = this.brushKey) {
    const brush = BRUSHES[brushKey];
    if (!brush) return [];
    if (brush.poolByStyle) return brush.poolByStyle[this.styleFor(brushKey)] || [];
    return brush.pool || [];
  }

  isManualBrush(brushKey = this.brushKey) {
    const brush = BRUSHES[brushKey];
    return Boolean(brush && brush.manual && this.manualMode && brush.poolByStyle && this.mode !== 'height');
  }

  setManualMode(on) {
    const next = Boolean(on);
    if (this.manualMode === next) return;
    this.manualMode = next;
    if (next) this.cancelDraft();
    this.syncTileKey();
    if (this.onManualModeChange) this.onManualModeChange(next, this.tileKey);
  }

  setBrushOpts(key, opts) {
    if (!BRUSHES[key]) return;
    if (opts) this.brushOpts[key] = { ...opts };
    else delete this.brushOpts[key];
  }

  getBrushOpts(key) {
    return this.brushOpts[key] || null;
  }

  setMode(mode) {
    if (mode !== 'zone' && mode !== 'height') return;
    this.mode = mode;
    this.erasing = false;
    if (this.draft) {
      this.draft = null;
      if (this.onDraftChange) this.onDraftChange(null);
    }
    if (this.onModeChange) this.onModeChange(mode);
  }

  setTileKey(key) {
    if (!this.brushPool().includes(key)) return;
    this.tileKey = key;
    if (this.onTileChange) this.onTileChange(key);
  }

  setStyle(styleKey) {
    const brush = BRUSHES[this.brushKey];
    const keys = brush ? (brush.styles || Object.keys(brush.poolByStyle || {})) : [];
    if (!keys.includes(styleKey)) return;
    if (this.styleFor(this.brushKey) === styleKey) return;
    this.brushOpts[this.brushKey] = { ...(this.brushOpts[this.brushKey] || {}), style: styleKey };
    this.pathStyle = styleKey;
    this.syncTileKey();
    if (this.draft) this.draft.opts = { ...(this.draft.opts || {}), style: styleKey };
    if (this.onStyleChange) this.onStyleChange(this.brushKey, styleKey);
    if (this.onTileChange) this.onTileChange(this.tileKey);
  }

  styleFor(brushKey) {
    const opts = this.brushOpts[brushKey];
    const brush = BRUSHES[brushKey];
    if (opts && opts.style) return opts.style;
    if (brush && brush.style) return brush.style;
    if (brush && brush.poolByStyle) {
      const keys = Object.keys(brush.poolByStyle);
      if (keys.length) return keys[0];
    }
    return 'dirt';
  }

  placeAt(cx, cz, rotation = 0) {
    if (!this.active || !this.layout) return false;
    if (!this.isManualBrush()) return false;
    if (!this.tileKey || !getDecoration(this.tileKey)) return false;
    this.pushHistory();
    if (this.isWaterCell(cx, cz)) setWaterOverride(this.layout, cx, cz, this.tileKey, rotation);
    else if (this.isPathCell(cx, cz)) setPathOverride(this.layout, cx, cz, this.tileKey, rotation);
    else addManualEntry(this.layout, this.tileKey, cx, cz, rotation);
    this.scheduleRegenerate();
    return true;
  }

  rotateAt(cx, cz, delta = 1) {
    if (!this.active || !this.layout) return false;
    const water = waterOverrideAt(this.layout, cx, cz);
    if (water) {
      this.pushHistory();
      rotateWaterOverrideAt(this.layout, cx, cz, delta);
      this.scheduleRegenerate();
      return true;
    }
    const override = pathOverrideAt(this.layout, cx, cz);
    if (override) {
      this.pushHistory();
      rotatePathOverrideAt(this.layout, cx, cz, delta);
      this.scheduleRegenerate();
      return true;
    }
    if (!manualAt(this.layout, cx, cz)) return false;
    this.pushHistory();
    rotateManualAt(this.layout, cx, cz, delta);
    this.scheduleRegenerate();
    return true;
  }

  deleteAt(cx, cz) {
    if (!this.active || !this.layout) return false;
    this.pushHistory();
    const hadWater = clearWaterOverride(this.layout, cx, cz);
    const hadOverride = clearPathOverride(this.layout, cx, cz);
    const hadManual = removeManualAt(this.layout, cx, cz);
    if (!hadWater && !hadOverride && !hadManual) {
      this.history.pop();
      return false;
    }
    this.scheduleRegenerate();
    return true;
  }

  isWaterCell(cx, cz) {
    if (!this.layout) return false;
    if (waterOverrideAt(this.layout, cx, cz)) return true;
    return brushAt(this.layout, cx, cz) === 'water';
  }

  isPathCell(cx, cz) {
    if (!this.layout) return false;
    if (pathOverrideAt(this.layout, cx, cz)) return true;
    const brushKey = brushAt(this.layout, cx, cz);
    const brush = brushKey ? BRUSHES[brushKey] : null;
    return Boolean(brush && brush.shape === 'line');
  }

  setHeightLevel(level) {
    const n = Math.max(0, Math.min(MAX_HEIGHT, Math.round(Number(level))));
    if (!Number.isFinite(n)) return;
    this.heightLevel = n;
    if (this.onHeightChange) this.onHeightChange(n);
  }

  stepHeightLevel(delta) {
    this.setHeightLevel(this.heightLevel + delta);
  }

  paint(cx, cz) {
    if (!this.active || !this.layout) return;
    if (this.mode !== 'height') return;
    this.pushHistory();
    this.applyCell(cx, cz);
    this.scheduleRegenerate();
  }

  paintRun(from, to) {
    if (!this.active || !this.layout) return;
    if (this.mode !== 'height') return;
    this.pushHistory();
    for (const [cx, cz] of bresenham(from.cx, from.cz, to.cx, to.cz)) this.applyCell(cx, cz);
    this.scheduleRegenerate();
  }

  beginDraft(brushKey) {
    if (!this.layout) return;
    if (!BRUSHES[brushKey]) return;
    const opts = this.brushOpts[brushKey];
    if (this.draft && this.draft.brushKey === brushKey) {
      if (opts) this.draft.opts = { ...opts };
      else delete this.draft.opts;
      return;
    }
    if (this.draft) this.cancelDraft();
    this.draft = { brushKey, cells: new Set(), mode: this.erasing ? 'remove' : 'add' };
    if (opts) this.draft.opts = { ...opts };
    if (this.onDraftChange) this.onDraftChange(this.draft);
  }

  setDraftMode(mode) {
    const next = mode === 'remove' ? 'remove' : 'add';
    if (this.erasing === (next === 'remove')) {
      if (this.draft && this.draft.mode !== next) {
        this.draft.mode = next;
        this.draft.cells.clear();
        if (this.onDraftChange) this.onDraftChange(this.draft);
      }
      return;
    }
    this.erasing = next === 'remove';
    if (this.draft) {
      this.draft.mode = next;
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
    }
  }

  setDraftOpts(opts) {
    if (!this.draft) return;
    if (opts) this.draft.opts = { ...opts };
    else delete this.draft.opts;
  }

  get hasDraft() {
    return Boolean(this.draft);
  }

  get draftMode() {
    return this.draft ? this.draft.mode : (this.erasing ? 'remove' : 'add');
  }

  canDraftCell(cx, cz) {
    if (!this.draft) return false;
    if (this.draft.mode === 'remove') return Boolean(brushAt(this.layout, cx, cz));
    return true;
  }

  draftCell(cx, cz) {
    if (!this.draft) return false;
    if (!this.canDraftCell(cx, cz)) return false;
    this.draft.cells.add(cellKey(cx, cz));
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  }

  draftRun(from, to) {
    if (!this.draft) return true;
    for (const [cx, cz] of bresenham(from.cx, from.cz, to.cx, to.cz)) {
      if (!this.canDraftCell(cx, cz)) continue;
      this.draft.cells.add(cellKey(cx, cz));
    }
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  }

  applyDraft() {
    if (!this.draft) return 0;
    const { brushKey, cells, opts, mode } = this.draft;
    if (!cells.size) {
      if (this.onDraftChange) this.onDraftChange(this.draft);
      return 0;
    }
    this.pushHistory();
    for (const key of cells) {
      const [cx, cz] = key.split(',').map(Number);
      if (mode === 'remove') removeZoneCell(this.layout, cx, cz);
      else addZoneCell(this.layout, brushKey, cx, cz, opts);
    }
    const count = cells.size;
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    this.scheduleRegenerate();
    return count;
  }

  cancelDraft() {
    if (!this.draft) return false;
    this.draft = null;
    if (this.onDraftChange) this.onDraftChange(null);
    return true;
  }

  applyCell(cx, cz) {
    if (this.mode === 'height') {
      this.clearCellForHeight(cx, cz);
      setHeight(this.layout, cx, cz, this.erasing ? 0 : this.heightLevel);
      return;
    }
    if (this.erasing) removeZoneCell(this.layout, cx, cz);
    else addZoneCell(this.layout, this.brushKey, cx, cz);
  }

  clearCellForHeight(cx, cz) {
    removeZoneCell(this.layout, cx, cz);
    this.layout.manual = this.layout.manual.filter((m) => m.cx !== cx || m.cz !== cz);
  }

  smoothHeights() {
    if (!this.active || !this.layout) return;
    if (!this.layout.height || !this.layout.height.length) return;
    this.pushHistory();
    for (let pass = 0; pass < MAX_HEIGHT; pass++) {
      let changed = false;
      const source = this.layout.height.slice();
      for (const [key, level] of source) {
        const [cx, cz] = key.split(',').map(Number);
        for (const [dx, dz] of ORTHO) {
          const nx = cx + dx;
          const nz = cz + dz;
          const current = heightAt(this.layout, nx, nz);
          const base = current === null ? 0 : current;
          if (base >= level - 1) continue;
          setHeight(this.layout, nx, nz, level - 1);
          changed = true;
        }
      }
      if (!changed) break;
    }
    this.scheduleRegenerate();
  }

  scheduleRegenerate() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      if (this.onRegenerate) this.onRegenerate(this.layout);
    });
  }

  repaint() {
    this.pending = false;
    if (this.onRegenerate) this.onRegenerate(this.layout);
  }

  restoreLayout(next) {
    this.layout = next;
    this.history = this.history.map((entry) => (entry === next ? cloneLayout(next) : entry));
  }

  regenerate() {
    this.repaint();
  }

  describeAt(cx, cz) {
    const brushKey = brushAt(this.layout, cx, cz);
    const manual = manualAt(this.layout, cx, cz);
    const height = heightAt(this.layout, cx, cz);
    const override = pathOverrideAt(this.layout, cx, cz);
    const brush = brushKey ? BRUSHES[brushKey] : null;
    const isPath = Boolean(brush && brush.shape === 'line');
    return {
      brush: brushKey,
      manual,
      height,
      override,
      isPath,
      style: isPath ? this.styleFor(brushKey) : null,
      pool: this.brushPool(),
      key: cellKey(cx, cz),
    };
  }
}

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function bresenham(x0, z0, x1, z1) {
  const out = [];
  let dx = Math.abs(x1 - x0);
  let dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let x = x0;
  let z = z0;
  while (true) {
    out.push([x, z]);
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return out;
}
