// Editační režim mapy — vyplňování buněk štětcem, modelování výšek a práce s plochou.
// Přepíná se F1, drží jen hotovou mapu a historii úprav; vykreslování si řídí scéna.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { cellKey, MIN_HEIGHT, MAX_HEIGHT, HEIGHT_STEP, DEFAULT_HEIGHT_LEVEL } from '../data/maps/layoutStore.js';
import { layerAt, layerEntriesAt, floorCellAt, layerLiftAt, dropLayerCell, dropDecorationCell, dropAreaCells, worldCells } from '../data/maps/areaShape.js';
import { fillZone } from '../utils/zoneFill.js';
import { createRng, seedFor } from '../utils/rng.js';

const HISTORY_LIMIT = 100;

export default class EditorMode {

  constructor() {
    this.active = false;
    this.mode = 'zone';
    this.brushKey = null;
    this.tileKey = null;
    this.pathStyle = 'dirt';
    this.erasing = false;
    this.heightLevel = DEFAULT_HEIGHT_LEVEL;
    this.layout = null;
    this.draft = null;
    this.areaTool = 'paint';
    this.areaSurface = DEFAULT_FLOOR;
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

  brushPool(brushKey) {
    const brush = BRUSHES[brushKey || this.brushKey];
    if (!brush) return [];
    if (brush.poolByStyle) return brush.poolByStyle[this.styleFor(brushKey || this.brushKey)] || [];
    return brush.pool || [];
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

  setHeightLevel(level) {
    const n = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(Number(level))));
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

  placeEntry(key, cx, cz, rotation = 0, liftY = 0, layer = null) {
    const entry = { key, cx, cz, rotation: ((rotation % 4) + 4) % 4 };
    if (liftY) entry.liftY = liftY;
    const floor = floorCellAt(this.layout, cx, cz);
    if (layer === 'path') {
      delete entry.key;
      entry.style = this.pathStyle;
      if (floor && floor.liftY) entry.liftY = floor.liftY;
      const existing = (this.layout.path || []).find((cell) => cell && cell.cx === cx && cell.cz === cz);
      if (existing) {
        existing.style = entry.style;
        if (entry.liftY) existing.liftY = entry.liftY;
      } else {
        this.layout.path.push(entry);
      }
      return entry;
    }
    const target = layer || 'floor';
    if (target === 'floor') {
      dropLayerCell(this.layout, cx, cz);
      for (const name of ['grass', 'clearing']) {
        if ((this.layout[name] || []).some((item) => item && item.cx === cx && item.cz === cz && item.liftY)) continue;
        this.layout[name] = (this.layout[name] || []).filter((item) => !item || item.cx !== cx || item.cz !== cz);
      }
    } else {
      if (!entry.liftY && floor && floor.liftY) entry.liftY = floor.liftY;
      dropLayerCell(this.layout, cx, cz);
      if (floor && !(this.layout.floor || []).includes(floor)) this.layout.floor.push(floor);
      if (!floor) this.placeFloor(DEFAULT_FLOOR, cx, cz);
    }
    this.layout[target].push(entry);
    return entry;
  }

  paintSurface(cx, cz, key) {
    const def = getDecoration(key);
    if (!def) return false;
    const floor = floorCellAt(this.layout, cx, cz);
    const changed = !floor || floor.key !== key;
    const lift = floor ? (floor.liftY || 0) : (layerLiftAt(this.layout, cx, cz) || 0);
    if (floor) {
      floor.key = key;
      if (lift) floor.liftY = lift;
      else delete floor.liftY;
    } else {
      if (!this.layout.floor) this.layout.floor = [];
      const entry = { key, cx, cz, rotation: 0 };
      if (lift) entry.liftY = lift;
      this.layout.floor.push(entry);
    }
    if (changed && this.layout.grass) {
      this.layout.grass = this.layout.grass.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
    }
    return true;
  }

  placePath(cx, cz) {
    return this.placeEntry('path', cx, cz, 0, 0, 'path');
  }

  keepFloor(cx, cz) {
    const floor = floorCellAt(this.layout, cx, cz);
    return floor ? floor.key : DEFAULT_FLOOR;
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
    return seen.size;
  }

  setTileLift(cx, cz, height) {
    const layer = layerAt(this.layout, cx, cz);
    const path = layer === 'path'
      ? (this.layout.path || []).find((entry) => entry && entry.cx === cx && entry.cz === cz) || null
      : null;
    const targets = [];
    const floor = floorCellAt(this.layout, cx, cz);
    if (floor) targets.push(floor);
    for (const name of ['floor', 'clearing', 'grass']) {
      for (const entry of this.layout[name] || []) {
        if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
        if (!targets.includes(entry)) targets.push(entry);
      }
    }
    if (path && !targets.includes(path)) targets.push(path);
    if (!targets.length) return null;
    for (const entry of targets) {
      if (height) entry.liftY = height;
      else delete entry.liftY;
    }
    return floor || path || targets[0];
  }

  setCellHeight(cx, cz, height) {
    const value = Number(height);
    if (!Number.isFinite(value)) return null;
    const floor = floorCellAt(this.layout, cx, cz);
    const before = floor ? (floor.liftY || 0) : (layerLiftAt(this.layout, cx, cz) || 0);
    if (!floor) this.placeFloor(this.keepFloor(cx, cz), cx, cz);
    this.setTileLift(cx, cz, value);
    const delta = value - before;
    if (delta) this.shiftDecorations(cx, cz, delta);
    return value;
  }

  shiftDecorations(cx, cz, delta) {
    for (const entry of this.layout.decorations || []) {
      if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
      const next = Math.round(((entry.liftY || 0) + delta) * 1000) / 1000;
      if (next) entry.liftY = next;
      else delete entry.liftY;
    }
  }

  brushHeight(brushKey) {
    const brush = BRUSHES[brushKey];
    if (!brush) return 0;
    if (brush.heights) return brush.heights[this.styleFor(brushKey)] || 0;
    return brush.height || 0;
  }

  get isHeightBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && (brush.height || brush.heights));
  }

  cellHeightValue(cx, cz) {
    const floor = floorCellAt(this.layout, cx, cz);
    return floor ? (floor.liftY || 0) : (layerLiftAt(this.layout, cx, cz) || 0);
  }

  heightShape(brushKey, zone, mode = 'add') {
    const brush = BRUSHES[brushKey];
    const level = this.brushHeight(brushKey) * HEIGHT_STEP;
    const zoneEntries = zone.map(({ cx, cz }) => ({ cx, cz, height: level, zone: true }));
    if (!brush || !brush.falloff || !level) return { zone: zoneEntries, slope: [] };
    const sign = Math.sign(level);
    const present = new Set(worldCells(this.layout).map(([cx, cz]) => cellKey(cx, cz)));
    const affected = new Map();
    for (const entry of zoneEntries) affected.set(cellKey(entry.cx, entry.cz), entry);
    let frontier = new Map(zoneEntries.map((entry) => [cellKey(entry.cx, entry.cz), entry]));
    let nextLevel = level - sign * HEIGHT_STEP;
    while (Math.abs(nextLevel) > 1e-6) {
      const next = new Map();
      for (const entry of frontier.values()) {
        for (const [dx, dz] of AROUND) {
          const cx = entry.cx + dx;
          const cz = entry.cz + dz;
          const key = cellKey(cx, cz);
          if (!present.has(key) || affected.has(key)) continue;
          const ring = { cx, cz, height: nextLevel, zone: false };
          affected.set(key, ring);
          next.set(key, ring);
        }
      }
      if (!next.size) break;
      frontier = next;
      nextLevel -= sign * HEIGHT_STEP;
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
  }

  heightDraftShape(draft) {
    if (!draft) return null;
    const brush = BRUSHES[draft.brushKey];
    if (!brush || !(brush.height || brush.heights)) return null;
    const zone = [...draft.cells].map(parseCell);
    return this.heightShape(draft.brushKey, zone, draft.mode);
  }

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

  setAreaSurface(key) {
    const def = getDecoration(key);
    if (!def || !def.surface) return;
    this.areaSurface = key;
  }

  get areaHeightMeters() {
    return this.heightLevel * HEIGHT_STEP;
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
    if (this.realCells && this.realCells.some(([ax, az]) => ax === cx && az === cz)) return true;
    return (this.layout.path || []).some((entry) => entry && entry.cx === cx && entry.cz === cz);
  }

  assignRealCells(cells) {
    this.realCells = cells && cells.length ? cells.map(([cx, cz]) => [cx, cz]) : null;
  }

  pendingAreaCells() {
    const selection = this.areaSelection;
    if (!selection || !selection.cells.length) return 0;
    if (selection.tool === 'erase') {
      return selection.cells.filter(([cx, cz]) => this.areaExists(cx, cz)).length;
    }
    return selection.cells.length;
  }

  pendingAreaExisting() {
    const selection = this.areaSelection;
    if (!selection || selection.tool === 'erase') return 0;
    return selection.cells.filter(([cx, cz]) => this.areaExists(cx, cz)).length;
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
      const lift = this.heightLevel * HEIGHT_STEP;
      for (const [cx, cz] of selection.cells) {
        dropLayerCell(this.layout, cx, cz);
        dropDecorationCell(this.layout, cx, cz);
        const entry = { key: this.areaSurface, cx, cz, rotation: 0 };
        if (lift) entry.liftY = lift;
        this.layout.floor.push(entry);
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

  get hasBrush() {
    return Boolean(this.brushKey && BRUSHES[this.brushKey]);
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
    if (brush.height || brush.heights) {
      const zone = [...cells].map(parseCell);
      const count = this.applyHeightDraft(brushKey, zone, mode);
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
      this.scheduleRegenerate();
      return count;
    }
    const shape = brush.shape;
    const brushLift = brush.height ? brush.height * HEIGHT_STEP : 0;
    const filled = this.zoneEntries(brushKey, brush, [...cells], mode);
    for (const cell of filled) {
      const { cx, cz } = cell;
      if (mode === 'remove') {
        if (brush.surfaceOnly) {
          this.paintSurface(cx, cz, DEFAULT_FLOOR);
          continue;
        }
        dropDecorationCell(this.layout, cx, cz);
        if (brush.flora) {
          if (this.layout.grass) {
            this.layout.grass = this.layout.grass.filter((entry) => !entry || (entry.cx !== cx || entry.cz !== cz));
          }
          continue;
        }
        if (brush.deco) continue;
        dropLayerCell(this.layout, cx, cz);
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
      const key = brush.deco ? (cell.key || this.tileKey) : cell.key;
      if (brush.deco && (!key || !getDecoration(key))) continue;
      if (brush.deco) {
        dropDecorationCell(this.layout, cx, cz);
        const lift = layerLiftAt(this.layout, cx, cz) || 0;
        const entry = { key, cx, cz, rotation: 0 };
        if (lift) entry.liftY = lift;
        this.layout.decorations.push(entry);
        continue;
      }
      if (brush.surfaceOnly) {
        if (key) this.paintSurface(cx, cz, key);
        continue;
      }
      if (shape === 'line') {
        this.placePath(cx, cz);
        this.setTileLift(cx, cz, brushLift);
      } else {
        this.placeEntry(key, cx, cz, 0, cell.liftY || brushLift, 'floor');
      }
    }
    this.fixMissingFloor();
    const count = cells.size;
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
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
    return filled.map((cell) => (cell.key || !fallback ? cell : { ...cell, key: fallback }));
  }

  cancelDraft() {
    if (!this.draft) return false;
    this.draft = null;
    if (this.onDraftChange) this.onDraftChange(null);
    return true;
  }

  applyCell(cx, cz) {
    this.setCellHeight(cx, cz, this.erasing ? 0 : this.heightLevel * HEIGHT_STEP);
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
    if (brush.shape === 'line') keys.push('path');
    return keys;
  }

  draftTileAt(cx, cz) {
    if (layerAt(this.layout, cx, cz) === 'path') return 'path';
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
    const level = entry && Number.isFinite(entry.liftY) ? Math.round(entry.liftY / HEIGHT_STEP) : 0;
    return {
      brush: layer,
      entry,
      height: level || null,
      override: entry,
      isPath: layer === 'path',
      style: layer === 'path' ? (entry && entry.style ? entry.style : this.styleFor(this.brushKey)) : null,
      pool: this.brushPool(this.brushKey),
      key: cellKey(cx, cz),
      liftY: entry && entry.liftY ? entry.liftY : 0,
    };
  }
}

const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

function toWorld(world) {
  const copy = (list) => (list || []).map((entry) => ({ ...entry }));
  return {
    spawn: world.spawn ? { ...world.spawn } : { cx: 0, cz: 0 },
    seed: world.seed,
    floor: copy(world.floor),
    path: copy(world.path),
    clearing: copy(world.clearing),
    grass: copy(world.grass),
    decorations: copy(world.decorations),
  };
}

function droppable(layout, cx, cz) {
  const layers = [];
  for (const name of ['floor', 'path', 'clearing', 'grass']) {
    for (const entry of layout[name] || []) {
      if (entry && entry.cx === cx && entry.cz === cz) layers.push(entry);
    }
  }
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
