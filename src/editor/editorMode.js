// Editační režim mapy — vyplňování buněk štětcem, modelování výšek a práce s plochou.
// Přepíná se F2, drží jen hotovou mapu a historii úprav; vykreslování si řídí scéna.
import { BRUSHES, brushOptions, PAINT_ALL, PAINT_TERRAIN } from '../data/catalogs/brushes.js';
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { MIN_HEIGHT, MAX_HEIGHT, HEIGHT_STEP, DEFAULT_HEIGHT_LEVEL } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { PLANE_LAYERS } from '../data/maps/areaShape.js';
import { fillZone } from '../utils/zoneFill.js';
import { decoPlacement } from '../utils/decoPlacement.js';
import { onSurface, toWorld, rectCells, bresenham } from './editorSettings.js';
import editorHistoryParts from './editorHistory.js';
import editorLayoutEditsParts from './editorLayoutEdits.js';
import editorHeightsParts from './editorHeights.js';
import editorAreaParts from './editorArea.js';
import editorJoinBridgeParts from './editorJoinBridge.js';
import editorBrushApplyParts from './editorBrushApply.js';
import editorQueryParts from './editorQuery.js';

function droppable(layout, cx, cz) {
  const layers = [];
  for (const name of PLANE_LAYERS) {
    for (const entry of layout[name] || []) {
      if (onSurface(entry, cx, cz)) layers.push(entry);
    }
  }
  const decos = (layout.decorations || []).filter((entry) => entry && entry.cx === cx && entry.cz === cz);
  return [...layers, ...decos];
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

  useLayout(world) {
    if (!world) return;
    this.restoreLayout(world);
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

  get areaHeightMeters() {
    return this.heightLevel * HEIGHT_STEP;
  }

  get hasAreaSelection() {
    return Boolean(this.areaSelection && this.areaSelection.cells.length);
  }

  get areaSelectionCount() {
    return this.areaSelection ? this.areaSelection.cells.length : 0;
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

  get heightDraftCount() {
    return this.heightDraft ? this.heightDraft.size : 0;
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

  restoreLayout(next) {
    this.layout = toWorld(next);
    this.contentIndex = null;
    this.presentCache = null;
  }

  regenerate() {
    this.repaint();
  }
}

Object.assign(EditorMode.prototype, editorHistoryParts, editorLayoutEditsParts, editorHeightsParts, editorAreaParts, editorJoinBridgeParts, editorBrushApplyParts, editorQueryParts);
