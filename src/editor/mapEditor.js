// Řízení editoru mapy — spojuje práci s mapou (EditorMode) s panely a scénou.
// Drží otevření editoru, štětec, plochu, neuložené změny a ukládání mapy do souboru.
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { mapFileFromLayout } from '../data/catalogs/mapFile.js';
import { HEIGHT_STEP, HEIGHT_PRESETS, formatMeters } from '../data/maps/layoutStore.js';
import EditorMode from './editorMode.js';
import EditorHud from './editorHud.js';
import BrushPanel from './brushPanel.js';
import AreaPanel from './areaPanel.js';
import HeightPanel from './heightPanel.js';
import FloorPanel from './floorPanel.js';
import CreatureOverlay from './creatureOverlay.js';
import HeightLabels from './heightLabels.js';
import HeightHologram from './heightHologram.js';
import { formatLevel } from './heightRamp.js';
import { FLOOR_MARKS } from './editorFloors.js';
import { floorName } from './floorPanel.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { BRUSHES, brushAboveGroundOnly } from '../data/catalogs/brushes.js';
import { CELL_SIZE } from '../utils/gridMath.js';
import { SIDES } from './editorSettings.js';
import { ENTRY_LAYERS } from '../data/maps/areaShape.js';
import { NO_FLOOR_PICK_HEIGHT } from '../scenes/sceneSettings.js';
import editorLakesParts from './editorLakes.js';
import editorRiversParts from './editorRivers.js';

const TAB_KEYS = { Digit1: 'zone', Digit2: 'height', Digit3: 'area', Digit4: 'floors' };
const HEIGHT_LABEL_LIFT = 0.45;
const HEIGHT_LABEL_LIMIT = 240;
const MARKS_FOLLOW_SECONDS = 0.25;

const NO_BRUSH_HINT = 'Vyber štětec v paletě — teprve pak jde do mapy kreslit';

export default class MapEditor {

  constructor(scene) {
    this.s = scene;
    this.marksClock = 0;
    this.mode = new EditorMode();
    this.hud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.areaPanel = new AreaPanel();
    this.heightPanel = new HeightPanel();
    this.floorPanel = new FloorPanel();
    this.creatureOverlay = new CreatureOverlay(this.s.s);
    this.heightLabels = new HeightLabels();
    this.heightHologram = new HeightHologram(this.s.s);
    this.mapDirty = false;
    this.savedFingerprint = null;
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
    this.savedFingerprint = this.mode.fingerprint();
  }

  getMap() {
    return this.mode.getMap();
  }

