// Řízení editoru mapy — spojuje práci s mapou (EditorMode) s panely a scénou.
// Drží otevření editoru, štětec, plochu, neuložené změny a ukládání mapy do souboru.
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { mapFileFromLayout } from '../data/catalogs/mapFile.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import EditorMode from './editorMode.js';
import EditorHud from './editorHud.js';
import BrushPanel from './brushPanel.js';
import AreaPanel from './areaPanel.js';
import HeightPanel from './heightPanel.js';
import { formatLevel, formatMeters, heightRampColor } from './heightRamp.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { BRUSHES } from '../data/catalogs/brushes.js';

const NO_BRUSH_HINT = 'Vyber štětec v paletě — teprve pak jde do mapy kreslit';
const HEIGHT_BAND_LIFT = 0.03;
const HEIGHT_BAND_STEP = 1.5;
const HEIGHT_TINT_ALPHA = 0.32;
const HEIGHT_GHOST_ALPHA = 0.6;

export default class MapEditor {

  constructor(scene) {
    this.s = scene;
    this.mode = new EditorMode();
    this.hud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.areaPanel = new AreaPanel();
    this.heightPanel = new HeightPanel();
    this.mapDirty = false;
    this.showHeights = true;
    this.pendingDraftView = undefined;
    this.draftViewFrame = 0;
  }

  get active() {
    return this.mode.active;
  }

  get mapMode() {
    return this.mode.mode;
  }

  get erasing() {
    return this.mode.erasing;
  }

  useLayout(layout) {
    this.mode.useLayout(layout);
  }

  getMap() {
    return this.mode.getMap();
  }

  connect() {
    this.mode.onRegenerate = () => this.s.renderMapLayout();
    this.mode.onAreaSelectionChange = (selection) => this.showAreaPreview(selection);
    this.mode.onChange = (active) => this.togglePanel(active);
    this.mode.onModeChange = (mode) => {
      this.hud.setMode(mode);
      this.syncPanels(mode);
      this.showAreaPreview(this.mode.getAreaSelection());
      this.s.handleHover(this.s.hoverCell);
    };
    this.mode.onStyleChange = (brushKey, styleKey) => {
      this.brushPanel.setStyle(styleKey);
      if (this.mode.draft) this.updateDraftView(this.mode.draft);
      else this.refreshZoneOverlay();
    };
    this.mode.onHeightChange = (level) => {
      this.heightPanel.setHeight(level);
      this.areaPanel.setHeight(this.mode.areaHeightMeters);
    };
    this.mode.onDraftChange = (draft) => this.updateDraftView(draft);
    this.mode.onHeightsChange = () => this.s.renderHeights();
    this.mode.onHeightDraftChange = () => this.refreshHeightDraftView();
    this.mode.onHeightBrushChange = (size) => this.heightPanel.setBrushSize(size);
    this.mode.onHeightStepChange = (sign) => this.heightPanel.setStepMode(sign);
    this.mode.onHeightJitterChange = (value) => this.heightPanel.setJitter(value);
    this.mode.onBrushChange = (key) => {
      this.hud.setBrush(key);
      this.openBrushPanel(key);
    };

    this.hud.onBrush = (key) => this.mode.setBrush(key);
    this.hud.onMode = (mode) => this.mode.setMode(mode);
    this.hud.onClose = () => this.close();
    this.hud.onSaveMap = () => this.saveMap();

    this.heightPanel.onLevel = (level) => this.mode.setHeightLevel(level);
    this.heightPanel.onStep = (delta) => this.mode.stepHeightLevel(delta);
    this.heightPanel.onApply = () => this.applyHeightSelection();
    this.heightPanel.onCancel = () => this.cancelHeightDraft();
    this.heightPanel.onUndo = () => this.undo();
    this.heightPanel.onPickLevel = (level) => this.mode.setHeightLevel(level);
    this.heightPanel.onBrushSize = (size) => this.mode.setHeightBrushSize(size);
    this.heightPanel.onStepMode = (sign) => this.mode.setHeightStepSign(sign);
    this.heightPanel.onJitter = (value) => this.mode.setHeightJitter(value);
    this.heightPanel.onToggleHeights = (on) => {
      this.showHeights = on;
      this.refreshHeightTint();
    };

    this.brushPanel.onApply = () => this.applyBrushDraft();
    this.brushPanel.onCancel = () => this.cancelBrushDraft();
    this.brushPanel.onStyle = (brushKey, styleKey) => this.mode.setStyle(styleKey);
    this.brushPanel.onSpecies = (key) => {
      if (!this.mode.setTileKey(key)) return;
      this.brushPanel.setSpecies(key);
      this.brushPanel.setOptions(this.mode.brushOptionValues(this.mode.brushKey));
      this.s.handleHover(this.s.hoverCell);
    };
    this.brushPanel.onOption = (optionKey, value) => {
      this.mode.setBrushOption(optionKey, value);
      this.updateDraftView(this.mode.draft);
      this.s.handleHover(this.s.hoverCell);
    };
    this.brushPanel.onErase = () => this.setEraseMode(!this.mode.erasing);
    this.brushPanel.onUndo = () => this.undo();

    this.areaPanel.onTool = (tool) => {
      this.mode.setAreaTool(tool);
      this.areaPanel.setTool(this.mode.areaTool);
      this.s.handleHover(this.s.hoverCell);
    };
    this.areaPanel.onApply = () => this.applyAreaSelection();
    this.areaPanel.onClear = () => this.clearAreaSelection();
    this.areaPanel.onUndo = () => this.undo();
    this.areaPanel.onSurface = (key) => {
      this.mode.setAreaSurface(key);
      this.areaPanel.setSurface(key);
    };
    this.areaPanel.onHeightStep = (delta) => this.mode.stepHeightLevel(delta);

    this.hud.onWaterToggle = () => this.toggleWater();
    this.hud.onWaterStep = (delta) => this.stepWater(delta);
  }

