// Editační režim mapy — vyplňování buněk štětcem, modelování výšek a práce s plochou.
// Přepíná se F2, drží jen hotovou mapu a historii úprav; vykreslování si řídí scéna.
import { BRUSHES, brushOptions, brushPaintParts, PAINT_ALL, PAINT_TERRAIN, PAINT_CREATURES, PAINT_FISH } from '../data/catalogs/brushes.js';
import { getDecoration, DEFAULT_FLOOR, decoFamily } from '../data/catalogs/decorations.js';
import { cellKey, MIN_HEIGHT, MAX_HEIGHT, HEIGHT_STEP, DEFAULT_HEIGHT_LEVEL } from '../data/maps/layoutStore.js';
import { layerAt, layerEntriesAt, floorCellAt, layerLiftAt, levelOfEntry, dropLayerCell, dropDecorationCell, dropAreaCells, worldCells } from '../data/maps/areaShape.js';
import { fillZone } from '../utils/zoneFill.js';
import { createRng, seedFor } from '../utils/rng.js';
import { getFishType, FISH_SWIM_DEPTH } from '../data/catalogs/fish.js';
import { getCreatureType, getCreatureTier } from '../data/catalogs/creatures/index.js';
import { decoPlacement } from '../utils/decoPlacement.js';
import { bridgeSpan, bridgeCells } from '../utils/bridgeShape.js';
import { layoutFromMapFile } from '../data/catalogs/mapFile.js';