  connect() {
    this.mode.onRegenerate = (layout, parts) => this.s.renderMapLayout(parts);
    this.mode.onAreaSelectionChange = (selection) => this.showAreaPreview(selection);
    this.mode.onChange = (active) => this.togglePanel(active);
    this.mode.onModeChange = (mode) => {
      this.hud.setMode(mode);
      this.syncPanels(mode);
      this.syncFloorView();
      this.showAreaPreview(this.mode.getAreaSelection());
      this.refreshZoneOverlay();
      this.refreshCreatureMarks();
      this.s.handleHover(this.s.hoverCell);
    };
    this.mode.onStyleChange = (brushKey, styleKey) => {
      this.brushPanel.setStyle(styleKey);
      if (this.mode.draft) this.updateDraftView(this.mode.draft);
      else this.refreshZoneOverlay();
      this.refreshCreatureMarks();
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
    this.mode.onHeightNeighborsChange = (on) => this.heightPanel.setFromNeighbors(on);
    this.mode.onBrushChange = (key) => {
      this.hud.setBrush(key);
      this.hud.setErasing(this.mode.erasing);
      if (key) {
        this.openBrushPanel(key);
        return;
      }
      this.brushPanel.close();
      this.refreshZoneOverlay();
      this.refreshCreatureMarks();
    };

    this.hud.onBrush = (key) => this.mode.setBrush(key);
    this.hud.onMode = (mode) => this.mode.setMode(mode);
    this.hud.onClose = () => this.requestClose();
    this.hud.onSaveMap = () => this.saveMap();
    this.hud.onPause = () => {
      this.s.togglePause();
      this.hud.setPaused(this.s.paused);
    };

    this.heightPanel.onLevel = (level) => this.mode.setHeightLevel(level);
    this.heightPanel.onStep = (delta) => this.mode.stepHeightLevel(delta);
    this.heightPanel.onApply = () => this.applyHeightSelection();
    this.heightPanel.onCancel = () => this.cancelHeightDraft();
    this.heightPanel.onUndo = () => this.undo();
    this.heightPanel.onPickLevel = (level) => this.mode.setHeightLevel(level);
    this.heightPanel.onBrushSize = (size) => this.mode.setHeightBrushSize(size);
    this.heightPanel.onStepMode = (sign) => this.mode.setHeightStepSign(sign);
    this.heightPanel.onJitter = (value) => this.mode.setHeightJitter(value);
    this.heightPanel.onFromNeighbors = (on) => this.mode.setHeightFromNeighbors(on);

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
    this.hud.onFloor = (level) => {
      this.mode.selectFloor(level);
      if (this.mode.draft) {
        this.mode.draft.cells.clear();
        if (this.mode.onDraftChange) this.mode.onDraftChange(this.mode.draft);
      }
      this.syncFloorView();
      this.announceBrushFloor();
      this.s.handleHover(this.s.hoverCell);
    };

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

    this.floorPanel.onSelect = (level) => {
      this.mode.selectFloor(level);
      this.syncFloorView();
      this.s.handleHover(this.s.hoverCell);
    };
    this.floorPanel.onAdd = () => {
      this.mode.addFloor();
      this.syncFloorView();
      this.s.handleHover(this.s.hoverCell);
    };
    this.floorPanel.onTool = (tool) => {
      this.mode.setAreaTool(tool);
      this.refreshFloorPanel();
    };
    this.floorPanel.onRename = (floor) => this.askFloorName(floor);
    this.floorPanel.onDelete = (floor) => {
      this.mode.deleteFloor(floor.level);
      this.syncFloorView();
      this.refreshFloorPanel();
      this.s.handleHover(this.s.hoverCell);
      this.markDirty();
    };
    this.floorPanel.onSurface = (key) => {
      this.mode.setAreaSurface(key);
      this.refreshFloorPanel();
    };
    this.floorPanel.onHeightStep = (delta) => this.stepFloorHeight(delta);
    this.floorPanel.onClearanceStep = (delta) => {
      this.mode.stepFloorClearance(delta);
      this.refreshFloorPanel();
    };
    this.floorPanel.onApply = () => this.applyAreaSelection();
    this.floorPanel.onClear = () => this.clearAreaSelection();
    this.floorPanel.onUndo = () => this.undo();
    this.floorPanel.onRaise = () => {
      const count = this.mode.raiseLowCeilings();
      this.refreshUndoButton();
      this.hud.setReadout(`Strop zvednut u ${count} buněk`);
    };

    this.hud.onWaterToggle = () => this.toggleWater();
    this.hud.onWaterStep = (delta) => this.stepWater(delta);
  }

  floorPlane(x, z, picking = false) {
    if (!this.mode.active || !this.mode.undergroundView) return null;
    const level = this.mode.floorLevel;
    const navigation = this.s.navigation;
    if (navigation.isWalkableAt(x, z, level)) return this.s.terrainSystem.heightAt(x, z, level);
    return picking && this.mode.mode === 'zone' && navigation.floorCells(level).size ? NO_FLOOR_PICK_HEIGHT : this.mode.floorHeight;
  }

  floorView() {
    return this.mode.floorView();
  }

  shapesTerrain() {
    if (!this.mode.active) return false;
    if (this.mode.mode === 'height') return true;
    const brush = this.mode.mode === 'zone' && this.mode.brushKey ? BRUSHES[this.mode.brushKey] : null;
    return Boolean(brush && brush.group === 'Terén');
  }

  syncFloorView() {
    const underground = this.mode.active && this.mode.undergroundView;
    this.s.revealSystem.setEditorMap(underground ? this.mode.floorViewMap() : null);
    this.s.gridSystem.setOverlaysOnTop(underground);
    this.refreshCreatureMarks();
    this.showFloorEdges(this.mode.getAreaSelection());
    if (this.mode.active) this.hud.setFloors(this.mode.floorList(), this.mode.floorLevel);
    const below = this.mode.floorLevel < 0;
    this.hud.setUnderground(below);
    if (below && brushAboveGroundOnly(this.mode.brushKey)) this.mode.setBrush(null);
    if (this.mode.active && this.mode.mode === 'floors') {
      this.refreshFloorPanel();
      this.refreshZoneOverlay();
    }
  }

  stepFloorHeight(delta) {
    this.mode.stepFloorHeight(delta);
    this.syncFloorView();
    this.showAreaPreview(this.mode.getAreaSelection());
    this.s.handleHover(this.s.hoverCell);
  }

  currentFloorReport() {
    return this.mode.floorReport(this.s.terrainSystem.movementConnectors);
  }

  floorPanelView() {
    const selection = this.mode.getAreaSelection();
    return {
      floors: this.mode.floorList(),
      level: this.mode.floorLevel,
      tool: this.mode.areaTool,
      surface: this.mode.areaSurface,
      height: this.mode.floorHeight,
      clearance: this.mode.floorClearance,
      count: selection ? selection.cells.length : 0,
      undoEnabled: this.mode.canUndo,
      report: this.mode.undergroundFloor ? this.currentFloorReport() : null,
      edgeCounts: this.floorEdgeCounts,
    };
  }

  refreshFloorPanel() {
    this.floorPanel.update(this.floorPanelView());
  }

  showFloorMarks() {
    if (!this.mode.undergroundFloor) {
      this.s.gridSystem.clearZones();
      return;
    }
    const report = this.currentFloorReport();
    this.floorMarksReport = report;
    const door = Color3.FromArray(FLOOR_MARKS.door);
    const problem = Color3.FromArray(FLOOR_MARKS.problem);
    this.s.gridSystem.showZones([
      { cells: report.doors, color: door, glow: door, alpha: 0.6, lift: 0.06 },
      { cells: [...report.low, ...report.pierced, ...report.steep], color: problem, glow: problem, alpha: 0.45, lift: 0.05 },
    ], (cx, cz) => this.s.cellSurfaceAt(cx, cz));
  }

  askFloorName(floor) {
    this.s.dialog.ask({
      title: 'Přejmenovat patro',
      text: 'Prázdné pole vrátí původní název. Název se uloží s mapou.',
      input: { value: floor.name || '', placeholder: floorName(floor.level), maxLength: 32 },
      confirmLabel: 'Uložit',
      onConfirm: (name) => {
        this.mode.renameFloor(floor.level, name);
        this.syncFloorView();
        this.refreshFloorPanel();
        this.markDirty();
      },
    });
  }

  showCaveStart(plan) {
    if (!plan) {
      this.s.gridSystem.showEdges([]);
      this.s.tooltipPanel.show('Povrch', 'Najeď na stěnu útesu a klikni — začneš kopat jeskyni');
      return;
    }
    const color = plan.missing ? FLOOR_MARKS.problem : FLOOR_MARKS.door;
    this.s.gridSystem.showEdges([{ cx: plan.cx, cz: plan.cz, dx: plan.dx, dz: plan.dz, y: plan.floor, color }]);
    if (plan.missing) this.s.tooltipPanel.show('Sem jeskyně nepůjde', `Útes je moc nízký, chybí ${formatMeters(plan.missing)}`);
    else this.s.tooltipPanel.show('Vykopat jeskyni', `Klikni · vchod ve výšce ${formatMeters(plan.floor)} · patro ${String(plan.level).replace('-', '−')}`);
  }

  startCave(cell) {
    const plan = this.mode.caveStartAt(cell);
    if (!plan) {
      this.hud.setReadout('Klikni na stěnu útesu, tam začne vchod do jeskyně');
      return;
    }
    if (plan.missing) {
      this.hud.setReadout(`Útes je moc nízký, chybí ${formatMeters(plan.missing)}`);
      return;
    }
    this.mode.beginCave(plan);
    this.syncFloorView();
    this.hud.setReadout('Táhni výběr do skály a potvrď Aplikovat');
  }

  showFloorHoverReadout(cell) {
    this.hud.setCursorValue(null);
    if (!this.mode.undergroundView) {
      this.showCaveStart(this.mode.caveStartAt(cell));
      return;
    }
    const zone = this.mode.mode === 'zone';
    const state = zone ? 'kreslím předměty' : (this.mode.areaTool === 'erase' ? 'zasypávám' : 'kopu');
    const report = zone ? null : this.floorMarksReport;
    const has = (list) => Boolean(report) && list.some(([cx, cz]) => cx === cell.cx && cz === cell.cz);
    let mark = '';
    if (report && has(report.doors)) mark = ' · vchod';
    else if (report && has(report.pierced)) mark = ' · strop prorazil povrch';
    else if (report && has(report.low)) mark = ' · nízký strop';
    else if (report && has(report.steep)) mark = ' · příliš strmé';
    const dug = this.mode.floorEntries(this.mode.floorLevel).find((entry) => entry.cx === cell.cx && entry.cz === cell.cz);
    const floorText = dug ? `podlaha ${formatMeters(dug.liftY || 0)}` : `nová podlaha ${formatMeters(this.mode.floorHeight)}`;
    this.s.tooltipPanel.show(`Patro — ${state}`, `${cell.cx}, ${cell.cz} · ${floorText}${mark}`);
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
    const snapped = Math.round((Number(level) || 0) / HEIGHT_STEP) * HEIGHT_STEP;
    const value = this.mode.setWaterLevel(snapped);
    this.mode.setWaterShown(true);
    this.hud.setWater(value, this.mode.waterShown);
    this.s.adoptEditorMap();
    this.s.renderWater();
    this.s.handleHover(this.s.hoverCell);
    this.markDirty();
  }

  open() {
    if (this.mode.active) return this.requestClose();
    this.mode.setBrush(null);
    this.mode.setDraftMode('add');
    this.hud.setErasing(false);
    this.resetSelection();
    this.mode.toggle();
    this.hud.setReadout(NO_BRUSH_HINT);
    this.s.holdGameForEditor();
    this.s.syncZoomLimit();
    return true;
  }

  resetSelection() {
    this.mode.cancelDraft();
    this.mode.cancelHeightDraft();
    this.mode.clearAreaSelection();
    this.heightPanel.setCount(0);
    this.heightPanel.hide();
    this.floorPanel.hide();
    this.brushPanel.close();
    this.areaPanel.hide();
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearCreatureRadius();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.centerPanels();
  }

  centerPanels() {
    for (const panel of [this.hud.root, this.brushPanel.root, this.areaPanel.root, this.heightPanel.root, this.floorPanel.root]) {
      if (!panel) continue;
      panel.style.left = '';
      panel.style.top = '';
    }
  }

  requestClose() {
    const leave = () => {
      this.close();
      this.s.editorToggle.setActive(false);
    };
    if (!this.mapDirty) {
      leave();
      return false;
    }
    this.s.dialog.ask({
      title: 'Neuložené změny',
      text: 'V mapě jsou změny, které ještě nejsou v souboru. Po obnovení stránky by se ztratily.',
      confirmLabel: 'Uložit a zavřít',
      cancelLabel: 'Zůstat',
      extraLabel: 'Zavřít bez uložení',
      onExtra: leave,
      onConfirm: () => this.saveMap().then(() => {
        if (!this.mapDirty) leave();
      }),
    });
    return true;
  }

  close() {
    this.mode.cancelDraft();
    this.mode.cancelHeightDraft();
    this.mode.clearAreaSelection();
    this.mode.setWaterShown(true);
    this.heightPanel.setCount(0);
    this.heightPanel.hide();
    this.floorPanel.hide();
    this.mode.active = false;
    this.syncFloorView();
    this.hud.setCursorValue(null);
    this.heightLabels.clear();
    this.heightHologram.clear();
    this.brushPanel.close();
    this.areaPanel.hide();
    this.mode.setBrush(null);
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearCreatureRadius();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearArrows();
    this.dropRiverStroke();
    this.s.gridSystem.clearDraftCells();
    this.s.gridSystem.clearDraftOutline();
    this.s.refreshWaterVisibility();
    this.togglePanel(false);
    this.s.releaseGameFromEditor();
    this.s.syncZoomLimit();
    this.s.handleHover(this.s.hoverCell);
  }

  handleKey(evt, typing) {
    if (evt.key === 'F2') {
      evt.preventDefault();
      this.s.toggleEditorMode();
      return;
    }
    if ((evt.ctrlKey || evt.metaKey) && evt.code === 'KeyS') {
      evt.preventDefault();
      this.saveMap();
      return;
    }
    if (typing && evt.key !== 'Escape') return;
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (evt.key === 'p' || evt.key === 'P') {
      evt.preventDefault();
      this.s.togglePause();
      return;
    }
    if (evt.key === 'Escape') {
      if (this.mode.selectsArea && this.mode.hasAreaSelection) {
        this.clearAreaSelection();
        evt.preventDefault();
        return;
      }
      if (this.mode.hasDraft) {
        this.cancelBrushDraft();
        evt.preventDefault();
      }
      return;
    }
    if (evt.key === 'Enter') {
      if (this.mode.selectsArea && this.mode.hasAreaSelection) {
        this.applyAreaSelection();
        evt.preventDefault();
        return;
      }
      if (this.mode.hasDraft) {
        this.applyBrushDraft();
        evt.preventDefault();
      }
      return;
    }
    if (evt.shiftKey && TAB_KEYS[evt.code]) {
      this.mode.setMode(TAB_KEYS[evt.code]);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'x' || evt.key === 'X') {
      this.setEraseMode(!this.erasing);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'z' || evt.key === 'Z') {
      this.undo();
      evt.preventDefault();
      return;
    }
    if (evt.key === 'h' || evt.key === 'H') {
      this.mode.setMode(this.mapMode === 'height' ? 'zone' : 'height');
      evt.preventDefault();
      return;
    }
    if (evt.key === 'q' || evt.key === 'Q') {
      if (this.mode.undergroundFloor) this.stepFloorHeight(-1);
      else this.mode.stepHeightLevel(-1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'e' || evt.key === 'E') {
      if (this.mode.undergroundFloor) this.stepFloorHeight(1);
      else this.mode.stepHeightLevel(1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'r' || evt.key === 'R') {
      if (this.mode.rotateDeco(evt.shiftKey ? -1 : 1)) {
        this.refreshBrushOptions();
        this.s.handleHover(this.s.hoverCell);
        evt.preventDefault();
        return;
      }
    }
    if (/^[1-9]$/.test(evt.key)) {
      this.mode.setHeightLevel(HEIGHT_PRESETS[Number(evt.key) - 1]);
      evt.preventDefault();
      return;
    }
    evt.preventDefault();
  }

  togglePanel(active) {
    if (!active && this.mapDirty) this.warnUnsaved();
    this.s.adoptEditorMap();
    if (active) {
      this.hud.show();
      this.hud.setMode(this.mode.mode);
    } else {
      this.hud.hide();
      this.s.gridSystem.clearBrush();
      this.brushPanel.close();
      this.areaPanel.hide();
      this.heightPanel.hide();
      this.floorPanel.hide();
      this.mode.setBrush(null);
    }
    this.syncPanels(this.mode.mode);
    this.s.editorToggle.setActive(Boolean(active));
    if (active) this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.refreshCreatureMarks();
  }

  syncPanels(mode) {
    this.syncFloorView();
    if (!this.mode.active) {
      this.areaPanel.hide();
      this.heightPanel.hide();
      this.floorPanel.hide();
      return;
    }
    if (mode === 'floors') {
      this.brushPanel.close();
      this.areaPanel.hide();
      this.heightPanel.hide();
      this.mode.cancelDraft();
      this.floorPanel.show(this.floorPanelView());
      return;
    }
    this.floorPanel.hide();
    if (mode === 'area') {
      this.brushPanel.close();
      this.heightPanel.hide();
      this.mode.cancelDraft();
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
        brushSize: this.mode.heightBrushSize,
        stepSign: this.mode.heightStepSign,
        jitter: this.mode.heightJitter,
        fromNeighbors: this.mode.heightFromNeighbors,
      });
      return;
    }
    this.heightPanel.hide();
    if (this.mode.brushKey && !this.mode.hasDraft) this.openBrushPanel(this.mode.brushKey);
  }

  stagedList() {
    return this.mode.heightDraftGroups().map((group) => ({
      level: group.level,
      count: group.cells.length,
    }));
  }

  showFloorEdges(selection) {
    const preview = this.mode.floorEdgePreview(selection);
    this.floorEdgeCounts = { door: preview.door.length, thin: preview.thin.length, pierced: preview.pierced.length };
    const edges = [
      ...preview.door.map((edge) => ({ ...edge, color: FLOOR_MARKS.door })),
      ...preview.thin.map((edge) => ({ ...edge, color: FLOOR_MARKS.thin })),
    ];
    for (const cell of preview.pierced) {
      for (const [dx, dz] of SIDES) edges.push({ ...cell, dx, dz, color: FLOOR_MARKS.problem });
    }
    this.s.gridSystem.showEdges(edges);
  }

  showAreaPreview(selection) {
    this.showFloorEdges(this.mode.active && this.mode.mode === 'floors' ? selection : null);
    if (this.mode.active && this.mode.mode === 'floors') {
      const cells = selection ? selection.cells : [];
      if (cells.length) this.s.gridSystem.showBrush(cells, (cx, cz) => this.s.cellSurfaceAt(cx, cz), selection.tool === 'erase');
      else this.s.gridSystem.clearBrush();
      this.refreshFloorPanel();
      return;
    }
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
    this.s.gridSystem.showBrush(cells, (cx, cz) => this.s.cellSurfaceAt(cx, cz), erasing);
    const count = this.mode.pendingAreaCells();
    this.areaPanel.setCount(count, this.mode.pendingAreaExisting());
    if (selection.drag) {
      this.hud.setReadout(`plocha: ${cells.length} buněk označeno — pusť myš a klikni Aplikovat`);
    }
  }

  applyAreaSelection() {
    const selection = this.mode.getAreaSelection();
    if (!selection || !selection.cells.length) return false;
    if (this.mode.mode === 'floors') {
      const dug = this.mode.applyFloorSelection();
      const erasing = selection.tool === 'erase';
      this.s.gridSystem.clearBrush();
      this.refreshUndoButton();
      this.hud.setReadout(dug ? `${erasing ? 'Zasypáno' : 'Vykopáno'} ${dug} buněk` : 'Nic k zasypání — v tomhle patře tu nic není');
      this.s.handleHover(this.s.hoverCell);
      return true;
    }
    const erasing = selection.tool === 'erase';
    const pending = this.mode.pendingAreaCells();
    const existing = this.mode.pendingAreaExisting();
    const summary = this.areaPanel.summary();
    this.mode.applyAreaSelection();
    this.s.gridSystem.clearBrush();
    this.areaPanel.setCount(0, 0);
    this.refreshUndoButton();
    this.refreshCreatureMarks();
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
    if (this.mode.isEraserBrush) return;
    this.mode.setDraftMode(on ? 'remove' : 'add');
    this.hud.setErasing(this.mode.erasing);
    this.hud.refresh();
    this.brushPanel.setDraftMode(this.mode.draftMode);
    this.hud.setReadout(on ? 'Mazat: zvýrazněná pole jdou smazat — přejeď je myší' : 'Mazání vypnuto');
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.refreshCreatureMarks();
    this.s.handleHover(this.s.hoverCell);
  }

  refreshBrushOptions() {
    if (!this.brushPanel.isOpen) return;
    this.brushPanel.setOptions(this.mode.brushOptionValues(this.mode.brushKey));
  }

  announceBrushFloor() {
    const brush = BRUSHES[this.mode.brushKey];
    if (this.mode.paintLevel < 0 && !(brush && (brush.deco || brush.creature))) this.hud.setReadout('V podzemí jdou tímhle panelem kreslit jen předměty a tvorové');
  }

  openBrushPanel(brushKey) {
    this.dropRiverStroke();
    this.mode.beginDraft(brushKey);
    this.brushPanel.open(brushKey, 0, this.mode.pathStyle, this.mode.brushOptionValues(brushKey), this.mode.tileKey);
    this.brushPanel.setDraftMode(this.mode.draftMode);
    this.announceBrushFloor();
    if (this.mode.isJoinBrush) this.hud.setReadout('Spojnice: klikni na vrchol, pak na spodek');
    else if (this.mode.isBridgeBrush) this.hud.setReadout('Most: klikni na první břeh, pak na protější');
    else if (this.mode.isSpawnBrush) this.hud.setReadout('Start hráče: klikni na buňku, kam má hráč začínat');
    else if (this.mode.isLakeBrush) this.hud.setReadout('Jezero: klikni do prohlubně · klik na jezero zvedne hladinu, pravé tlačítko ji sníží');
    else if (this.mode.isRiverBrush) this.hud.setReadout('Řeka: táhni myší od pramene k ústí a potvrď Aplikovat · pravé tlačítko řeku smaže');
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.refreshCreatureMarks();
    this.s.handleHover(this.s.hoverCell);
  }

  paintCell(cx, cz) {
    return this.mode.paint(cx, cz);
  }

  describeCell(cx, cz) {
    return this.mode.describeAt(cx, cz);
  }

  clearHoverReadout() {
    this.hud.setCursorValue(null);
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearCreatureRadius();
    this.hud.setReadout('–');
    this.s.tooltipPanel.hide();
  }

  syncCreatureRadius(cell) {
    const grid = this.s.gridSystem;
    if (!grid) return;
    if (!this.mode.active || !cell) {
      grid.clearCreatureRadius();
      return;
    }
    const preview = this.mode.creaturePreviewAt(cell.cx, cell.cz);
    if (!preview) {
      grid.clearCreatureRadius();
      return;
    }
    grid.showCreatureRadius(cell.cx, cell.cz, preview.radius, (cx, cz) => this.s.cellSurfaceAt(cx, cz), preview.radiusKind);
  }

  refreshCreatureMarks() {
    const overlay = this.creatureOverlay;
    if (!overlay) return;
    const brush = this.mode.brushKey;
    const active = this.mode.active && this.mode.mode === 'zone';
    const nests = active && brush && (this.mode.isCreatureBrush || this.mode.isNestBrush);
    const nestMarks = nests ? this.mode.nestMarks() : [];
    for (const nest of nestMarks) {
      nest.guards = nest.guards.map((guard) => {
        const state = this.s.creatureStatusAt ? this.s.creatureStatusAt(guard.cx, guard.cz, guard.kind, guard.tierKey, 0) : null;
        return state && state.alive ? { ...guard, x: state.x, z: state.z, alive: true } : guard;
      });
    }
    overlay.showNests(nestMarks, (cx, cz) => this.s.cellSurfaceAt(cx, cz));
    if (!active || !this.mode.isCreatureBrush || !brush) {
      overlay.show([], (cx, cz) => this.s.cellSurfaceAt(cx, cz));
      return;
    }
    const marks = this.mode.creatureMarks().map((mark) => {
      const state = this.s.creatureStatusAt
        ? this.s.creatureStatusAt(mark.cx, mark.cz, mark.kind, mark.tierKey, mark.level)
        : null;
      if (!state) return { ...mark, state: 'new' };
      if (state.alive) return { ...mark, state: 'alive', x: state.x, z: state.z };
      if (!state.waiting) return { ...mark, state: 'new' };
      return { ...mark, state: 'waiting', remainingDays: state.remainingDays };
    });
    overlay.show(marks, (cx, cz) => this.s.cellSurfaceAt(cx, cz));
  }

  showAreaHoverReadout(cell) {
    this.hud.setCursorValue(null);
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
    const beast = info.creature;
    if (beast) parts.push(beast.tier ? `${beast.type.label} (${beast.tier.label})` : beast.type.label);
    const water = this.s.waterBodyAtCell(cell.cx, cell.cz);
    if (water) parts.push(`${water.kind === 'river' ? 'Řeka' : 'Jezero'} ${formatMeters(water.level)}`);
    const lift = Math.round((Number(info.liftY) || 0) * 100) / 100;
    this.hud.setCursorValue(this.mode.mode === 'height' ? formatMeters(lift) : null);
    const staged = this.mode.mode === 'height' ? this.mode.heightLevelAt(cell.cx, cell.cz) : null;
    const goal = this.mode.mode === 'height' ? this.mode.heightLevel : null;
    const joined = this.mode.joinMetersAt(cell.cx, cell.cz);
    let target = '';
    if (staged !== null) target = ` → ${formatLevel(staged)}`;
    else if (goal !== null) target = ` → ${formatLevel(goal)}`;
    else if (joined !== null) target = ` → ${formatMeters(joined)}`;
    let draft = '';
    if (this.mode.draft) {
      const count = this.mode.clusterCountAt(this.mode.draft.brushKey);
      const amount = count.max > 1 ? (count.min === count.max ? ` ×${count.min}` : ` ×${count.min}–${count.max}`) : '';
      draft = ` · kreslím: ${brushLabel(this.mode.draft.brushKey)}${amount}`;
    }
    const range = beast ? this.mode.creatureRangeInfo(beast.type, beast.tier) : null;
    const roam = !range || range.radius <= 0
      ? ''
      : range.radiusKind === 'notice'
        ? ` · všimne si do ${formatMeters(range.radius)}`
        : ` · toulá se do ${formatMeters(range.radius)}`;
    const runtime = beast && this.s.creatureStatusAt
      ? this.s.creatureStatusAt(cell.cx, cell.cz, beast.entry.kind, beast.tierKey)
      : null;
    const status = runtime
      ? (runtime.alive ? ' · živý' : runtime.waiting ? ` · mrtvý, ${respawnLabel(runtime.remainingDays)}` : '')
      : '';
    const title = parts.length ? parts.join(' · ') : 'Prázdno';
    this.s.tooltipPanel.show(title, `${cell.cx}, ${cell.cz} · výška ${formatMeters(lift)}${target}${draft}${roam}${status}`);
  }

  startPaint(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'floors') {
      if (this.mode.undergroundFloor) this.mode.beginFloorDrag(cell.cx, cell.cz);
      else this.startCave(cell);
    } else if (this.mode.mode === 'area') this.mode.beginAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') {
      this.mode.beginHeightStroke();
      this.mode.paint(cell.cx, cell.cz);
    } else if (!this.mode.hasBrush) this.hud.setReadout(NO_BRUSH_HINT);
    else if (this.mode.isJoinBrush) this.pickJoinCell(cell);
    else if (this.mode.isBridgeBrush && this.mode.draftMode !== 'remove') this.pickBridgeCell(cell);
    else if (this.mode.isLakeBrush) this.pickLake(cell, this.mode.draftMode === 'remove' ? 'remove' : 'add');
    else if (this.mode.isRiverBrush) this.startRiver(cell);
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

