// Řízení editoru mapy — spojuje práci s mapou (EditorMode) s panely a scénou.
// Drží otevření a zavření editoru, panely, štětec, plochu a Zpět; ostatní dělají části map*.js.
import EditorMode from './editorMode.js';
import EditorHud from './editorHud.js';
import BrushPanel from './brushPanel.js';
import AreaPanel from './areaPanel.js';
import HeightPanel from './heightPanel.js';
import FloorPanel from './floorPanel.js';
import CreatureOverlay from './creatureOverlay.js';
import HeightLabels from './heightLabels.js';
import HeightHologram from './heightHologram.js';
import { BRUSHES, brushShapesTerrain } from '../data/catalogs/brushes.js';
import { HUD_TABS, COMMON_BRUSHES, hudTab, tabBrushes, tabModes } from './hudTabs.js';
import { NO_BRUSH_HINT, cellCount, creatureWord } from './editorSettings.js';
import mapFloorsParts from './mapFloors.js';
import mapInputParts from './mapInput.js';
import mapOverlaysParts from './mapOverlays.js';
import mapReadoutsParts from './mapReadouts.js';
import mapSaveParts from './mapSave.js';
import mapWaterParts from './mapWater.js';
import mapLakesParts from './mapLakes.js';
import mapRiversParts from './mapRivers.js';