  toggleWater() {
    const shown = this.mode.toggleWaterShown();
    if (shown && this.mode.getWaterLevel() === null) {
      this.setWater(-HEIGHT_STEP);
      return;
    }
    this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.s.refreshWaterVisibility();
  }

  stepWater(delta) {
    const current = this.mode.getWaterLevel();
    const base = current === null ? 0 : current;
    this.mode.setWaterShown(true);
    this.setWater(base + delta * HEIGHT_STEP);
  }

  setWater(level) {
    const value = this.mode.setWaterLevel(level);
    this.mode.setWaterShown(true);
    this.hud.setWater(value, this.mode.waterShown);
    this.s.adoptEditorMap();
    this.s.refreshTerrain();
    this.s.handleHover(this.s.hoverCell);
    this.markDirty();
  }

  open() {
    const active = this.mode.toggle();
    if (active) {
      this.resetSelection();
      this.hud.show();
      this.hud.clearBrushSelection();
      this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
      this.hud.setReadout(NO_BRUSH_HINT);
      this.s.holdGameForEditor();
      this.syncPanels(this.mode.mode);
    } else {
      this.mode.setWaterShown(true);
      this.s.refreshWaterVisibility();
      this.s.releaseGameFromEditor();
    }
    this.s.syncZoomLimit();
    return active;
  }

  resetSelection() {
    this.mode.cancelDraft();
    this.mode.cancelHeightDraft();
    this.mode.clearAreaSelection();
    this.heightPanel.setCount(0);
    this.heightPanel.hide();
    this.brushPanel.close();
    this.areaPanel.hide();
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.centerPanels();
  }

  centerPanels() {
    for (const panel of [this.hud.root, this.brushPanel.root, this.areaPanel.root, this.heightPanel.root]) {
      if (!panel) continue;
      panel.style.left = '';
      panel.style.top = '';
    }
  }

