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
import CreatureOverlay from './creatureOverlay.js';
import { formatLevel, formatMeters } from './heightRamp.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { BRUSHES } from '../data/catalogs/brushes.js';

const NO_BRUSH_HINT = 'Vyber štětec v paletě — teprve pak jde do mapy kreslit';

export default class MapEditor {

  constructor(scene) {
    this.s = scene;
    this.mode = new EditorMode();
    this.hud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.areaPanel = new AreaPanel();
    this.heightPanel = new HeightPanel();
    this.creatureOverlay = new CreatureOverlay(this.s.s);
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
    this.s.renderWater();
    this.s.handleHover(this.s.hoverCell);
    this.markDirty();
  }

  open() {
    if (this.mode.active) {
      this.close();
      return false;
    }
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
    this.mode.setWaterShown(true);
    this.heightPanel.setCount(0);
    this.heightPanel.hide();
    this.mode.active = false;
    this.brushPanel.close();
    this.areaPanel.hide();
    this.mode.setBrush(null);
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearCreatureRadius();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.s.gridSystem.clearDraftOutline();
    this.s.refreshWaterVisibility();
    this.togglePanel(false);
    this.s.releaseGameFromEditor();
    this.s.syncZoomLimit();
    this.s.handleHover(this.s.hoverCell);
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
      this.mode.setBrush(null);
    }
    this.syncPanels(this.mode.mode);
    this.s.editorToggle.setActive(Boolean(active));
    if (active) this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.refreshCreatureMarks();
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

  openBrushPanel(brushKey) {
    this.mode.beginDraft(brushKey);
    this.brushPanel.open(brushKey, 0, this.mode.pathStyle, this.mode.brushOptionValues(brushKey), this.mode.tileKey);
    this.brushPanel.setDraftMode(this.mode.draftMode);
    if (this.mode.isJoinBrush) this.hud.setReadout('Spojnice: klikni na vrchol, pak na spodek');
    else if (this.mode.isBridgeBrush) this.hud.setReadout('Most: klikni na první břeh, pak na protější');
    else if (this.mode.isSpawnBrush) this.hud.setReadout('Start hráče: klikni na buňku, kam má hráč začínat');
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
    grid.showCreatureRadius(cell.cx, cell.cz, preview.radius, (cx, cz) => this.s.cellSurfaceAt(cx, cz));
  }

  refreshCreatureMarks() {
    const overlay = this.creatureOverlay;
    if (!overlay) return;
    const brush = this.mode.brushKey;
    const active = this.mode.active && this.mode.mode === 'zone';
    if (!active || !this.mode.isCreatureBrush || !brush) {
      overlay.clear();
      return;
    }
    const marks = this.mode.creatureMarks().map((mark) => {
      const state = this.s.creatureStatusAt
        ? this.s.creatureStatusAt(mark.cx, mark.cz, mark.kind, mark.tierKey)
        : null;
      if (!state) return { ...mark, state: 'new' };
      if (state.alive) return { ...mark, state: 'alive', x: state.x, z: state.z };
      if (!state.waiting) return { ...mark, state: 'new' };
      return { ...mark, state: 'waiting', remainingDays: state.remainingDays };
    });
    overlay.show(marks, (cx, cz) => this.s.cellSurfaceAt(cx, cz));
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
    const beast = info.creature;
    if (beast) parts.push(beast.tier ? `${beast.type.label} (${beast.tier.label})` : beast.type.label);
    const lift = Math.round((Number(info.liftY) || 0) * 100) / 100;
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
    const roam = beast && Number.isFinite(beast.type.roamRadius)
      ? ` · toulá se do ${formatMeters(beast.type.roamRadius)} m`
      : '';
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
    if (this.mode.mode === 'area') this.mode.beginAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') {
      this.mode.beginHeightStroke();
      this.mode.paint(cell.cx, cell.cz);
    } else if (!this.mode.hasBrush) this.hud.setReadout(NO_BRUSH_HINT);
    else if (this.mode.isJoinBrush) this.pickJoinCell(cell);
    else if (this.mode.isBridgeBrush && this.mode.draftMode !== 'remove') this.pickBridgeCell(cell);
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
    if (this.mode.mode === 'area') this.mode.moveAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') this.mode.paintRun(from, cell);
    else if (!this.mode.isJoinBrush && (!this.mode.isBridgeBrush || this.mode.draftMode === 'remove')) this.mode.moveDraftDrag(cell.cx, cell.cz);
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
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
    this.mode.setBrush(null);
    this.brushPanel.close();
    this.refreshZoneOverlay();
    this.refreshCreatureMarks();
    this.s.handleHover(this.s.hoverCell);
  }

  undo() {
    if (!this.mode.undo()) {
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
      this.s.gridSystem.clearDraftOutline();
      return;
    }
    if (this.mode.mode === 'height' && this.mode.heightDraftCount) {
      this.showHeightDraftOverlay();
      return;
    }
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
      return;
    }
    const cells = [];
    for (const group of groups) {
      for (const cell of group.cells) cells.push(cell);
    }
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.s.gridSystem.showDraftOutline(cells, surfaceAt);
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
  for (const name of ['floor', 'path', 'clearing', 'grass', 'decorations', 'fish', 'creatures']) {
    for (const entry of layout[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) count += 1;
    }
  }
  return count;
}