const HISTORY_LIMIT = 100;
const ROUGH_SKIP = 0.32;
const ENTRY_LAYERS = ['floor', 'path', 'clearing', 'grass', 'decorations', 'fish', 'creatures'];

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export default class EditorMode {

  constructor() {
    this.active = false;
    this.mode = 'zone';
    this.brushKey = null;
    this.tileKey = null;
    this.pathStyle = 'dirt';
    this.erasing = false;
    this.heightLevel = DEFAULT_HEIGHT_LEVEL;
    this.heightBrushSize = 0;
    this.heightStepSign = 0;
    this.heightStrokeStep = 0;
    this.heightJitter = 0;
    this.waterShown = true;
    this.layout = null;
    this.draft = null;
    this.draftDrag = null;
    this.draftBase = null;
    this.joinTop = null;
    this.joinBottom = null;
    this.joinHeights = null;
    this.joinInfo = null;
    this.bridgeTop = null;
    this.pendingBridge = null;
    this.bridgeInfo = null;
    this.heightDraft = null;
    this.contentIndex = null;
    this.presentCache = null;
    this.areaTool = 'paint';
    this.areaSurface = DEFAULT_FLOOR;
    this.areaSelection = null;
    this.areaDrag = null;
    this.areaStroke = null;
    this.areaBase = null;
    this.realCells = null;
    this.brushOpts = {};
    this.history = [];
    this.pendingHistory = null;
    this.onRegenerate = null;
    this.onChange = null;
    this.onModeChange = null;
    this.onHeightChange = null;
    this.onDraftChange = null;
    this.onHeightDraftChange = null;
    this.onHeightsChange = null;
    this.onAreaSelectionChange = null;
    this.onStyleChange = null;
    this.onRestore = null;
  }

  attach(world) {
    this.cancelHeightDraft();
    this.history = [];
    this.pendingHistory = null;
    this.resetBridge();
    this.layout = toWorld(world || {});
  }

  getMap() {
    return this.layout;
  }

  getWaterLevel() {
    const value = this.layout && this.layout.waterLevel;
    return Number.isFinite(value) ? value : null;
  }

  setWaterLevel(level) {
    if (!this.layout) return null;
    const low = MIN_HEIGHT * HEIGHT_STEP;
    const high = MAX_HEIGHT * HEIGHT_STEP;
    const next = Number.isFinite(level) ? Math.min(high, Math.max(low, Number(level))) : null;
    if (next === this.getWaterLevel()) return next;
    this.pushHistory([PAINT_TERRAIN]);
    if (next === null) delete this.layout.waterLevel;
    else this.layout.waterLevel = next;
    return next;
  }

  setWaterShown(shown) {
    const next = shown !== false;
    if (next === this.waterShown) return next;
    this.waterShown = next;
    return next;
  }

  toggleWaterShown() {
    return this.setWaterShown(!this.waterShown);
  }

  toggle() {
    this.active = !this.active;
    if (this.onChange) this.onChange(this.active);
    return this.active;
  }

  pushHistory(parts) {
    if (!this.layout) return;
    if (this.history.length >= HISTORY_LIMIT) this.history.shift();
    this.history.push({ world: toWorld(this.layout), parts: parts || PAINT_ALL });
    this.pendingHistory = this.history.length - 1;
  }

  commitHistory() {
    const index = this.pendingHistory;
    if (index === null) return;
    this.pendingHistory = null;
    const entry = this.history[index];
    if (!entry || !entry.world) return;
    entry.patch = this.historyPatch(entry.world);
    delete entry.world;
  }

  historyPatch(before) {
    const was = this.cellEntries(before);
    const now = this.cellEntries(this.layout);
    const cells = [];
    const keys = new Set([...was.keys(), ...now.keys()]);
    for (const key of keys) {
      const first = was.get(key);
      const second = now.get(key);
      if (first && second && JSON.stringify(first) === JSON.stringify(second)) continue;
      if (!first && !second) continue;
      const [cx, cz] = key.split(',').map(Number);
      const entries = {};
      for (const layer of ENTRY_LAYERS) entries[layer] = first ? first[layer] : [];
      cells.push({ cx, cz, entries });
    }
    const patch = { cells };
    const wasSpawn = before.spawn && Number.isFinite(before.spawn.cx) ? { cx: before.spawn.cx, cz: before.spawn.cz } : null;
    const nowSpawn = this.spawnCell();
    if (!wasSpawn || !nowSpawn || wasSpawn.cx !== nowSpawn.cx || wasSpawn.cz !== nowSpawn.cz) patch.spawn = wasSpawn;
    const wasBridges = (before.bridges || []).map((entry) => ({ ...entry }));
    const nowBridges = this.layout.bridges || [];
    if (JSON.stringify(wasBridges) !== JSON.stringify(nowBridges)) patch.bridges = wasBridges;
    const wasWater = Number.isFinite(before.waterLevel) ? before.waterLevel : null;
    const nowWater = this.layout && Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
    if (wasWater !== nowWater) patch.waterLevel = wasWater;
    return patch;
  }

  cellEntries(layout) {
    const map = new Map();
    for (const layer of ENTRY_LAYERS) {
      for (const entry of (layout && layout[layer]) || []) {
        if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
        const key = cellKey(entry.cx, entry.cz);
        let cell = map.get(key);
        if (!cell) {
          cell = {};
          for (const name of ENTRY_LAYERS) cell[name] = [];
          map.set(key, cell);
        }
        cell[layer].push(entry);
      }
    }
    return map;
  }

  applyHistoryPatch(patch) {
    if (!patch) return;
    for (const cell of patch.cells || []) {
      for (const layer of ENTRY_LAYERS) {
        const kept = (this.layout[layer] || []).filter((entry) => (
          !entry || entry.cx !== cell.cx || entry.cz !== cell.cz
        ));
        for (const entry of cell.entries[layer] || []) kept.push({ ...entry });
        this.layout[layer] = kept;
      }
    }
    if ('bridges' in patch) this.layout.bridges = patch.bridges.map((entry) => ({ ...entry }));
    if ('spawn' in patch) this.layout.spawn = patch.spawn ? { ...patch.spawn } : { cx: 0, cz: 0 };
    if ('waterLevel' in patch) {
      if (patch.waterLevel === null) delete this.layout.waterLevel;
      else this.layout.waterLevel = patch.waterLevel;
    }
  }

  undo() {
    this.cancelHeightDraft();
    this.resetDraftDrag();
    this.resetJoin();
    this.resetBridge();
    if (this.draft) {
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
    }
    if (!this.history.length) return false;
    const step = this.history.pop();
    this.pendingHistory = null;
    if (step.patch) this.applyHistoryPatch(step.patch);
    else this.restoreLayout(step.world);
    this.repaint(step.parts);
    return true;
  }

  get canUndo() {
    return this.history.length > 0;
  }

  setBrush(key) {
    if (key && !BRUSHES[key]) return;
    if (this.brushKey !== key && this.draft) this.cancelDraft();
    if (key && BRUSHES[key].erase) this.erasing = false;
    this.brushKey = key || null;
    this.pathStyle = this.styleFor(this.brushKey);
    this.syncTileKey();
    if (this.onBrushChange) this.onBrushChange(this.brushKey);
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
    if (brush.poolByStyle) {
      if (this.brushOptionValue(brushKey || this.brushKey, 'random')) {
        return [...new Set(Object.values(brush.poolByStyle).flat())];
      }
      return brush.poolByStyle[this.styleFor(brushKey || this.brushKey)] || [];
    }
    return brush.pool || [];
  }

  setMode(mode) {
    if (mode !== 'zone' && mode !== 'height' && mode !== 'area') return;
    this.mode = mode;
    this.erasing = false;
    this.areaDrag = null;
    this.areaStroke = null;
    this.areaBase = null;
    this.clearAreaSelection();
    this.cancelHeightDraft();
    this.resetDraftDrag();
    this.resetJoin();
    this.resetBridge();
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
    if (this.pendingBridge) this.buildBridgeSpan(this.pendingBridge.bx, this.pendingBridge.bz, this.pendingBridge.toHeight);
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

  brushOptionsOf(brushKey) {
    return brushOptions(BRUSHES[brushKey]);
  }

  brushOptionValue(brushKey, optionKey = null) {
    const list = this.brushOptionsOf(brushKey);
    const option = optionKey ? list.find((item) => item.key === optionKey) : list[0];
    if (!option) return false;
    const opts = this.brushOpts[brushKey];
    const stored = opts && option.key in opts ? opts[option.key] : null;
    if (option.kind === 'range') {
      const fallback = Number(option.default) || Number(option.min) || 0;
      const raw = stored === null ? fallback : Number(stored);
      const value = Number.isFinite(raw) ? raw : fallback;
      const step = Number(option.step) || 1;
      const min = Number.isFinite(Number(option.min)) ? Number(option.min) : 0;
      const clamped = Math.min(Number(option.max), Math.max(min, value));
      return min + Math.round((clamped - min) / step) * step;
    }
    if (option.kind === 'choice') {
      const choices = Array.isArray(option.values) ? option.values : [];
      const fallback = option.default !== undefined ? option.default : (choices[0] ? choices[0].value : '');
      if (stored === null) return fallback;
      return choices.some((choice) => choice.value === stored) ? stored : fallback;
    }
    if (stored !== null) return Boolean(stored);
    return option.default === true;
  }

  brushOptionValues(brushKey) {
    const out = {};
    for (const option of this.brushOptionsOf(brushKey)) out[option.key] = this.brushOptionValue(brushKey, option.key);
    return out;
  }

  setBrushOption(optionKey, value) {
    const option = this.brushOptionsOf(this.brushKey).find((item) => item.key === optionKey);
    if (!option) return;
    const stored = option.kind === 'range'
      ? Number(value)
      : option.kind === 'choice' ? String(value) : Boolean(value);
    this.brushOpts[this.brushKey] = { ...(this.brushOpts[this.brushKey] || {}), [optionKey]: stored };
    if (this.pendingBridge) {
      this.buildBridgeSpan(this.pendingBridge.bx, this.pendingBridge.bz, this.pendingBridge.toHeight);
      return;
    }
    if (this.joinTop && this.joinBottom) {
      this.buildJoin(this.joinBottom.cx, this.joinBottom.cz, this.joinBottom.height);
      return;
    }
    if (this.draftDrag) {
      this.refreshDraftDrag();
      return;
    }
    if (this.draft && this.onDraftChange) this.onDraftChange(this.draft);
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

  setHeightBrushSize(size) {
    const value = Math.max(0, Math.min(3, Math.round(Number(size) || 0)));
    if (value === this.heightBrushSize) return;
    this.heightBrushSize = value;
    if (this.onHeightBrushChange) this.onHeightBrushChange(value);
  }

  setHeightStepSign(sign) {
    const value = Math.sign(Number(sign) || 0);
    if (value === this.heightStepSign) return;
    this.heightStepSign = value;
    if (this.onHeightStepChange) this.onHeightStepChange(value);
  }

  setHeightJitter(value) {
    const next = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
    if (next === this.heightJitter) return;
    this.heightJitter = next;
    if (this.onHeightJitterChange) this.onHeightJitterChange(next);
  }

  beginHeightStroke() {
    this.heightStrokeStep = 0;
  }

  heightStampCells(cx, cz) {
    const radius = this.heightBrushSize || 0;
    const cells = [];
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) cells.push([cx + dx, cz + dz]);
    }
    return cells;
  }

  get heightStampSpan() {
    return (this.heightBrushSize || 0) * 2 + 1;
  }

  paint(cx, cz) {
    if (!this.active || !this.layout) return;
    if (this.mode === 'area') {
      this.areaDrag = null;
      this.addAreaCells([[cx, cz]]);
      return;
    }
    if (this.mode !== 'height') return;
    this.markHeightCell(cx, cz);
  }

  paintRun(from, to) {
    if (!this.active || !this.layout) return;
    if (this.mode === 'area') {
      this.areaDrag = null;
      this.addAreaCells(bresenham(from.cx, from.cz, to.cx, to.cz));
      return;
    }
    if (this.mode !== 'height') return;
    for (const [cx, cz] of bresenham(from.cx, from.cz, to.cx, to.cz)) {
      this.markHeightCell(cx, cz);
    }
  }

  dropTopEntry(cx, cz) {
    return dropDecorationCell(this.layout, cx, cz);
  }

  dropStackableDecorations(cx, cz) {
    const entries = this.layout.decorations || [];
    const kept = entries.filter((entry) => {
      if (!entry || entry.cx !== cx || entry.cz !== cz) return true;
      const def = getDecoration(entry.key);
      return !def || !def.stackable;
    });
    if (kept.length === entries.length) return false;
    this.layout.decorations = kept;
    return true;
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
      const existing = (this.layout.path || []).find((cell) => onSurface(cell, cx, cz));
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
        if ((this.layout[name] || []).some((item) => onSurface(item, cx, cz) && item.liftY)) continue;
        this.layout[name] = (this.layout[name] || []).filter((item) => !onSurface(item, cx, cz));
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
      this.layout.grass = this.layout.grass.filter((entry) => !onSurface(entry, cx, cz));
    }
    return changed;
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
      ? (this.layout.path || []).find((entry) => onSurface(entry, cx, cz)) || null
      : null;
    const targets = [];
    const floor = floorCellAt(this.layout, cx, cz);
    if (floor) targets.push(floor);
    for (const name of ['floor', 'clearing', 'grass']) {
      for (const entry of this.layout[name] || []) {
        if (!onSurface(entry, cx, cz)) continue;
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

  get isSurfaceBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && brush.surface);
  }

  get isCliffBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && brush.cliff);
  }

  get isJoinBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && brush.join);
  }

  get isBridgeBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && brush.bridge);
  }

  get isCreatureBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && brush.creature);
  }

  get isSpawnBrush() {
    const brush = BRUSHES[this.brushKey];
    return Boolean(brush && brush.spawn);
  }

  get eraseKind() {
    const brush = BRUSHES[this.brushKey];
    return brush && brush.erase ? brush.erase : null;
  }

  get isEraserBrush() {
    return Boolean(this.eraseKind);
  }

  applyEraser(zone) {
    const kind = this.eraseKind;
    if (!kind) return 0;
    let changed = 0;
    for (const { cx, cz } of zone) {
      if (this.eraseCell(cx, cz, kind)) changed += 1;
    }
    if (kind === 'terrain') this.cleanFlatCliffs(zone.map((cell) => [cell.cx, cell.cz]));
    else this.dropOrphans();
    return changed;
  }

  eraseCell(cx, cz, kind) {
    const plants = kind === 'plants' || kind === 'all';
    const objects = kind === 'objects' || kind === 'all';
    let dropped = false;
    if (plants || objects) {
      const removed = this.dropDecorations(cx, cz, (entry) => {
        const family = decoFamily(entry.key);
        if (family === 'plant') return plants;
        return objects && family === 'object';
      });
      if (removed) dropped = true;
    }
    if (plants && this.dropGrassCell(cx, cz)) dropped = true;
    if ((kind === 'path' || kind === 'all') && this.dropPathCell(cx, cz)) dropped = true;
    if (kind === 'creatures' || kind === 'all') {
      if (this.dropCreatureCell(cx, cz)) dropped = true;
      if (this.dropFishCell(cx, cz)) dropped = true;
    }
    if (kind === 'terrain') {
      if (this.flattenCell(cx, cz)) dropped = true;
      if (this.dropBridgeCell(cx, cz)) dropped = true;
    }
    if (kind === 'all' && this.dropBridgeCell(cx, cz)) dropped = true;
    return dropped;
  }

  dropDecorations(cx, cz, test) {
    const entries = this.layout.decorations || [];
    const kept = entries.filter((entry) => {
      if (!entry || entry.cx !== cx || entry.cz !== cz) return true;
      return !test(entry);
    });
    if (kept.length === entries.length) return false;
    this.layout.decorations = kept;
    return true;
  }

  dropPathCell(cx, cz) {
    const entries = this.layout.path || [];
    const kept = entries.filter((entry) => !onSurface(entry, cx, cz));
    if (kept.length === entries.length) return false;
    this.layout.path = kept;
    return true;
  }

  dropCreatureCell(cx, cz) {
    if (!Array.isArray(this.layout.creatures)) return false;
    const entries = this.layout.creatures;
    const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
    if (kept.length === entries.length) return false;
    this.layout.creatures = kept;
    return true;
  }

  dropFishCell(cx, cz) {
    const entries = this.layout.fish || [];
    const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
    if (kept.length === entries.length) return false;
    this.layout.fish = kept;
    return true;
  }

  dropBridgeCell(cx, cz) {
    const bridges = this.layout.bridges || [];
    const kept = bridges.filter((record) => !bridgeCells(record).some(([x, z]) => x === cx && z === cz));
    if (kept.length === bridges.length) return false;
    this.layout.bridges = kept;
    return true;
  }

  flattenCell(cx, cz) {
    let changed = false;
    for (const name of ['floor', 'clearing', 'grass', 'path']) {
      for (const entry of this.layout[name] || []) {
        if (!onSurface(entry, cx, cz)) continue;
        if (entry.liftY) {
          delete entry.liftY;
          changed = true;
        }
        if (entry.cliff) {
          delete entry.cliff;
          delete entry.cliffStyle;
          changed = true;
        }
      }
    }
    return changed;
  }

  spawnCell() {
    const spawn = this.layout && this.layout.spawn;
    if (!spawn || !Number.isFinite(spawn.cx) || !Number.isFinite(spawn.cz)) return null;
    return { cx: spawn.cx, cz: spawn.cz };
  }

  fingerprint() {
    let sum = 0;
    let count = 0;
    for (const name of ENTRY_LAYERS) {
      for (const entry of (this.layout && this.layout[name]) || []) {
        if (!entry) continue;
        sum = (sum + hashText(JSON.stringify(entry))) >>> 0;
        count += 1;
      }
    }
    for (const entry of (this.layout && this.layout.bridges) || []) {
      if (!entry) continue;
      sum = (sum + hashText(JSON.stringify(entry))) >>> 0;
      count += 1;
    }
    const spawn = this.spawnCell();
    const water = this.layout && Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
    const head = `${count}|${sum}|${spawn ? `${spawn.cx},${spawn.cz}` : '-'}|${water}|${this.layout ? this.layout.seed : ''}`;
    return hashText(head);
  }

  applySpawnCell(zone) {
    const cell = zone[zone.length - 1];
    if (!cell) return 0;
    const spawn = this.spawnCell();
    if (spawn && spawn.cx === cell.cx && spawn.cz === cell.cz) return 0;
    this.layout.spawn = { cx: cell.cx, cz: cell.cz };
    return 1;
  }

  creatureAt(cx, cz) {
    for (const entry of (this.layout && this.layout.creatures) || []) {
      if (entry && entry.cx === cx && entry.cz === cz) return entry;
    }
    return null;
  }

  creatureInfoAt(cx, cz) {
    const entry = this.creatureAt(cx, cz);
    if (!entry) return null;
    const type = getCreatureType(entry.kind);
    if (!type) return null;
    const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
    return { entry, type, tierKey, tier: getCreatureTier(type, tierKey) };
  }

  creatureTierFor(brushKey) {
    const brush = BRUSHES[brushKey];
    const type = brush && brush.creatureKind ? getCreatureType(brush.creatureKind) : null;
    if (!type || !type.tiers) return null;
    const style = this.styleFor(brushKey);
    return type.tiers[style] ? style : type.defaultTier;
  }

  creaturePreviewAt(cx, cz) {
    if (!this.active || this.mode !== 'zone') return null;
    if (this.draftMode === 'remove') return null;
    const brush = BRUSHES[this.brushKey];
    const type = brush && brush.creatureKind ? getCreatureType(brush.creatureKind) : null;
    if (!type) return null;
    const radius = Number(type.roamRadius);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    return { type, tierKey: this.creatureTierFor(this.brushKey), radius, cx, cz };
  }

  creatureMarks() {
    const list = this.layout && Array.isArray(this.layout.creatures) ? this.layout.creatures : [];
    const marks = [];
    for (const entry of list) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const type = getCreatureType(entry.kind);
      const radius = Number(type && type.roamRadius);
      if (!Number.isFinite(radius) || radius <= 0) continue;
      const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
      marks.push({ cx: entry.cx, cz: entry.cz, radius, kind: entry.kind, tierKey });
    }
    return marks;
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
          if (rough && noise2(cx / 2.6 + 17.3, cz / 2.3 - 9.1) < ROUGH_SKIP) continue;
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
  }

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
  }

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
  }

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
    this.areaBase = this.areaStroke ? new Map(this.areaStroke) : new Map();
    this.areaDrag = { mode: this.areaTool, fromX: cx, fromZ: cz, toX: cx, toZ: cz };
    this.refreshAreaDrag();
  }

  moveAreaDrag(cx, cz) {
    const drag = this.areaDrag;
    if (!drag) return;
    if (drag.toX === cx && drag.toZ === cz) return;
    drag.toX = cx;
    drag.toZ = cz;
    this.refreshAreaDrag();
  }

  refreshAreaDrag() {
    const drag = this.areaDrag;
    if (!drag) return;
    const stroke = this.areaBase ? new Map(this.areaBase) : new Map();
    for (const [x, z] of rectCells(drag.fromX, drag.fromZ, drag.toX, drag.toZ)) {
      stroke.set(cellKey(x, z), [x, z]);
    }
    this.areaStroke = stroke;
    this.setAreaSelection({ tool: drag.mode, cells: this.strokeCells() });
  }

  finishAreaDrag() {
    if (!this.areaDrag) return;
    this.areaDrag = null;
    this.areaBase = null;
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

  removeAreaCells(cells) {
    if (!this.areaStroke || !cells || !cells.length) return false;
    let changed = false;
    for (const [cx, cz] of cells) {
      if (this.areaStroke.delete(cellKey(cx, cz))) changed = true;
    }
    if (!changed) return false;
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
    return true;
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
    this.areaBase = null;
    this.areaDrag = null;
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
        if (this.dropCreatureCell(cx, cz)) count += 1;
        if (this.dropFishCell(cx, cz)) count += 1;
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
    this.scheduleRegenerate(erasing ? [...PAINT_ALL, PAINT_CREATURES, PAINT_FISH] : PAINT_ALL);
    return count;
  }

  beginDraft(brushKey) {
    if (!this.layout) return;
    const brush = BRUSHES[brushKey];
    if (!brush) return;
    if (this.draft && this.draft.brushKey === brushKey) return;
    if (this.draft) this.cancelDraft();
    this.resetBridge();
    const removing = this.erasing && !brush.erase;
    this.draft = { brushKey, cells: new Set(), mode: removing ? 'remove' : 'add' };
    if (this.onDraftChange) this.onDraftChange(this.draft);
  }

  setDraftMode(mode) {
    if (this.isEraserBrush) return;
    const next = mode === 'remove' ? 'remove' : 'add';
    if (this.erasing === (next === 'remove')) {
      if (this.draft && this.draft.mode !== next) {
        this.draft.mode = next;
        this.resetDraftDrag();
        this.resetJoin();
        this.resetBridge();
        this.draft.cells.clear();
        if (this.onDraftChange) this.onDraftChange(this.draft);
      }
      return;
    }
    this.erasing = next === 'remove';
    if (this.draft) {
      this.draft.mode = next;
      this.resetDraftDrag();
      this.resetJoin();
      this.resetBridge();
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
    if (this.draft.mode === 'remove') {
      const brush = BRUSHES[this.draft.brushKey];
      if (brush && brush.spawn) return false;
      if (brush && brush.bridge) return this.bridgeAt(cx, cz) !== null;
      if (brush && brush.creature) return this.creatureAt(cx, cz) !== null;
      return droppable(this.layout, cx, cz).length > 0;
    }
    return this.canEditCell(cx, cz);
  }

  get hasBrush() {
    return Boolean(this.brushKey && BRUSHES[this.brushKey]);
  }

  beginDraftDrag(cx, cz) {
    if (!this.draft) return false;
    this.draftBase = new Set(this.draft.cells);
    this.draftDrag = { fromX: cx, fromZ: cz, toX: cx, toZ: cz };
    this.refreshDraftDrag();
    return true;
  }

  moveDraftDrag(cx, cz) {
    const drag = this.draftDrag;
    if (!drag) return false;
    if (drag.toX === cx && drag.toZ === cz) return false;
    drag.toX = cx;
    drag.toZ = cz;
    this.refreshDraftDrag();
    return true;
  }

  refreshDraftDrag() {
    const drag = this.draftDrag;
    if (!drag || !this.draft) return;
    const cells = this.draft.cells;
    cells.clear();
    for (const key of this.draftBase || []) cells.add(key);
    const radius = this.brushRadius();
    for (const [cx, cz] of rectCells(drag.fromX, drag.fromZ, drag.toX, drag.toZ)) {
      if (this.canDraftCell(cx, cz)) this.stampCells(cells, cx, cz, radius);
    }
    if (this.onDraftChange) this.onDraftChange(this.draft);
  }

  resetDraftDrag() {
    this.draftDrag = null;
    this.draftBase = null;
  }

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
  }

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
  }

  joinMetersAt(cx, cz) {
    if (!this.joinHeights) return null;
    const value = this.joinHeights.get(cellKey(cx, cz));
    return value === undefined ? null : value;
  }

  cancelJoin() {
    if (!this.draft) return false;
    this.resetJoin();
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  }

  resetJoin() {
    this.joinTop = null;
    this.joinBottom = null;
    this.joinHeights = null;
    this.joinInfo = null;
  }

  bridgeWidth() {
    const value = Number(this.brushOptionValue(this.brushKey, 'width'));
    return Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : 3;
  }

  bridgeAt(cx, cz) {
    for (const record of (this.layout && this.layout.bridges) || []) {
      if (!record) continue;
      if (bridgeCells(record).some(([x, z]) => x === cx && z === cz)) return record;
    }
    return null;
  }

  bridgeOverlaps(cells) {
    const taken = new Set();
    for (const record of (this.layout && this.layout.bridges) || []) {
      for (const [cx, cz] of bridgeCells(record)) taken.add(cellKey(cx, cz));
    }
    return cells.some(([cx, cz]) => taken.has(cellKey(cx, cz)));
  }

  resetBridge() {
    this.bridgeTop = null;
    this.pendingBridge = null;
    this.bridgeInfo = null;
  }

  cancelBridge() {
    if (!this.draft) return false;
    this.resetBridge();
    this.draft.cells.clear();
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  }

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
  }

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
    if (!(bankLow > gapHigh + 0.8)) return false;
    if (!Number.isFinite(toHeight) || Math.abs(top.height - toHeight) > 3) return false;
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
  }

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
  }

  applyJoin(mode) {
    if (!this.layout || !this.draft) return 0;
    if (mode === 'remove') {
      let count = 0;
      for (const key of this.draft.cells) {
        const { cx, cz } = parseCell(key);
        this.setCellHeight(cx, cz, 0);
        count += 1;
      }
      return count;
    }
    if (!this.joinHeights) return 0;
    let count = 0;
    for (const [key, meters] of this.joinHeights) {
      const { cx, cz } = parseCell(key);
      this.setCellHeight(cx, cz, meters);
      count += 1;
    }
    return count;
  }

  brushRadius() {
    const value = Number(this.brushOptionValue(this.brushKey, 'radius'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  get brushSpan() {
    return this.brushRadius() * 2 + 1;
  }

  stampCells(target, cx, cz, radius = this.brushRadius()) {
    if (!radius) {
      target.add(cellKey(cx, cz));
      return;
    }
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!this.canDraftCell(cx + dx, cz + dz)) continue;
        target.add(cellKey(cx + dx, cz + dz));
      }
    }
  }

  unstampDraft(cx, cz) {
    if (!this.draft) return false;
    const radius = this.brushRadius();
    if (!radius) return this.draft.cells.delete(cellKey(cx, cz));
    let changed = false;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (this.draft.cells.delete(cellKey(cx + dx, cz + dz))) changed = true;
      }
    }
    return changed;
  }

  undraftCell(cx, cz) {
    if (!this.draft) return false;
    if (!this.unstampDraft(cx, cz)) return false;
    if (this.onDraftChange) this.onDraftChange(this.draft);
    return true;
  }

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
    const brushLift = brush.height ? brush.height * HEIGHT_STEP : 0;
    const filled = this.zoneEntries(brushKey, brush, [...cells], mode);
    const clearedDeco = new Set();
    let changed = 0;
    for (const cell of filled) {
      const { cx, cz } = cell;
      if (mode === 'remove') {
        if (brush.surfaceOnly) {
          if (this.paintSurface(cx, cz, DEFAULT_FLOOR)) changed += 1;
          continue;
        }
        let dropped = dropDecorationCell(this.layout, cx, cz);
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
        this.layout.grass = this.layout.grass.filter((item) => item && (item.cx !== cx || item.cz !== cz));
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
          if (painted.stackable) this.dropStackableDecorations(cx, cz);
          else dropDecorationCell(this.layout, cx, cz);
          clearedDeco.add(cellId);
        }
        const lift = layerLiftAt(this.layout, cx, cz) || 0;
        const entry = { key, cx, cz, rotation: cell.rotation || 0 };
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
      if (shape === 'line') {
        this.placePath(cx, cz);
        this.setTileLift(cx, cz, brushLift);
      } else {
        this.placeEntry(key, cx, cz, 0, cell.liftY || brushLift, 'floor');
      }
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
  }

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
  }

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
  }

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
  }

  dropGrassCell(cx, cz) {
    if (!this.layout.grass) return false;
    const entries = this.layout.grass;
    const kept = entries.filter((entry) => !onSurface(entry, cx, cz));
    if (kept.length === entries.length) return false;
    this.layout.grass = kept;
    return true;
  }

  surfaceAt(cx, cz) {
    const cell = this.contentAt(cx, cz);
    return cell && cell.floor ? cell.floor.key : null;
  }

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
  }

  applyCreatureBrush(brushKey, brush, zone, mode) {
    if (!this.layout.creatures) this.layout.creatures = [];
    const kind = brush.creatureKind;
    if (!getCreatureType(kind)) return 0;
    const tier = this.creatureTierFor(brushKey);
    let changed = 0;
    for (const { cx, cz } of zone) {
      const key = cellKey(cx, cz);
      const before = this.layout.creatures.length;
      this.layout.creatures = this.layout.creatures.filter((entry) => !entry || cellKey(entry.cx, entry.cz) !== key);
      if (mode === 'remove') {
        if (this.layout.creatures.length !== before) changed += 1;
        continue;
      }
      this.layout.creatures.push({ kind, tier, cx, cz });
      changed += 1;
    }
    return changed;
  }

  scatterDecorations(brushKey, brush, cx, cz, removing) {
    const scatter = brush.scatter;
    if (!scatter || !scatter.pool || !scatter.pool.length) return false;
    if (!this.layout.decorations) this.layout.decorations = [];
    const pool = scatter.pool;
    const entries = this.layout.decorations;
    const kept = entries.filter((entry) => (
      !entry || entry.cx !== cx || entry.cz !== cz || !pool.includes(entry.key)
    ));
    let touched = kept.length !== entries.length;
    this.layout.decorations = kept;
    if (removing) return touched;
    const gate = brush.scatterGate || (brush.option ? brush.option.key : null);
    if (gate && !this.brushOptionValue(brushKey, gate)) return touched;
    const patch = noise2(cx / 3.4, cz / 3.4);
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
  }

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
  }

  cellRng(brushKey) {
    const seed = this.layout.seed || 1;
    return (label) => createRng(seedFor(seed, `${brushKey}:${label}`, 0, 0));
  }

  clusterConfigFor(brushKey, brush) {
    const base = brush && brush.cluster;
    if (!base) return null;
    const density = Math.round(Number(this.brushOptionValue(brushKey, 'density')) || 1);
    const jitter = this.brushOptionValue(brushKey, 'jitter');
    const min = Math.max(1, jitter ? density - 1 : density);
    const max = Math.max(min, jitter ? density + 1 : density);
    if (max <= 1) return null;
    return { ...base, min, max };
  }

  clusterCountAt(brushKey) {
    const config = this.clusterConfigFor(brushKey, BRUSHES[brushKey]);
    return config ? { min: config.min, max: config.max } : { min: 1, max: 1 };
  }

  speciesKeyAt(brush, pool, cx, cz) {
    if (!pool || !pool.length) return this.tileKey;
    if (this.brushOptionValue(this.brushKey, 'random')) {
      const value = hash01(cx * 41.7 + 13.1, cz * 67.3 - 7.9);
      return pool[Math.min(pool.length - 1, Math.floor(value * pool.length))];
    }
    if (brush.patch && this.brushOptionValue(this.brushKey, 'patch')) {
      const px = Math.floor(cx / brush.patch + noise2(cx / 3.1, cz / 3.1) * 0.85);
      const pz = Math.floor(cz / brush.patch + noise2(cx / 2.7 + 5, cz / 2.7 - 3) * 0.85);
      const value = noise2(px * 17.3, pz * 11.7);
      return pool[Math.min(pool.length - 1, Math.floor(value * pool.length))];
    }
    return pool.includes(this.tileKey) ? this.tileKey : pool[0];
  }

  setTileKey(key) {
    const pool = this.brushPool();
    if (!pool.includes(key)) return false;
    this.tileKey = key;
    this.setBrushOption('patch', false);
    this.setBrushOption('random', false);
    return true;
  }

  decoRotation() {
    const brush = BRUSHES[this.brushKey];
    if (!brush || !brush.rotate) return 0;
    const step = Number(this.brushOptionValue(this.brushKey, 'rotation')) || 0;
    return (((step % 8) + 8) % 8) / 2;
  }

  rotateDeco(direction = 1) {
    const brush = BRUSHES[this.brushKey];
    if (!brush || !brush.rotate) return false;
    const current = Number(this.brushOptionValue(this.brushKey, 'rotation')) || 0;
    this.setBrushOption('rotation', (((current + direction) % 8) + 8) % 8);
    return true;
  }

  decoPreview(cx, cz) {
    const brush = BRUSHES[this.brushKey];
    if (!brush || !brush.deco || !this.active) return null;
    const pool = this.brushPool();
    const key = this.speciesKeyAt(brush, pool, cx, cz);
    const def = key ? getDecoration(key) : null;
    if (!def) return null;
    const entries = fillZone(
      this.cellRng(this.brushKey),
      {
        ...brush,
        cluster: this.clusterConfigFor(this.brushKey, brush),
        pool: pool.length ? pool : brush.pool,
      },
      [cellKey(cx, cz)],
    );
    const items = entries.map((entry) => decoPlacement(def, { ...entry, cx, cz, rotation: this.decoRotation() }));
    return { key, def, items };
  }

  cancelDraft() {
    if (!this.draft) return false;
    this.resetDraftDrag();
    this.resetJoin();
    this.resetBridge();
    this.draft = null;
    if (this.onDraftChange) this.onDraftChange(null);
    return true;
  }

  markHeightCell(cx, cz) {
    if (!this.layout) return;
    if (!this.heightDraft) this.heightDraft = new Map();
    const stepping = this.heightStepSign !== 0;
    const base = this.strokeHeightLevel();
    let changed = false;
    for (const [x, z] of this.heightStampCells(cx, cz)) {
      const key = cellKey(x, z);
      const level = this.stampLevel(base, x, z);
      if (stepping) {
        if (this.heightDraft.has(key)) continue;
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
    if (this.onHeightDraftChange) this.onHeightDraftChange(this.heightDraft);
  }

  stampLevel(base, cx, cz) {
    const jitter = this.heightJitter || 0;
    if (!jitter) return base;
    const offset = Math.round((hash01(cx * 7.31 + 3.7, cz * 5.13 - 1.9) * 2 - 1) * jitter);
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, base + offset));
  }

  strokeHeightLevel() {
    const level = this.heightLevel + this.heightStepSign * this.heightStrokeStep;
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, level));
  }

  unmarkHeightCell(cx, cz) {
    if (!this.heightDraft) return false;
    let changed = false;
    for (const [x, z] of this.heightStampCells(cx, cz)) {
      if (this.heightDraft.delete(cellKey(x, z))) changed = true;
    }
    if (!changed) return false;
    if (this.onHeightDraftChange) this.onHeightDraftChange(this.heightDraft);
    return true;
  }

  get heightDraftCount() {
    return this.heightDraft ? this.heightDraft.size : 0;
  }

  heightLevelAt(cx, cz) {
    if (!this.heightDraft) return null;
    const level = this.heightDraft.get(cellKey(cx, cz));
    return Number.isFinite(level) ? level : null;
  }

  heightDraftGroups() {
    if (!this.heightDraft || !this.heightDraft.size) return [];
    const groups = new Map();
    for (const [key, level] of this.heightDraft) {
      const [cx, cz] = key.split(',').map(Number);
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push([cx, cz]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([level, cells]) => ({ level, cells }));
  }

  applyHeightSelection() {
    if (!this.layout || !this.heightDraft || !this.heightDraft.size) return 0;
    this.pushHistory();
    let count = 0;
    const touched = [];
    for (const [key, level] of this.heightDraft) {
      const [cx, cz] = key.split(',').map(Number);
      const value = Number.isFinite(level) ? level : this.heightLevel;
      this.setCellHeight(cx, cz, value * HEIGHT_STEP);
      touched.push([cx, cz]);
      count += 1;
    }
    this.cleanFlatCliffs(touched);
    this.cancelHeightDraft();
    this.repaintHeights();
    return count;
  }

  cleanFlatCliffs(cells) {
    const seen = new Set();
    for (const [cx, cz] of cells) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) seen.add(cellKey(cx + dx, cz + dz));
      }
    }
    for (const key of seen) {
      const [cx, cz] = key.split(',').map(Number);
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
  }

  cancelHeightDraft() {
    if (!this.heightDraft) return false;
    this.heightDraft = null;
    if (this.onHeightDraftChange) this.onHeightDraftChange(null);
    return true;
  }

  scheduleRegenerate(parts) {
    this.repaint(parts);
  }

  repaint(parts) {
    this.commitHistory();
    this.contentIndex = null;
    this.presentCache = null;
    if (this.onRegenerate) this.onRegenerate(this.layout, parts || PAINT_ALL);
  }

  repaintHeights() {
    this.commitHistory();
    this.contentIndex = null;
    this.presentCache = null;
    if (this.onHeightsChange) this.onHeightsChange(this.layout);
    else this.repaint();
  }

  presentCells() {
    if (!this.presentCache) {
      this.presentCache = new Set(worldCells(this.layout).map(([cx, cz]) => cellKey(cx, cz)));
    }
    return this.presentCache;
  }

  contentAt(cx, cz) {
    const index = this.contentIndexFor();
    return index.get(cellKey(cx, cz)) || null;
  }

  contentIndexFor() {
    if (this.contentIndex) return this.contentIndex;
    const index = new Map();
    const cellFor = (cx, cz) => {
      const key = cellKey(cx, cz);
      let cell = index.get(key);
      if (!cell) {
        cell = { path: null, floor: null, clearing: null, grass: null, deco: null };
        index.set(key, cell);
      }
      return cell;
    };
    for (const name of ['path', 'floor', 'clearing', 'grass']) {
      for (const entry of this.layout[name] || []) {
        if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) || levelOfEntry(entry) !== 0) continue;
        cellFor(entry.cx, entry.cz)[name] = entry;
      }
    }
    for (const entry of this.layout.decorations || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      cellFor(entry.cx, entry.cz).deco = entry;
    }
    this.contentIndex = index;
    return index;
  }

  restoreLayout(next) {
    this.layout = toWorld(next);
    this.contentIndex = null;
    this.presentCache = null;
  }

  regenerate() {
    this.repaint();
  }

  decorationsAt(cx, cz) {
    const out = [];
    for (const entry of this.layout.decorations || []) {
      if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
      const def = getDecoration(entry.key);
      out.push({ entry, def, name: def && def.displayName ? def.displayName : entry.key });
    }
    return out;
  }

  describeAt(cx, cz) {
    const layer = layerAt(this.layout, cx, cz);
    const entry = this.topEntryAt(cx, cz);
    const layerEntry = this.layerTileAt(cx, cz);
    const decorations = this.decorationsAt(cx, cz);
    const level = entry && Number.isFinite(entry.liftY) ? Math.round(entry.liftY / HEIGHT_STEP) : 0;
    return {
      brush: layer,
      entry,
      layerEntry,
      decorations,
      height: level || null,
      override: entry,
      isPath: layer === 'path',
      style: layer === 'path' ? (entry && entry.style ? entry.style : this.styleFor(this.brushKey)) : null,
      pool: this.brushPool(this.brushKey),
      key: cellKey(cx, cz),
      liftY: entry && entry.liftY ? entry.liftY : 0,
      creature: this.creatureInfoAt(cx, cz),
    };
  }
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