  close() {
    this.mode.cancelDraft();
    this.mode.cancelHeightDraft();
    this.mode.clearAreaSelection();
    this.heightPanel.setCount(0);
    this.heightPanel.hide();
    this.mode.active = false;
    this.brushPanel.close();
    this.areaPanel.hide();
    this.hud.clearBrushSelection();
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.s.gridSystem.clearHeightBands();
    this.togglePanel(false);
    this.s.releaseGameFromEditor();
    this.s.syncZoomLimit();
    this.s.handleHover(this.s.hoverCell);
  }

  togglePanel(active) {
    if (!active && this.mapDirty) this.warnUnsaved();
    this.s.adoptEditorMap();
    this.s.terrainSystem.clear();
    if (active) {
      this.hud.show();
      this.hud.setMode(this.mode.mode);
    } else {
      this.hud.hide();
      this.s.gridSystem.clearBrush();
      this.brushPanel.close();
      this.areaPanel.hide();
      this.heightPanel.hide();
    }
    this.s.refreshTerrain();
    this.syncPanels(this.mode.mode);
    this.s.editorToggle.setActive(Boolean(active));
    if (active) this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
  }

  syncPanels(mode) {
    if (!this.mode.active) {
      this.areaPanel.hide();
      this.heightPanel.hide();
      return;
    }
    if (mode === 'area') {
      this.brushPanel.close();
      this.heightPanel.hide();
      this.mode.cancelDraft();
      this.refreshHeightTint();
      this.areaPanel.open({
        tool: this.mode.areaTool,
        count: this.mode.pendingAreaCells(),
        existingCount: this.mode.pendingAreaExisting(),
        undoEnabled: this.mode.canUndo,
        surface: this.mode.areaSurface,
        height: this.mode.areaHeightMeters,
      });
      return;
    }
    this.areaPanel.hide();
    if (mode === 'height') {
      this.brushPanel.close();
      this.heightPanel.open({
        level: this.mode.heightLevel,
        count: this.mode.heightDraftCount,
        undoEnabled: this.mode.canUndo,
        staged: this.stagedList(),
        showHeights: this.showHeights,
        brushSize: this.mode.heightBrushSize,
        stepSign: this.mode.heightStepSign,
        jitter: this.mode.heightJitter,
      });
      this.refreshHeightTint();
      return;
    }
    this.heightPanel.hide();
    this.refreshHeightTint();
  }

  stagedList() {
    return this.mode.heightDraftGroups().map((group) => ({
      level: group.level,
      count: group.cells.length,
    }));
  }

