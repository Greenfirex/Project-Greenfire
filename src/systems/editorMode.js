// Editační režim mapy — vyplňování buněk štětcem, modelování výšek a práce s plochou.
// Přepíná se F1, drží jen hotovou mapu a historii úprav; vykreslování si řídí scéna.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { cellKey, MAX_HEIGHT } from '../data/maps/layoutStore.js';
import { layerAt, layerEntriesAt, floorCellAt, dropFloorCell, dropLayerCell, dropDecorationCell, dropAreaCells, worldCells } from '../data/maps/areaShape.js';
import { fillZone } from '../utils/zoneFill.js';
import { createRng, seedFor } from '../utils/rng.js';

const HISTORY_LIMIT = 100;
const FALLBACK_FLOOR = 'floor_grass';

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
    this.fixMissingFloor();
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
    return this.brushShapeAt(cx, cz) === 'line';
  }

  isPathBrush(brushKey = this.brushKey) {
    const brush = BRUSHES[brushKey];
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
    if (this.mode === 'area') {
      this.areaDrag = null;
      this.addAreaCells([[cx, cz]]);
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
      this.addAreaCells(bresenham(from.cx, from.cz, to.cx, to.cz));
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

  dropOrphans() {
    const grid = new Set(worldCells(this.layout).map(([cx, cz]) => cellKey(cx, cz)));
    const kept = (this.layout.decorations || []).filter((entry) => entry && grid.has(cellKey(entry.cx, entry.cz)));
    if (kept.length === (this.layout.decorations || []).length) return false;
    this.layout.decorations = kept;
    return true;
  }

  layerTileAt(cx, cz) {
    const entries = layerEntriesAt(this.layout, cx, cz);
    return entries.length ? entries[0] : null;
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
    const explicit = layer;
    const floor = floorCellAt(this.layout, cx, cz);
    if (layer === 'path') {
      entry.style = this.pathStyle;
      if (floor && floor.liftY) entry.liftY = floor.liftY;
      const existing = (this.layout.path || []).find((cell) => cell && cell.cx === cx && cell.cz === cz);
      if (existing) existing.style = entry.style;
      else this.layout.path.push(entry);
      if (this.layout.manual) this.layout.manual = this.layout.manual.filter((cell) => !cell || cell.cx !== cx || cell.cz !== cz);
      if (!floor) this.placeFloor(FALLBACK_FLOOR, cx, cz);
      return entry;
    }
    const target = layer || (this.isWaterCell(cx, cz) ? 'water' : 'floor');
    if (target === 'floor') {
      dropFloorCell(this.layout, cx, cz);
      if (!explicit) this.dropPathAt(cx, cz);
    } else {
      if (floor && floor.liftY && !entry.liftY) entry.liftY = floor.liftY;
      dropLayerCell(this.layout, cx, cz);
      if (floor && !(this.layout.floor || []).includes(floor)) this.layout.floor.push(floor);
      if (!floor) this.placeFloor(FALLBACK_FLOOR, cx, cz);
    }
    this.layout[target].push(entry);
    return entry;
  }

  dropPathAt(cx, cz) {
    for (const name of ['path', 'manual']) {
      const list = this.layout[name] || [];
      const kept = list.filter((entry) => entry.cx !== cx || entry.cz !== cz);
      if (kept.length !== list.length) this.layout[name] = kept;
    }
  }

  keepFloor(cx, cz) {
    const floor = floorCellAt(this.layout, cx, cz);
    return floor ? floor.key : FALLBACK_FLOOR;
  }

  placeFloor(key, cx, cz) {
    this.layout.floor.push({ key, cx, cz, rotation: 0 });
  }

  fixMissingFloor() {
    const cells = worldCells(this.layout);
    if (!cells.length) return 0;
    const seen = new Set();
    for (const [cx, cz] of cells) seen.add(cellKey(cx, cz));
    const place = (cx, cz) => {
      const floorKey = this.keepFloor(cx, cz);
      if (!getDecoration(floorKey)) return;
      this.layout.floor.push({ key: floorKey, cx, cz, rotation: 0 });
    };
    for (const entry of this.layout.decorations || []) {
      if (!entry) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (seen.has(key)) continue;
      seen.add(key);
      place(entry.cx, entry.cz);
    }
    for (const name of ['path', 'manual']) {
      for (const entry of this.layout[name] || []) {
        if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
        if (floorCellAt(this.layout, entry.cx, entry.cz)) continue;
        place(entry.cx, entry.cz);
      }
    }
    return seen.size;
  }

  setTileLift(cx, cz, height) {
    for (const layer of ['floor', 'path', 'water', 'clearing']) {
      for (let i = (this.layout[layer] || []).length - 1; i >= 0; i -= 1) {
        const entry = this.layout[layer][i];
        if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
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
    const kept = this.areaStroke || new Map();
    this.areaStroke = kept;
    this.areaDrag = { mode: this.areaTool, fromX: cx, fromZ: cz, toX: cx, toZ: cz };
    kept.set(cellKey(cx, cz), [cx, cz]);
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
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
    this.setAreaSelection({ tool: drag.mode, cells: this.strokeCells() });
  }

  finishAreaDrag() {
    if (!this.areaDrag) return;
    this.areaDrag = null;
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
  }

  strokeCells() {
    return [...(this.areaStroke || new Map()).values()];
  }

  addAreaCells(cells) {
    if (!this.areaStroke) this.areaStroke = new Map();
    for (const [cx, cz] of cells) this.areaStroke.set(cellKey(cx, cz), [cx, cz]);
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
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
    const drag = this.areaDrag;
    this.areaSelection = cells.length
      ? { tool: selection.tool, cells, drag: drag ? { fromX: drag.fromX, fromZ: drag.fromZ, toX: drag.toX, toZ: drag.toZ } : null }
      : null;
    if (this.onAreaSelectionChange) this.onAreaSelectionChange(this.getAreaSelection());
  }

  getAreaSelection() {
    return this.areaSelection;
  }

  clearAreaSelection() {
    this.areaStroke = null;
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
      this.dropOrphans();
    } else {
      for (const [cx, cz] of selection.cells) {
        dropLayerCell(this.layout, cx, cz);
        dropDecorationCell(this.layout, cx, cz);
        this.layout.floor.push({ key: FALLBACK_FLOOR, cx, cz, rotation: 0 });
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
    if (this.draft && this.draft.brushKey === brushKey) return;
    if (this.draft) this.cancelDraft();
    this.draft = { brushKey, cells: new Set(), mode: this.erasing ? 'remove' : 'add' };
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

  get hasDraft() {
    return Boolean(this.draft);
  }

  get draftMode() {
    return this.draft ? this.draft.mode : (this.erasing ? 'remove' : 'add');
  }

  canDraftCell(cx, cz) {
    if (!this.draft) return false;
    if (this.draft.mode === 'remove') return droppable(this.layout, cx, cz).length > 0;
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
    const { brushKey, cells, mode } = this.draft;
    if (!cells.size) {
      if (this.onDraftChange) this.onDraftChange(this.draft);
      return 0;
    }
    this.pushHistory();
    const brush = BRUSHES[brushKey] || {};
    const shape = brush.shape;
    const stepLevel = brush.height ? brush.height / HEIGHT_STEP : this.heightLevel;
    const liftY = shape === 'line' ? 0 : Math.round(stepLevel) * HEIGHT_STEP;
    const filled = this.zoneEntries(brushKey, brush, [...cells], mode);
    for (const cell of filled) {
      const { cx, cz } = cell;
      if (mode === 'remove') {
        dropDecorationCell(this.layout, cx, cz);
        if (brush.flora) {
          if (this.layout.grass) {
            this.layout.grass = this.layout.grass.filter((entry) => !entry || (entry.cx !== cx || entry.cz !== cz));
          }
          continue;
        }
        if (brush.deco) continue;
        if (shape === 'line') {
          this.dropPathAt(cx, cz);
          continue;
        }
        dropLayerCell(this.layout, cx, cz);
        this.dropPathAt(cx, cz);
        this.dropTopEntry(cx, cz);
        this.dropOrphans();
        continue;
      }
      if (brush.flora) {
        const key = cellKey(cx, cz);
        if (!this.layout.grass) this.layout.grass = [];
        this.layout.grass = this.layout.grass.filter((entry) => entry && (entry.cx !== cx || entry.cz !== cz));
        this.layout.grass.push({ cx, cz });
        continue;
      }
      const key = brush.deco ? (cell.key || this.tileKey) : (cell.key || this.tileKey || this.draftTile);
      if (!key || !getDecoration(key)) continue;
      if (brush.deco) {
        dropDecorationCell(this.layout, cx, cz);
        const entry = { key, cx, cz, rotation: 0 };
        if (cell.liftY) entry.liftY = cell.liftY;
        this.layout.decorations.push(entry);
        continue;
      }
      if (shape === 'line') {
        this.placeEntry(key, cx, cz, cell.rotation || 0, 0, 'path');
      } else if (brushKey === 'water') this.placeEntry(key, cx, cz, cell.rotation || 0, 0, 'water');
      else this.placeEntry(key, cx, cz, 0, liftY, 'floor');
    }
    this.fixMissingFloor();
    const count = cells.size;
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    console.log('[debug] applyDraft done — cells:', count, '| path cells now:', (this.layout.path || []).length, '| deco cells now:', (this.layout.decorations || []).length);
    this.scheduleRegenerate();
    return count;
  }

  zoneEntries(brushKey, brush, cellKeys, mode) {
    if (mode === 'remove') return cellKeys.map(parseCell);
    const pool = this.brushPool(brushKey);
    const filled = fillZone(
      (label) => createRng(seedFor(this.layout.seed || 1, `${brushKey}:${label}:${Date.now()}`, 0, 0)),
      {
        ...brush,
        pool: pool.length ? pool : brush.pool,
      },
      cellKeys,
    );
    const fallback = brush.deco ? this.tileKey : (brush.tile || pool[0]);
    return filled.map((cell) => (cell.key ? cell : { ...cell, key: fallback }));
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
      this.dropPathAt(cx, cz);
      this.dropTopEntry(cx, cz);
      this.dropOrphans();
      return;
    }
    this.placeEntry(this.tileKey || FALLBACK_FLOOR, cx, cz, 0, this.heightLevel > 0 ? this.heightLevel * HEIGHT_STEP : 0);
    this.fixMissingFloor();
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
    console.log('[debug] scheduleRegenerate called — onRegenerate is', typeof this.onRegenerate);
    this.repaint();
  }

  repaint() {
    console.log('[debug] repaint called');
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
    const entries = layerEntriesAt(this.layout, cx, cz);
    if (entries.length) return entries[0].key;
    const floor = floorCellAt(this.layout, cx, cz);
    return floor ? floor.key : null;
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

function toWorld(world) {
  const copy = (list) => (list || []).map((entry) => ({ ...entry }));
  return {
    spawn: world.spawn ? { ...world.spawn } : { cx: 0, cz: 0 },
    seed: world.seed,
    floor: copy(world.floor),
    path: copy(world.path),
    water: copy(world.water),
    clearing: copy(world.clearing),
    manual: copy(world.manual),
    grass: copy(world.grass),
    decorations: copy(world.decorations),
  };
}

function droppable(layout, cx, cz) {
  const layers = (layout.layers || []).filter((layer) => layer.cells && layer.cells.some((cell) => cell.cx === cx && cell.cz === cz));
  const decos = (layout.decorations || []).filter((entry) => entry && entry.cx === cx && entry.cz === cz);
  return [...layers, ...decos];
}

function parseCell(cellKeyValue) {
  const [cx, cz] = String(cellKeyValue).split(',').map(Number);
  return { cx, cz };
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