function hash01(a, b) {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = hash01(ix, iz) + (hash01(ix + 1, iz) - hash01(ix, iz)) * sx;
  const bottom = hash01(ix, iz + 1) + (hash01(ix + 1, iz + 1) - hash01(ix, iz + 1)) * sx;
  return top + (bottom - top) * sz;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function onSurface(entry, cx, cz) {
  return Boolean(entry) && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === 0;
}

function toWorld(world) {
  return layoutFromMapFile(world, world && world.seed);
}

function droppable(layout, cx, cz) {
  const layers = [];
  for (const name of ['floor', 'path', 'clearing', 'grass']) {
    for (const entry of layout[name] || []) {
      if (onSurface(entry, cx, cz)) layers.push(entry);
    }
  }
  const decos = (layout.decorations || []).filter((entry) => entry && entry.cx === cx && entry.cz === cz);
  return [...layers, ...decos];
}

function parseCell(cellKeyValue) {
  const [cx, cz] = String(cellKeyValue).split(',').map(Number);
  return { cx, cz };
}

function joinMeters(topMeters, bottomMeters, index, steps) {
  const raw = topMeters + (bottomMeters - topMeters) * (index / steps);
  const level = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(raw / HEIGHT_STEP)));
  return level * HEIGHT_STEP;
}

function rectCells(x0, z0, x1, z1) {
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