  pickBridgeCell(cell) {
    const state = this.mode.pickBridgeCell(cell.cx, cell.cz);
    if (state === 'invalid') {
      this.hud.setReadout('Most: klikni na buňku, která v mapě existuje');
      return;
    }
    if (state === 'top') {
      this.hud.setReadout('Břeh označen — klikni na protější břeh');
      return;
    }
    if (state === 'bad') {
      this.hud.setReadout('Most nejde postavit — břehy musí ležet proti sobě a mezi nimi musí být propast');
      return;
    }
    const info = this.mode.bridgeInfo;
    if (!info) return;
    this.hud.setReadout(`Most: ${info.span + 1} buněk · převýšení ${formatMeters(info.drop)}`);
  }

  movePaint(cell) {
    const from = this.lastPaintCell || cell;
    if (this.mode.mode === 'floors') this.mode.moveFloorDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'area') this.mode.moveAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') this.mode.paintRun(from, cell);
    else if (this.mode.isRiverBrush) this.extendRiver(cell);
    else if (!this.mode.isJoinBrush && !this.mode.isLakeBrush && (!this.mode.isBridgeBrush || this.mode.draftMode === 'remove')) this.mode.moveDraftDrag(cell.cx, cell.cz);
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
  }

  endPaint() {
    if (this.riverDrawing) this.endRiverStroke();
    this.lastPaintCell = null;
  }

  rightClickCell(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'zone' && this.mode.isJoinBrush) {
      this.mode.cancelJoin();
      this.hud.setReadout('Spojnice zrušena — klikni znovu na vrchol');
      return;
    }
    if (this.mode.mode === 'zone' && this.mode.isBridgeBrush) {
      this.mode.cancelBridge();
      this.hud.setReadout('Most zrušen — klikni znovu na břeh');
      return;
    }
    if (this.mode.mode === 'zone' && this.mode.isLakeBrush) {
      this.pickLake(cell, 'lower');
      return;
    }
    if (this.mode.mode === 'zone' && this.mode.isRiverBrush) {
      this.removeRiverAt(cell);
      return;
    }
    if (this.mode.selectsArea) {
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
    if (this.mode.isRiverBrush) {
      this.applyRiver();
      return;
    }
    const removing = this.mode.draftMode === 'remove';
    const heightBrush = this.mode.isHeightBrush;
    const surfaceBrush = this.mode.isSurfaceBrush;
    const cliffBrush = this.mode.isCliffBrush;
    const bridgeBrush = this.mode.isBridgeBrush;
    const joinBrush = this.mode.isJoinBrush;
    const creatureBrush = this.mode.isCreatureBrush;
    const count = this.mode.applyDraft();
    if (count && bridgeBrush) {
      this.hud.setReadout(removing ? `Most odstraněn: ${count}` : 'Most postaven');
    } else if (count && cliffBrush) {
      this.hud.setReadout(removing
        ? `Útes zrušen u ${count} buněk`
        : `Označeno jako útes: ${count} buněk`);
    } else if (count && joinBrush) {
      this.hud.setReadout(removing ? `Spojnice srovnána: ${count} buněk` : `Spojnice hotová: ${count} buněk`);
    } else if (count && creatureBrush) {
      const word = count === 1 ? 'tvor' : count < 5 ? 'tvoři' : 'tvorů';
      this.hud.setReadout(`${removing ? 'Odebráno' : 'Položeno'}: ${count} ${word}`);
    } else if (count && this.mode.isSpawnBrush) {
      const spawn = this.mode.spawnCell();
      this.hud.setReadout(spawn
        ? `Start hráče přesunut na ${spawn.cx}, ${spawn.cz} — projeví se při startu hry`
        : 'Start hráče nastaven');
    } else if (count && this.mode.isEraserBrush) {
      this.hud.setReadout(`Smazáno ${count} buněk`);
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
    } else if (this.mode.isSpawnBrush) {
      this.hud.setReadout('Start hráče už je na téhle buňce');
    } else if (this.mode.isEraserBrush) {
      this.hud.setReadout('Nic k smazání — guma nenašla, co by vzala');
    } else this.hud.setReadout(removing ? 'Nic ke smazání' : 'Prázdná zóna');
    this.brushPanel.setDraftMode(this.mode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.refreshCreatureMarks();
    this.s.handleHover(this.s.hoverCell);
  }

  cancelBrushDraft() {
    this.dropRiverStroke();
    this.mode.setBrush(null);
    this.brushPanel.close();
    this.refreshZoneOverlay();
    this.refreshCreatureMarks();
    this.s.handleHover(this.s.hoverCell);
  }

  undo() {
    this.dropRiverStroke();
    const undone = this.mode.undo();
    this.refreshRiverArrows();
    if (!undone) {
      this.refreshUndoButton();
      this.refreshCreatureMarks();
      this.s.handleHover(this.s.hoverCell);
      return false;
    }
    this.ensureDraft();
    this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.refreshUndoButton();
    this.areaPanel.setCount(this.mode.pendingAreaCells(), this.mode.pendingAreaExisting());
    this.refreshCreatureMarks();
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
    if (this.mode.mode === 'floors') this.refreshFloorPanel();
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
    this.refreshRiverArrows();
    if (!this.mode.active || !this.s.mapLayout) {
      this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      this.s.gridSystem.clearDraftOutline();
      this.heightLabels.clear();
      this.heightHologram.clear();
      return;
    }
    if (this.mode.mode === 'floors') {
      this.s.gridSystem.clearDraftCells();
      this.s.gridSystem.clearDraftOutline();
      this.heightLabels.clear();
      this.heightHologram.clear();
      this.showFloorMarks();
      return;
    }
    if (this.mode.mode === 'height' && this.mode.heightDraftCount) {
      this.showHeightDraftOverlay();
      return;
    }
    this.heightLabels.clear();
    this.heightHologram.clear();
    const spawnZone = this.spawnZone();
    if (!this.mode.hasDraft) {
      if (spawnZone) this.s.gridSystem.showZones([spawnZone], (cx, cz) => this.s.cellSurfaceAt(cx, cz));
      else this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      this.s.gridSystem.clearDraftOutline();
      return;
    }
    this.s.gridSystem.clearDraftOutline();
    const draft = this.mode.draft;
    const removing = draft.mode === 'remove' || Boolean(this.mode.eraseKind);
    const surfaceAt = (cx, cz) => this.s.cellSurfaceAt(cx, cz);
    const shape = this.mode.heightDraftShape(draft);

    const draftCells = [];
    for (const key of draft.cells) {
      const [cx, cz] = key.split(',').map(Number);
      draftCells.push([cx, cz]);
    }

    const groups = [
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
    ];
    this.s.gridSystem.showZones(spawnZone ? [spawnZone, ...groups] : groups, surfaceAt);

    this.s.gridSystem.showDraftCells(draftCells, surfaceAt, draft.mode);
  }

  spawnZone() {
    if (!this.mode.active || this.mode.mode !== 'zone' || !this.mode.isSpawnBrush) return null;
    const spawn = this.mode.spawnCell();
    if (!spawn) return null;
    return {
      cells: [[spawn.cx, spawn.cz]],
      color: new Color3(0.95, 0.9, 0.45),
      glow: new Color3(0.85, 0.75, 0.25),
      alpha: 0.5,
      lift: 0.05,
    };
  }

  showHeightDraftOverlay() {
    const groups = this.mode.heightDraftGroups();
    const surfaceAt = (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz);
    if (!groups.length) {
      this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      this.s.gridSystem.clearDraftOutline();
      this.heightLabels.clear();
      this.heightHologram.clear();
      return;
    }
    const cells = [];
    const labels = [];
    const volumes = [];
    for (const group of groups) {
      const target = group.level * HEIGHT_STEP;
      for (const cell of group.cells) {
        const [cx, cz] = cell;
        cells.push(cell);
        const ground = surfaceAt(cx, cz);
        const y = Number.isFinite(ground) ? ground : 0;
        const diff = target - y;
        const dir = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat';
        const text = dir === 'flat' ? formatMeters(target) : `${dir === 'up' ? '↑' : '↓'} ${formatMeters(target)} (z ${formatMeters(y)})`;
        labels.push({ x: cx * CELL_SIZE, y: Math.max(y, target) + HEIGHT_LABEL_LIFT, z: cz * CELL_SIZE, dir, text });
        volumes.push({ cx, cz, from: y, to: target });
      }
    }
    this.heightHologram.show(volumes);
    const stride = labels.length > HEIGHT_LABEL_LIMIT ? Math.ceil(labels.length / HEIGHT_LABEL_LIMIT) : 1;
    this.heightLabels.show(stride === 1 ? labels : labels.filter((item, index) => index % stride === 0));
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.s.gridSystem.showDraftOutline(cells, surfaceAt);
  }

  followCreatureMarks(dt) {
    if (!this.mode.active || !(this.mode.isCreatureBrush || this.mode.isNestBrush)) return;
    this.marksClock += dt;
    if (this.marksClock < MARKS_FOLLOW_SECONDS) return;
    this.marksClock = 0;
    this.refreshCreatureMarks();
  }

  updateHeightLabels() {
    if (!this.heightLabels.items.length) return;
    this.heightLabels.update((x, y, z) => this.s.screenPointOf(x, y, z));
  }

  applyHeightSelection() {
    const count = this.mode.applyHeightSelection();
    if (count) this.hud.setReadout(`Aplikováno ${count} buněk — výšky se přepočítají`);
    else this.hud.setReadout('Prázdný návrh výšek');
    this.heightPanel.setCount(this.mode.heightDraftCount);
    this.heightPanel.setStaged(this.stagedList());
    this.refreshUndoButton();
    this.refreshZoneOverlay();
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
    this.hud.setReadout('Mapa ještě není zapsaná v souboru — po obnovení stránky se změny ztratí');
  }

  markDirty() {
    const saved = this.savedFingerprint;
    if (saved !== null && this.mode.fingerprint() === saved) {
      if (!this.mapDirty) return;
      this.mapDirty = false;
      this.hud.setReadout('Mapa je zpátky v uloženém stavu');
      return;
    }
    if (this.mapDirty) return;
    this.mapDirty = true;
    this.hud.setReadout('● Neuložené změny');
  }

  clearDirty() {
    this.mapDirty = false;
    this.savedFingerprint = this.mode.fingerprint();
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
      this.hud.setReadout(`Mapa se neuložila — ${broken} buněk nemá platné souřadnice, takže by se v souboru rozsypala`);
      return Promise.resolve(false);
    }
    this.hud.setReadout('Ukládám do souboru…');
    return this.writeMapFile(file).then((result) => this.finishSave(file, result));
  }

  finishSave(file, result) {
    this.s.mapFile = file;
    if (result.ok) {
      this.clearDirty();
      this.hud.setReadout('Mapa zapsaná do souboru projektu ✓');
      return true;
    }
    this.downloadMapFile(file);
    this.markDirty();
    this.hud.setReadout(`Mapu se nepodařilo zapsat do souboru (${result.reason}) — soubor je stažený, polož ho do projektu`);
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

function respawnLabel(days) {
  if (!Number.isFinite(days)) return 'čeká na obnovu';
  const whole = Math.max(0, Math.ceil(days));
  if (whole <= 0) return 'obnoví se každou chvíli';
  if (whole === 1) return 'obnoví se za 1 den';
  if (whole <= 4) return `obnoví se za ${whole} dny`;
  return `obnoví se za ${whole} dní`;
}

function brokenEntries(layout) {
  let count = 0;
  for (const name of ENTRY_LAYERS) {
    for (const entry of layout[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) count += 1;
    }
  }
  return count;
}

Object.assign(MapEditor.prototype, editorLakesParts, editorRiversParts);