const SHAPING_MODES = ['height', 'area', 'floors'];

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
    this.lastPaintCell = null;
    this.riverStroke = null;
    this.riverDrawing = false;
    this.floorMarksReport = null;
    this.floorEdgeCounts = null;
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
    if (layout) this.mode.restoreLayout(layout);
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
      this.brushPanel.setStyle(styleKey, this.mode.tileKey);
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

    this.hud.onBrush = (key) => {
      if (this.mode.mode !== 'zone') this.mode.setMode('zone');
      this.mode.setBrush(key);
    };
    this.hud.onTab = (key) => this.selectTab(key);
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
    this.hud.onFloor = (level) => this.selectFloor(level);

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

    this.floorPanel.onSelect = (level) => this.selectFloor(level);
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
    this.floorPanel.onCaveTarget = (target) => {
      this.mode.setCaveTarget(target);
      this.refreshFloorPanel();
      this.s.handleHover(this.s.hoverCell);
    };
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
      this.hud.setReadout(`Strop zvednut u ${cellCount(count)}`);
    };

    this.hud.onWaterToggle = () => this.toggleWater();
    this.hud.onWaterStep = (delta) => this.stepWater(delta);
  }

  shapesTerrain() {
    if (!this.mode.active) return false;
    if (SHAPING_MODES.includes(this.mode.mode)) return true;
    return this.mode.mode === 'zone' && brushShapesTerrain(this.mode.brushKey);
  }

  selectTab(key) {
    const tab = hudTab(key);
    if (!tab) return;
    this.hud.setTab(tab.key);
    if (tab.mode) {
      if (this.mode.mode !== tab.mode) this.mode.setMode(tab.mode);
      return;
    }
    if (!tabModes(tab).includes(this.mode.mode)) this.mode.setMode('zone');
    const brush = this.mode.brushKey;
    if (brush && !tabBrushes(tab).includes(brush) && !COMMON_BRUSHES.includes(brush)) this.mode.setBrush(null);
  }

  selectTabAt(index) {
    const tab = HUD_TABS[index];
    if (tab) this.selectTab(tab.key);
  }

  toggle() {
    if (this.mode.active) return this.requestClose();
    this.mode.setDraftMode('add');
    this.hud.setErasing(false);
    this.clearWorkspace();
    this.centerPanels();
    this.mode.toggle();
    this.hud.setReadout(NO_BRUSH_HINT);
    this.s.holdGameForEditor();
    this.s.syncZoomLimit();
    return true;
  }

  clearWorkspace() {
    this.mode.cancelDraft();
    this.mode.cancelHeightDraft();
    this.mode.clearAreaSelection();
    this.mode.setBrush(null);
    this.dropRiverStroke();
    this.heightPanel.setCount(0);
    this.hidePanels();
    this.hud.setCursorValue(null);
    this.heightLabels.clear();
    this.heightHologram.clear();
    const grid = this.s.gridSystem;
    grid.clearBrush();
    grid.clearHoverCell();
    grid.clearCreatureRadius();
    grid.clearZones();
    grid.clearArrows();
    grid.clearDraftCells();
    grid.clearDraftOutline();
  }

  hidePanels() {
    this.brushPanel.close();
    this.areaPanel.hide();
    this.heightPanel.hide();
    this.floorPanel.hide();
  }

  centerPanels() {
    for (const panel of [this.hud.root, this.brushPanel.root, this.areaPanel.root, this.heightPanel.root, this.floorPanel.root]) {
      if (!panel) continue;
      for (const side of ['left', 'top', 'right', 'bottom', 'transform']) panel.style[side] = '';
    }
  }

  requestClose() {
    const leave = () => this.close();
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
    if (!this.mode.active) return;
    this.clearWorkspace();
    this.mode.setWaterShown(true);
    this.mode.toggle();
    this.s.refreshWaterVisibility();
    this.s.releaseGameFromEditor();
    this.s.syncZoomLimit();
    this.s.handleHover(this.s.hoverCell);
  }

  togglePanel(active) {
    this.s.adoptEditorMap();
    if (active) {
      this.hud.show();
      this.hud.setMode(this.mode.mode);
    } else {
      this.hud.hide();
      this.hidePanels();
    }
    this.syncPanels(this.mode.mode);
    this.s.editorToggle.setActive(Boolean(active));
    if (active) this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.refreshCreatureMarks();
  }

  syncPanels(mode) {
    this.syncFloorView();
    if (!this.mode.active) {
      this.hidePanels();
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
      this.hud.setReadout(`plocha: ${cellCount(cells.length)} označeno — pusť myš a klikni Aplikovat`);
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
      this.hud.setReadout(dug ? `${erasing ? 'Zasypáno' : 'Vykopáno'} ${cellCount(dug)}` : 'Nic k zasypání — v tomhle patře tu nic není');
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
      this.hud.setReadout(`${verb} ${cellCount(pending)} · ${summary}`);
    } else if (!pending) this.hud.setReadout('Nic k smazání — tyhle buňky v mapě nejsou');
    else this.hud.setReadout(`Smazáno ${cellCount(pending)} i s objekty`);
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
    if (this.mode.paintLevel < 0 && !(brush && (brush.deco || brush.creature || brush.creatureSettings))) this.hud.setReadout('V podzemí jdou tímhle panelem kreslit jen předměty a tvorové');
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
    const settingsBrush = this.mode.isCreatureSettingsBrush;
    const count = this.mode.applyDraft();
    if (count && settingsBrush) {
      this.hud.setReadout(`Nastavení změněno: ${count} ${creatureWord(count)}`);
    } else if (count && bridgeBrush) {
      this.hud.setReadout(removing ? `Most odstraněn: ${count}` : 'Most postaven');
    } else if (count && cliffBrush) {
      this.hud.setReadout(removing
        ? `Útes zrušen u ${cellCount(count)}`
        : `Označeno jako útes: ${cellCount(count)}`);
    } else if (count && joinBrush) {
      this.hud.setReadout(`Spojnice hotová: ${cellCount(count)}`);
    } else if (count && creatureBrush) {
      const word = creatureWord(count);
      this.hud.setReadout(`${removing ? 'Odebráno' : 'Položeno'}: ${count} ${word}`);
    } else if (count && this.mode.isSpawnBrush) {
      const spawn = this.mode.spawnCell();
      this.hud.setReadout(spawn
        ? `Start hráče přesunut na ${spawn.cx}, ${spawn.cz} — projeví se při startu hry`
        : 'Start hráče nastaven');
    } else if (count && this.mode.isEraserBrush) {
      this.hud.setReadout(`Smazáno ${cellCount(count)}`);
    } else if (count && surfaceBrush) {
      this.hud.setReadout(removing
        ? `Vráceno na trávu ${cellCount(count)}`
        : `Pláž hotová: ${cellCount(count)} i s břehem`);
    } else if (count) {
      const verb = heightBrush && removing ? 'Srovnáno ' : heightBrush ? 'Aplikováno ' : removing ? 'Smazáno ' : 'Aplikováno ';
      const suffix = heightBrush ? ' (i se svahem)' : '';
      this.hud.setReadout(verb + cellCount(count) + suffix);
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

  clearBrushDraft() {
    this.dropRiverStroke();
    this.mode.clearDraft();
    this.refreshRiverArrows();
    this.hud.setReadout('Návrh zahozen — další Esc odvybere štětec');
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
    this.syncFloorView();
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

  applyHeightSelection() {
    const count = this.mode.applyHeightSelection();
    if (count) this.hud.setReadout(`Aplikováno ${cellCount(count)} — výšky se přepočítají`);
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
}

Object.assign(MapEditor.prototype, mapFloorsParts, mapInputParts, mapOverlaysParts, mapReadoutsParts, mapSaveParts, mapWaterParts, mapLakesParts, mapRiversParts);
