// Editační režim mapy — vyplňování buněk štětcem, modelování výšek a práce s plochou.
// Přepíná se F1, drží jen hotovou mapu a historii úprav; vykreslování si řídí scéna.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { cellKey, MAX_HEIGHT } from '../data/maps/layoutStore.js';
import { hasLayerCell, layerAt, dropLayerCell, dropDecorationCell, dropAreaCells } from '../data/maps/areaShape.js';

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
    this.areaTool = 'paint';
    this.areaSelection = null;
    this.areaDrag = null;
    this.areaStroke = null;
    this.realCells = null;
    this.brushOpts = {};
    this.history = [];
    this.onRegenerate = null;
    this.onChange = null;
    this.onModeChange = null;
    this.onHeightChange = null;
    this.onDraftChange = null;
    this.onAreaSelectionChange = null;
    this.onStyleChange = null;
    this.onTileChange = null;
    this.onManualModeChange = null;
    this.onRestore = null;
  }

  attach(world) {
    this.history = [];
    this.layout = toWorld(world || {});
  }

  getMap() {
    return this.layout;
  }

  toggle() {
    this.active = !this.active;
    if (this.onChange) this.onChange(this.active);
    return this.active;
  }

  pushHistory() {
    if (!this.layout) return;
    this.history.push(toWorld(this.layout));
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
    if (mode !== 'zone' && mode !== 'height' && mode !== 'area') return;
    this.mode = mode;
    this.erasing = false;
    this.areaDrag = null;
    this.areaStroke = null;
    this.clearAreaSelection();
    if (this.draft) {
      this.draft = null;
      if (this.onDraftChange) this.onDraftChange(null);
    }
    if (this.onModeChange) this.onModeChange(mode);
  }

  canEditCell(cx, cz) {
    return this.mode === 'area' || this.areaExists(cx, cz);
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
    this.placeEntry(this.tileKey, cx, cz, rotation);
    this.scheduleRegenerate();
    return true;
  }

  rotateAt(cx, cz, delta = 1) {
    if (!this.active || !this.layout) return false;
    const tile = this.layerTileAt(cx, cz);
    if (tile) {
      this.pushHistory();
      tile.rotation = ((tile.rotation || 0) + delta + 4) % 4;
      this.scheduleRegenerate();
      return true;
    }
    const entry = this.topEntryAt(cx, cz);
    if (!entry) return false;
    this.pushHistory();
    entry.rotation = ((entry.rotation || 0) + delta + 4) % 4;
    this.scheduleRegenerate();
    return true;
  }

  deleteAt(cx, cz) {
    if (!this.active || !this.layout) return false;
    const entry = this.topEntryAt(cx, cz);
    if (!entry) return false;
    this.pushHistory();
    this.dropTopEntry(cx, cz);
    this.scheduleRegenerate();
    return true;
  }

  isWaterCell(cx, cz) {
    if (!this.layout) return false;
    return layerAt(this.layout, cx, cz) === 'water';
  }

  isPathCell(cx, cz) {
    if (!this.layout) return false;
    const layer = layerAt(this.layout, cx, cz);
    if (layer === 'path') return true;
    if (layer === 'floor') return false;
    return this.brushShapeAt(cx, cz) === 'line';
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
    if (this.mode === 'area') {
      this.areaDrag = null;
      this.areaStroke = null;
      this.setAreaSelection({ tool: this.areaTool, cells: [[cx, cz]], drag: null });
      return;
    }
    if (this.mode !== 'height') return;
    this.pushHistory();
    this.applyCell(cx, cz);
    this.scheduleRegenerate();
  }

  paintRun(from, to) {
    if (!this.active || !this.layout) return;
    if (this.mode === 'area') {
      this.areaDrag = null;
      this.areaStroke = null;
      this.setAreaSelection({ tool: this.areaTool, cells: bresenham(from.cx, from.cz, to.cx, to.cz), drag: null });
      return;
    }
    if (this.mode !== 'height') return;
    this.pushHistory();
    for (const [cx, cz] of bresenham(from.cx, from.cz, to.cx, to.cz)) this.applyCell(cx, cz);
    this.scheduleRegenerate();
  }

  dropTopEntry(cx, cz) {
    dropDecorationCell(this.layout, cx, cz);
  }

  layerTileAt(cx, cz) {
    const layer = layerAt(this.layout, cx, cz);
    if (!layer) return null;
    const list = this.layout[layer] || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].cx === cx && list[i].cz === cz) return list[i];
    }
    return null;
  }

  useLayout(world) {
    if (!world) return;
    this.restoreLayout(world);
  }

  topEntryAt(cx, cz) {
    const tile = this.layerTileAt(cx, cz);
    if (tile) return tile;
    const list = this.layout.decorations || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].cx === cx && list[i].cz === cz) return list[i];
    }
    return null;
  }

  brushShapeAt(cx, cz) {
    return BRUSHES[this.brushKey] ? BRUSHES[this.brushKey].shape : null;
  }

  placeEntry(key, cx, cz, rotation = 0, liftY = 0, layer = null) {
    const entry = { key, cx, cz, rotation: ((rotation % 4) + 4) % 4 };
    if (liftY) entry.liftY = liftY;
    const target = layer || (this.isWaterCell(cx, cz) ? 'water' : this.isPathCell(cx, cz) ? 'path' : 'floor');
    dropLayerCell(this.layout, cx, cz);
    this.layout[target].push(entry);
    return entry;
  }

  setTileLift(cx, cz, height) {
    for (const layer of ['floor', 'path', 'water', 'clearing']) {
      for (let i = (this.layout[layer] || []).length - 1; i >= 0; i -= 1) {
        const entry = this.layout[layer][i];
        if (entry.cx !== cx || entry.cz !== cz) continue;
        if (height > 0) entry.liftY = height;
        else delete entry.liftY;
        return entry;
      }
    }
    return null;
  }

  heightLevels() {
    const levels = new Map();
    for (const layer of ['floor', 'path', 'water', 'clearing']) {
      for (const entry of this.layout[layer] || []) {
        const level = Math.round((entry.liftY || 0) / HEIGHT_STEP);
        if (level > 0 && !levels.has(cellKey(entry.cx, entry.cz))) levels.set(cellKey(entry.cx, entry.cz), level);
      }
    }
    return levels;
  }

  beginAreaDrag(cx, cz) {
    if (!this.layout) return;
    this.areaStroke = new Map();
    this.areaDrag = { mode: this.areaTool, fromX: cx, fromZ: cz, toX: cx, toZ: cz };
    this.areaStroke.set(cellKey(cx, cz), [cx, cz]);
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells(), drag: this.areaDrag });
  }

  moveAreaDrag(cx, cz) {
    const drag = this.areaDrag;
    if (!drag) return;
    if (drag.toX === cx && drag.toZ === cz) return;
    this.extendAreaDrag(cx, cz);
  }

  extendAreaDrag(cx, cz) {
    const drag = this.areaDrag;
    for (const [x, z] of areaRectOf(drag.fromX, drag.fromZ, cx, cz)) {
      if (!this.areaStroke.has(cellKey(x, z))) this.areaStroke.set(cellKey(x, z), [x, z]);
    }
    drag.toX = cx;
    drag.toZ = cz;
    this.setAreaSelection({ tool: drag.mode, cells: this.strokeCells(), drag });
  }

  finishAreaDrag() {
    const drag = this.areaDrag;
    if (!drag) return;
    this.areaDrag = null;
    this.setAreaSelection({ tool: drag.mode, cells: this.strokeCells(), drag: null });
    this.areaStroke = null;
  }

  strokeCells() {
    return [...(this.areaStroke || new Map()).values()];
  }

  setAreaTool(tool) {
    const next = tool === 'erase' ? 'erase' : 'paint';
    if (this.areaTool === next) return;
    this.areaTool = next;
    this.areaDrag = null;
    this.areaStroke = null;
    this.clearAreaSelection();
  }

  setAreaSelection(selection) {
    const cells = selection && selection.cells ? selection.cells : [];
    this.areaSelection = cells.length ? selection : null;
    if (this.onAreaSelectionChange) this.onAreaSelectionChange(this.areaSelection);
  }

  clearAreaSelection() {
    if (!this.areaSelection) return;
    this.areaSelection = null;
    if (this.onAreaSelectionChange) this.onAreaSelectionChange(null);
  }

  get hasAreaSelection() {
    return Boolean(this.areaSelection && this.areaSelection.cells.length);
  }

  get areaSelectionCount() {
    return this.areaSelection ? this.areaSelection.cells.length : 0;
  }

  areaExists(cx, cz) {
    return Boolean(this.realCells && this.realCells.some(([ax, az]) => ax === cx && az === cz));
  }

  assignRealCells(cells) {
    this.realCells = cells && cells.length ? cells.map(([cx, cz]) => [cx, cz]) : null;
  }

  pendingAreaCells() {
    const selection = this.areaSelection;
    if (!selection || !selection.cells.length) return 0;
    return selection.cells.filter(([cx, cz]) => (selection.tool === 'erase') === this.areaExists(cx, cz)).length;
  }

  applyAreaSelection() {
    const selection = this.areaSelection;
    if (!selection || !this.layout || !selection.cells.length) return 0;
    const erasing = selection.tool === 'erase';
    this.pushHistory();
    let count = 0;
    if (erasing) {
      count = dropAreaCells(this.layout, selection.cells);
      for (const [cx, cz] of selection.cells) {
        if (dropDecorationCell(this.layout, cx, cz)) count += 1;
      }
    } else {
      for (const [cx, cz] of selection.cells) {
        const liftY = this.raiseToLevel(cx, cz);
        this.placeEntry(this.tileKey || FALLBACK_FLOOR, cx, cz, 0, liftY);
        count += 1;
      }
    }
    if (!count) {
      this.history.pop();
      this.clearAreaSelection();
      return 0;
    }
    this.clearAreaSelection();
    this.scheduleRegenerate();
    return count;
  }

  raiseToLevel(cx, cz) {
    const level = this.heightLevel;
    const height = level > 0 ? level * HEIGHT_STEP : 0;
    this.setTileLift(cx, cz, height);
    return height;
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
    if (this.draft.mode === 'remove') return hasLayerCell(this.layout, cx, cz);
    return this.canEditCell(cx, cz);
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
    const brush = BRUSHES[brushKey] || {};
    const shape = brush.shape;
    const fillKey = brush.deco ? ((opts && opts.key) || this.tileKey) : (brush.tile || FALLBACK_FLOOR);
    const stepLevel = brush.height ? brush.height / HEIGHT_STEP : this.heightLevel;
    const liftY = shape === 'line' ? 0 : Math.round(stepLevel) * HEIGHT_STEP;
    for (const key of cells) {
      const [cx, cz] = key.split(',').map(Number);
      if (mode === 'remove') {
        dropLayerCell(this.layout, cx, cz);
        this.dropTopEntry(cx, cz);
        continue;
      }
      if (brush.deco) {
        dropLayerCell(this.layout, cx, cz);
        this.layout.decorations.push({ key: fillKey, cx, cz, rotation: 0 });
        continue;
      }
      if (shape === 'line') this.placeEntry(fillKey, cx, cz, 0, 0, 'path');
      else if (brushKey === 'water') this.placeEntry(fillKey, cx, cz, 0, 0, 'water');
      else this.placeEntry(fillKey, cx, cz, 0, liftY, 'floor');
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
      this.raiseToLevel(cx, cz);
      return;
    }
    if (this.erasing) {
      dropLayerCell(this.layout, cx, cz);
      this.dropTopEntry(cx, cz);
      return;
    }
    this.placeEntry(this.tileKey || FALLBACK_FLOOR, cx, cz, 0, this.heightLevel > 0 ? this.heightLevel * HEIGHT_STEP : 0);
  }

  smoothHeights() {
    if (!this.active || !this.layout) return;
    const levels = this.heightLevels();
    if (!levels.size) return;
    this.pushHistory();
    for (let pass = 0; pass < MAX_HEIGHT; pass += 1) {
      let changed = false;
      const source = [...levels];
      for (const [key, level] of source) {
        const [cx, cz] = key.split(',').map(Number);
        for (const [dx, dz] of ORTHO) {
          const nx = cx + dx;
          const nz = cz + dz;
          const next = level - 1;
          const current = levels.get(cellKey(nx, nz)) || 0;
          if (next <= current) continue;
          this.setTileLift(nx, nz, next * HEIGHT_STEP);
          levels.set(cellKey(nx, nz), next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    this.scheduleRegenerate();
  }

  scheduleRegenerate() {
    this.repaint();
  }

  repaint() {
    if (this.onRegenerate) this.onRegenerate(this.layout);
  }

  get draftKeys() {
    const brush = BRUSHES[this.brushKey];
    if (!brush) return [];
    const keys = [...this.brushPool()];
    if (brush.tile) keys.push(brush.tile);
    return keys;
  }

  get draftTile() {
    const brush = BRUSHES[this.brushKey];
    if (!brush) return null;
    if (brush.tile) return brush.tile;
    return this.tileKey;
  }

  draftTileAt(cx, cz) {
    const layer = layerAt(this.layout, cx, cz);
    if (!layer) return null;
    const list = this.layout[layer] || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const entry = list[i];
      if (entry.cx === cx && entry.cz === cz) return entry.key;
    }
    return null;
  }

  draftDecoAt(cx, cz) {
    const list = this.layout.decorations || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const entry = list[i];
      if (entry.cx === cx && entry.cz === cz) return entry.key;
    }
    return null;
  }

  draftHasSame(cx, cz) {
    const keys = this.draftKeys;
    if (!keys.length) return false;
    const tile = this.draftTileAt(cx, cz);
    if (tile && keys.includes(tile)) return true;
    const deco = this.draftDecoAt(cx, cz);
    return Boolean(deco && keys.includes(deco));
  }

  draftHasContent(cx, cz) {
    if (layerAt(this.layout, cx, cz)) return true;
    return this.draftDecoAt(cx, cz) !== null;
  }

  restoreLayout(next) {
    this.layout = toWorld(next);
  }

  regenerate() {
    this.repaint();
  }

  describeAt(cx, cz) {
    const layer = layerAt(this.layout, cx, cz);
    const entry = this.topEntryAt(cx, cz);
    const level = entry && entry.liftY ? Math.round(entry.liftY / HEIGHT_STEP) : 0;
    return {
      brush: layer,
      manual: entry,
      height: level > 0 ? level : null,
      override: entry,
      isPath: layer === 'path',
      style: layer === 'path' ? this.styleFor(this.brushKey) : null,
      pool: this.brushPool(),
      key: cellKey(cx, cz),
    };
  }
}

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const HEIGHT_STEP = 0.6;
const FALLBACK_FLOOR = 'floor_grass';

function toWorld(world) {
  const groups = worldGroups(world);
  return {
    spawn: world.spawn ? { ...world.spawn } : { cx: 0, cz: 0 },
    seed: world.seed,
    floor: groups.floor,
    path: groups.path,
    water: groups.water,
    clearing: groups.clearing,
    manual: (world.manual || []).map((entry) => ({ ...entry })),
    decorations: (world.decorations || []).map((entry) => ({ ...entry })),
  };
}

function worldGroups(world) {
  const groups = { floor: [], path: [], water: [], clearing: [] };
  if (!world) return groups;
  if (world.entries) {
    const from = new Map();
    for (const entry of world.entries) {
      if (entry && !from.has(entry.key)) from.set(entry.key, layerAt(world, entry.cx, entry.cz));
    }
    for (const entry of world.entries) {
      const name = from.get(entry && entry.key);
      if (groups[name]) groups[name].push({ ...entry });
    }
    return groups;
  }
  for (const name of Object.keys(groups)) {
    groups[name] = (world[name] || []).map((entry) => ({ ...entry }));
  }
  return groups;
}

function areaRectOf(x0, z0, x1, z1) {
  const out = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minZ = Math.min(z0, z1);
  const maxZ = Math.max(z0, z1);
  for (let cx = minX; cx <= maxX; cx += 1) {
    for (let cz = minZ; cz <= maxZ; cz += 1) out.push([cx, cz]);
  }
  return out;
}

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