  refreshHeightTint() {
    const grid = this.s.gridSystem;
    if (!grid) return;
    if (!this.mode.active || this.mode.mode !== 'height' || !this.showHeights) {
      grid.clearHeightBands();
      return;
    }
    const bands = new Map();
    for (const [cx, cz] of this.s.terrainSystem.realCells || []) {
      const meters = this.mode.cellHeightValue(cx, cz);
      if (Math.abs(meters) < 0.15) continue;
      const index = Math.round(meters / HEIGHT_BAND_STEP);
      if (!index) continue;
      if (!bands.has(index)) bands.set(index, []);
      const y = this.s.decoSystem.surfaceAt(cx, cz) + HEIGHT_BAND_LIFT;
      bands.get(index).push([cx, cz, y]);
    }
    const list = [...bands.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, cells]) => {
        const color = heightRampColor(index * HEIGHT_BAND_STEP);
        return {
          cells,
          color: new Color3(color[0], color[1], color[2]),
          alpha: HEIGHT_TINT_ALPHA,
        };
      });
    grid.showHeightBands(list);
  }

  showAreaPreview(selection) {
    if (this.mode.active && this.mode.mode !== 'area') {
      this.s.gridSystem.clearBrush();
      this.areaPanel.setCount(0, 0);
      return;
    }
    const cells = selection ? selection.cells : null;
    if (!cells || !cells.length) {
      this.s.gridSystem.clearBrush();
      this.areaPanel.setCount(0, 0);
      return;
    }
    const erasing = selection.tool === 'erase';
    this.areaPanel.setTool(selection.tool);
    this.s.gridSystem.showBrush(cells, (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz), erasing);
    const count = this.mode.pendingAreaCells();
    this.areaPanel.setCount(count, this.mode.pendingAreaExisting());
    if (selection.drag) {
      this.hud.setReadout(`plocha: ${cells.length} buněk označeno — pusť myš a klikni Aplikovat`);
    }
  }

  applyAreaSelection() {
    const selection = this.mode.getAreaSelection();
    if (!selection || !selection.cells.length) return false;
    const erasing = selection.tool === 'erase';
    const pending = this.mode.pendingAreaCells();
    const existing = this.mode.pendingAreaExisting();
    const summary = this.areaPanel.summary();
    this.mode.applyAreaSelection();
    this.s.gridSystem.clearBrush();
    this.areaPanel.setCount(0, 0);
    this.refreshUndoButton();
    this.s.handleHover(this.s.hoverCell);
    if (!erasing) {
      const verb = existing > 0 ? 'Přepsáno' : 'Přidáno';
      this.hud.setReadout(`${verb} ${pending} buněk · ${summary}`);
    } else if (!pending) this.hud.setReadout('Nic k smazání — tyhle buňky v mapě nejsou');
    else this.hud.setReadout(`Smazáno ${pending} buněk i s objekty`);
    return true;
  }

  clearAreaSelection() {
    if (!this.mode.hasAreaSelection) return false;
    this.mode.clearAreaSelection();
    this.s.gridSystem.clearBrush();
    this.areaPanel.setCount(0, 0);
    this.hud.setReadout('Výběr plochy zahozen');
    return true;
  }

  setEraseMode(on) {
    this.mode.setDraftMode(on ? 'remove' : 'add');
    this.hud.erasing = this.mode.erasing;
    this.hud.refresh();
    this.brushPanel.setDraftMode(this.mode.draftMode);
    this.hud.setReadout(on ? 'Mazat: zvýrazněná pole jdou smazat — přejeď je myší' : 'Mazání vypnuto');
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.s.handleHover(this.s.hoverCell);
  }

  openBrushPanel(brushKey) {
    this.mode.beginDraft(brushKey);
    this.brushPanel.open(brushKey, 0, this.mode.pathStyle, this.mode.brushOptionValues(brushKey), this.mode.tileKey);
    this.brushPanel.setDraftMode(this.mode.draftMode);
    if (this.mode.isJoinBrush) this.hud.setReadout('Spojnice: klikni na vrchol, pak na spodek');
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.s.handleHover(this.s.hoverCell);
  }

  paintCell(cx, cz) {
    return this.mode.paint(cx, cz);
  }

  describeCell(cx, cz) {
    return this.mode.describeAt(cx, cz);
  }

  clearHoverReadout() {
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.hud.setReadout('–');
    this.s.tooltipPanel.hide();
  }

  showAreaHoverReadout(cell) {
    const info = this.mode.describeAt(cell.cx, cell.cz);
    const state = this.mode.areaTool === 'erase' ? 'mažu' : 'maluju';
    const zone = info.layerEntry ? `povrch: ${entryLabel(info.layerEntry)}` : 'bez povrchu';
    this.s.tooltipPanel.show(`Plocha — ${state}`, `${cell.cx}, ${cell.cz} · ${zone}`);
  }

  showCellHoverReadout(cell) {
    const info = this.mode.describeAt(cell.cx, cell.cz);
    const parts = [];
    const surface = entryLabel(info.layerEntry);
    if (surface) parts.push(surface);
    for (const item of info.decorations || []) parts.push(item.name);
    const lift = Math.round((Number(info.liftY) || 0) * 100) / 100;
    const staged = this.mode.mode === 'height' ? this.mode.heightLevelAt(cell.cx, cell.cz) : null;
    const joined = this.mode.joinMetersAt(cell.cx, cell.cz);
    let target = '';
    if (staged !== null) target = ` → ${formatLevel(staged)}`;
    else if (joined !== null) target = ` → ${formatMeters(joined)}`;
    let draft = '';
    if (this.mode.draft) {
      const count = this.mode.clusterCountAt(this.mode.draft.brushKey);
      const amount = count.max > 1 ? (count.min === count.max ? ` ×${count.min}` : ` ×${count.min}–${count.max}`) : '';
      draft = ` · kreslím: ${brushLabel(this.mode.draft.brushKey)}${amount}`;
    }
    const title = parts.length ? parts.join(' · ') : 'Prázdno';
    this.s.tooltipPanel.show(title, `${cell.cx}, ${cell.cz} · výška ${formatMeters(lift)}${target}${draft}`);
  }

  startPaint(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'area') this.mode.beginAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') {
      this.mode.beginHeightStroke();
      this.mode.paint(cell.cx, cell.cz);
    } else if (!this.mode.hasBrush) this.hud.setReadout(NO_BRUSH_HINT);
    else if (this.mode.isJoinBrush) this.pickJoinCell(cell);
    else if (!this.mode.canDraftCell(cell.cx, cell.cz)) this.hud.setReadout('Mimo hrací plochu — přepni na Plochu');
    else this.mode.beginDraftDrag(cell.cx, cell.cz);
  }

  pickJoinCell(cell) {
    if (this.mode.draftMode === 'remove') {
      this.hud.setReadout('Spojnice se v režimu Mazat nepoužívá — vypni Mazat');
      return;
    }
    const state = this.mode.pickJoinCell(cell.cx, cell.cz);
    if (state === 'invalid') {
      this.hud.setReadout('Spojnice: klikni na buňku, která v mapě existuje');
      return;
    }
    if (state === 'top') {
      this.hud.setReadout('Vrchol označen — klikni na spodek');
      return;
    }
    const info = this.mode.joinInfo;
    if (!info) return;
    const limit = Number(this.s.walkStepLimit);
    const steep = Number.isFinite(limit) && info.maxStep > limit;
    const note = steep ? ' — hráč to nevyleze' : '';
    this.hud.setReadout(`Spojnice: ${info.count} buněk · krok ${formatMeters(info.maxStep)}${note}`);
  }

  movePaint(cell) {
    const from = this.lastPaintCell || cell;
    if (this.mode.mode === 'area') this.mode.moveAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') this.mode.paintRun(from, cell);
    else if (!this.mode.isJoinBrush) this.mode.moveDraftDrag(cell.cx, cell.cz);
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
  }

  rightMovePaint(cell) {
    const from = this.lastPaintCell || cell;
    if (this.mode.mode === 'area') this.mode.removeAreaRun(from, cell);
    else if (this.mode.mode === 'height') this.mode.unmarkHeightRun(from, cell);
    else this.mode.undraftRun(from, cell);
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
  }

  rightClickCell(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'zone' && this.mode.isJoinBrush) {
      this.mode.cancelJoin();
      this.hud.setReadout('Spojnice zrušena — klikni znovu na vrchol');
      return;
    }
    if (this.mode.mode === 'area') {
      this.mode.removeAreaCells([[cell.cx, cell.cz]]);
      return;
    }
    if (this.mode.mode === 'height') {
      this.mode.unmarkHeightCell(cell.cx, cell.cz);
      return;
    }
    if (!this.mode.canEditCell(cell.cx, cell.cz)) return;
    if (!this.mode.hasBrush) {
      this.hud.setReadout(NO_BRUSH_HINT);
      return;
    }
    this.mode.undraftCell(cell.cx, cell.cz);
  }

  applyBrushDraft() {
    const removing = this.mode.draftMode === 'remove';
    const heightBrush = this.mode.isHeightBrush;
    const surfaceBrush = this.mode.isSurfaceBrush;
    const cliffBrush = this.mode.isCliffBrush;
    const joinBrush = this.mode.isJoinBrush;
    const count = this.mode.applyDraft();
    if (count && cliffBrush) {
      this.hud.setReadout(removing
        ? `Útes zrušen u ${count} buněk`
        : `Označeno jako útes: ${count} buněk`);
    } else if (count && joinBrush) {
      this.hud.setReadout(removing ? `Spojnice srovnána: ${count} buněk` : `Spojnice hotová: ${count} buněk`);
    } else if (count && surfaceBrush) {
      this.hud.setReadout(removing
        ? `Vráceno na trávu ${count} buněk`
        : `Pláž hotová: ${count} buněk i s břehem`);
    } else if (count) {
      const verb = heightBrush && removing ? 'Srovnáno ' : heightBrush ? 'Aplikováno ' : removing ? 'Smazáno ' : 'Aplikováno ';
      const suffix = heightBrush ? ' (i se svahem)' : '';
      this.hud.setReadout(verb + count + ' buněk' + suffix);
    } else if (cliffBrush) {
      this.hud.setReadout(removing ? 'Nic k vrácení' : 'Tyhle buňky už jsou označené');
    } else this.hud.setReadout(removing ? 'Nic ke smazání' : 'Prázdná zóna');
    this.brushPanel.setDraftMode(this.mode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.s.handleHover(this.s.hoverCell);
  }

  cancelBrushDraft() {
    this.mode.cancelDraft();
    this.brushPanel.close();
    this.hud.clearBrushSelection();
    this.refreshZoneOverlay();
    this.s.handleHover(this.s.hoverCell);
  }

  undo() {
    if (!this.mode.undo()) {
      this.refreshUndoButton();
      this.s.handleHover(this.s.hoverCell);
      return false;
    }
    this.ensureDraft();
    this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.refreshUndoButton();
    this.areaPanel.setCount(this.mode.pendingAreaCells(), this.mode.pendingAreaExisting());
    this.refreshHeightTint();
    this.s.handleHover(this.s.hoverCell);
    return true;
  }

  ensureDraft() {
    if (this.mode.draft) return;
    if (!this.brushPanel.isOpen) return;
    const brushKey = this.mode.brushKey;
    if (!brushKey) return;
    this.mode.beginDraft(brushKey);
  }

  refreshUndoButton() {
    this.brushPanel.setUndoEnabled(this.mode.canUndo);
    this.areaPanel.setUndoEnabled(this.mode.canUndo);
    this.heightPanel.setUndoEnabled(this.mode.canUndo);
  }

  updateDraftView(draft) {
    this.pendingDraftView = draft;
    if (this.draftViewFrame) return;
    this.draftViewFrame = requestAnimationFrame(() => {
      this.draftViewFrame = 0;
      const next = this.pendingDraftView;
      this.pendingDraftView = undefined;
      this.applyDraftView(next);
    });
  }

  applyDraftView(draft) {
    if (draft === undefined) return;
    if (!draft) {
      this.brushPanel.setCount(0);
      this.refreshUndoButton();
      this.refreshZoneOverlay();
      return;
    }
    this.brushPanel.setDraftMode(draft.mode);
    const shape = this.mode.heightDraftShape(draft);
    const slopeCount = shape ? shape.slope.length : 0;
    const rimCount = shape && shape.rim ? shape.rim.length : 0;
    this.brushPanel.setCount(draft.cells.size, slopeCount, rimCount);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
  }

  refreshZoneOverlay() {
    if (!this.mode.active || !this.s.mapLayout) {
      this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      this.s.gridSystem.clearHeightBands();
      return;
    }
    if (this.mode.mode === 'height' && this.mode.heightDraftCount) {
      this.showHeightDraftOverlay();
      return;
    }
    if (!this.mode.hasDraft) {
      this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      return;
    }
    const draft = this.mode.draft;
    const removing = draft.mode === 'remove';
    const surfaceAt = (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz);
    const same = [];
    const other = [];
    const shape = this.mode.heightDraftShape(draft);

    const draftCells = [];
    for (const key of draft.cells) {
      const [cx, cz] = key.split(',').map(Number);
      draftCells.push([cx, cz]);
      if (removing) continue;
      if (this.mode.draftHasSame(cx, cz)) same.push([cx, cz]);
    }
    if (!removing && this.mode.draftKeys.length) {
      const seen = new Set();
      const radius = draftCells.length > 300 ? 1 : 3;
      for (const [cx, cz] of draftCells) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const nx = cx + dx;
            const nz = cz + dz;
            const key = `${nx},${nz}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!this.mode.draftHasContent(nx, nz)) continue;
            if (this.mode.draftHasSame(nx, nz)) same.push([nx, nz]);
            else other.push([nx, nz]);
          }
        }
      }
    }

    const eraseTargets = removing ? this.mode.eraseCandidates() : [];
    this.s.gridSystem.showZones([
      {
        cells: eraseTargets,
        color: new Color3(0.95, 0.45, 0.3),
        glow: new Color3(0.55, 0.16, 0.1),
        alpha: 0.16,
        lift: 0.012,
      },
      {
        cells: other,
        color: new Color3(0.5, 0.55, 0.6),
        glow: new Color3(0.32, 0.36, 0.4),
        alpha: 0.28,
        lift: 0.015,
      },
      {
        cells: same,
        color: new Color3(0.3, 0.62, 0.36),
        glow: new Color3(0.2, 0.45, 0.26),
        alpha: 0.3,
        lift: 0.02,
      },
      {
        cells: draftCells,
        color: removing ? new Color3(1, 0.3, 0.25) : new Color3(0.15, 1, 0.85),
        glow: removing ? new Color3(0.95, 0.25, 0.2) : new Color3(0.2, 0.95, 0.8),
        alpha: 0.72,
        lift: 0.055,
      },
      {
        cells: shape ? shape.slope.map((entry) => [entry.cx, entry.cz]) : [],
        color: new Color3(0.95, 0.7, 0.2),
        glow: new Color3(0.85, 0.6, 0.15),
        alpha: 0.34,
        lift: 0.035,
      },
      {
        cells: shape && shape.rim ? shape.rim.map((entry) => [entry.cx, entry.cz]) : [],
        color: new Color3(0.95, 0.88, 0.55),
        glow: new Color3(0.85, 0.78, 0.4),
        alpha: 0.22,
        lift: 0.03,
      },
    ], surfaceAt);

    this.s.gridSystem.showDraftCells(draftCells, surfaceAt, draft.mode);
  }

  showHeightDraftOverlay() {
    const groups = this.mode.heightDraftGroups();
    if (!groups.length) {
      this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      return;
    }
    const surfaceAt = (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz);
    const cells = [];
    const zones = [];
    for (const group of groups) {
      for (const cell of group.cells) cells.push(cell);
      const color = heightRampColor(group.level * HEIGHT_STEP);
      const bright = color.map((channel) => Math.min(1, 0.35 + channel * 0.8));
      const target = group.level * HEIGHT_STEP;
      zones.push({
        cells: group.cells,
        color: new Color3(bright[0], bright[1], bright[2]),
        glow: new Color3(bright[0] * 0.85, bright[1] * 0.85, bright[2] * 0.85),
        alpha: HEIGHT_GHOST_ALPHA,
        yAt: (cx, cz) => surfaceAt(cx, cz) - this.mode.cellHeightValue(cx, cz) + target + HEIGHT_BAND_LIFT,
      });
    }
    this.s.gridSystem.showZones(zones, surfaceAt);
    this.s.gridSystem.showDraftCells(cells, surfaceAt, 'add');
  }

  applyHeightSelection() {
    const count = this.mode.applyHeightSelection();
    if (count) this.hud.setReadout(`Aplikováno ${count} buněk — výšky se přepočítají`);
    else this.hud.setReadout('Prázdný návrh výšek');
    this.heightPanel.setCount(this.mode.heightDraftCount);
    this.heightPanel.setStaged(this.stagedList());
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.refreshHeightTint();
    this.s.handleHover(this.s.hoverCell);
  }

  cancelHeightDraft() {
    const had = this.mode.cancelHeightDraft();
    this.heightPanel.setCount(0);
    this.heightPanel.setStaged([]);
    this.refreshZoneOverlay();
    this.s.handleHover(this.s.hoverCell);
    if (had) this.hud.setReadout('Návrh výšek zrušen');
  }

  refreshHeightDraftView() {
    this.heightPanel.setCount(this.mode.heightDraftCount);
    this.heightPanel.setStaged(this.stagedList());
    this.refreshZoneOverlay();
  }

  warnUnsaved() {
    this.s.hud.setSaveHint('Mapa ještě není zapsaná v souboru — po obnovení stránky se změny ztratí');
  }

  markDirty() {
    if (this.mapDirty) return;
    this.mapDirty = true;
    this.hud.setReadout('● Neuložené změny');
  }

  clearDirty() {
    this.mapDirty = false;
    this.hud.setReadout('Uloženo ✓');
  }

  saveMap() {
    const layout = this.mode.getMap();
    const key = typeof this.s.mapKey === 'string' ? this.s.mapKey.toLowerCase() : '';
    const file = mapFileFromLayout(key, layout);
    if (!file) {
      this.hud.setReadout('Mapu nejde složit');
      return Promise.resolve(false);
    }
    if (!Number.isInteger(layout.spawn.cx) || !Number.isInteger(layout.spawn.cz)) {
      this.markDirty();
      this.hud.setReadout(`● Neuložené změny — střed mapy nemá platné souřadnice (${layout.spawn.cx}, ${layout.spawn.cz})`);
      return Promise.resolve(false);
    }
    const broken = brokenEntries(layout);
    if (broken) {
      this.markDirty();
      this.hud.setReadout('● Neuložené změny');
      this.s.hud.setSaveHint(`Mapa se neuložila — ${broken} buněk nemá platné souřadnice, takže by se v souboru rozsypala`);
      return Promise.resolve(false);
    }
    this.hud.setReadout('Ukládám do souboru…');
    return this.writeMapFile(file).then((result) => this.finishSave(file, result));
  }

  finishSave(file, result) {
    this.s.mapFile = file;
    if (result.ok) {
      this.clearDirty();
      this.s.hud.setSaveHint('Mapa zapsaná do souboru projektu ✓');
      return true;
    }
    this.downloadMapFile(file);
    this.markDirty();
    this.hud.setReadout(`● Neuložené změny — server odmítl: ${result.reason}`);
    this.s.hud.setSaveHint(`Mapu se nepodařilo zapsat do souboru (${result.reason}) — soubor je stažený, polož ho do projektu`);
    return false;
  }

  async writeMapFile(file) {
    const url = `/_map/${encodeURIComponent(file.mapKey)}`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
    } catch {
      return { ok: false, reason: `server neodpověděl (${url})` };
    }
    if (response.ok) return { ok: true };
    let reason = `HTTP ${response.status}`;
    try {
      const answer = await response.json();
      if (answer && answer.error) reason = `${reason} — ${answer.error}`;
    } catch {
      reason = `${reason} z ${url}`;
    }
    return { ok: false, reason };
  }

  downloadMapFile(file) {
    const name = `${file.mapKey}-map.json`;
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function entryLabel(entry) {
  if (!entry) return null;
  const def = getDecoration(entry.key);
  return def && def.displayName ? def.displayName : entry.key;
}

function brushLabel(key) {
  const brush = BRUSHES[key];
  return brush ? brush.label : key;
}

function brokenEntries(layout) {
  let count = 0;
  for (const name of ['floor', 'path', 'clearing', 'decorations']) {
    for (const entry of layout[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) count += 1;
    }
  }
  return count;
}
