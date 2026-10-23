// Řízení editoru mapy — spojuje práci s mapou (EditorMode) s panely a scénou.
// Drží otevření editoru, štětec, plochu, neuložené změny a ukládání mapy do souboru.
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { mapFileFromLayout } from '../data/catalogs/mapFile.js';
import EditorMode from './editorMode.js';
import EditorHud from './editorHud.js';
import BrushPanel from './brushPanel.js';
import AreaPanel from './areaPanel.js';

const NO_BRUSH_HINT = 'Vyber štětec v paletě — teprve pak jde do mapy kreslit';

export default class MapEditor {

  constructor(scene) {
    this.s = scene;
    this.mode = new EditorMode();
    this.hud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.areaPanel = new AreaPanel();
    this.mapDirty = false;
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
    this.mode.onStyleChange = (brushKey, styleKey) => this.brushPanel.setStyle(styleKey);
    this.mode.onHeightChange = (level) => this.hud.setHeightLevel(level);
    this.mode.onDraftChange = (draft) => this.updateDraftView(draft);
    this.mode.onBrushChange = (key) => {
      this.hud.setBrush(key);
      this.openBrushPanel(key);
    };

    this.hud.onBrush = (key) => this.mode.setBrush(key);
    this.hud.onMode = (mode) => this.mode.setMode(mode);
    this.hud.onHeightLevel = (level) => this.mode.setHeightLevel(level);
    this.hud.onHeightStep = (delta) => this.mode.stepHeightLevel(delta);
    this.hud.onSmooth = () => this.mode.smoothHeights();
    this.hud.onClose = () => this.close();
    this.hud.onSaveMap = () => this.saveMap();

    this.brushPanel.onApply = () => this.applyBrushDraft();
    this.brushPanel.onCancel = () => this.cancelBrushDraft();
    this.brushPanel.onStyle = (brushKey, styleKey) => this.mode.setStyle(styleKey);
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
  }

  open() {
    const active = this.mode.toggle();
    if (active) {
      this.resetSelection();
      this.hud.show();
      this.hud.clearBrushSelection();
      this.hud.setReadout(NO_BRUSH_HINT);
      this.s.holdGameForEditor();
    } else {
      this.s.releaseGameFromEditor();
    }
    return active;
  }

  resetSelection() {
    this.mode.cancelDraft();
    this.mode.clearAreaSelection();
    this.brushPanel.close();
    this.areaPanel.hide();
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.centerPanels();
  }

  centerPanels() {
    for (const panel of [this.hud.root, this.brushPanel.root, this.areaPanel.root]) {
      if (!panel) continue;
      panel.style.left = '';
      panel.style.top = '';
    }
  }

  close() {
    this.mode.cancelDraft();
    this.mode.clearAreaSelection();
    this.mode.active = false;
    this.brushPanel.close();
    this.areaPanel.hide();
    this.hud.clearBrushSelection();
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearZones();
    this.s.gridSystem.clearDraftCells();
    this.togglePanel(false);
    this.s.releaseGameFromEditor();
  }

  togglePanel(active) {
    if (!active && this.mapDirty) this.warnUnsaved();
    this.s.adoptEditorMap();
    this.s.terrainSystem.clear();
    if (active) {
      this.hud.show();
      this.hud.setMode(this.mode.mode);
      this.hud.setHeightLevel(this.mode.heightLevel);
    } else {
      this.hud.hide();
      this.s.gridSystem.clearBrush();
      this.brushPanel.close();
      this.areaPanel.hide();
    }
    this.s.refreshTerrain();
    this.syncPanels(this.mode.mode);
    this.s.editorToggle.setActive(Boolean(active));
  }

  syncPanels(mode) {
    if (!this.mode.active) {
      this.areaPanel.hide();
      return;
    }
    if (mode === 'area') {
      this.brushPanel.close();
      this.mode.cancelDraft();
      this.areaPanel.open(
        this.mode.areaTool,
        this.mode.pendingAreaCells(),
        this.mode.canUndo,
      );
      return;
    }
    this.areaPanel.hide();
  }

  showAreaPreview(selection) {
    if (this.mode.active && this.mode.mode !== 'area') {
      this.s.gridSystem.clearBrush();
      this.areaPanel.setCount(0);
      return;
    }
    const cells = selection ? selection.cells : null;
    if (!cells || !cells.length) {
      this.s.gridSystem.clearBrush();
      this.areaPanel.setCount(0);
      return;
    }
    const erasing = selection.tool === 'erase';
    this.areaPanel.setTool(selection.tool);
    this.s.gridSystem.showBrush(cells, (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz), erasing);
    const count = this.mode.pendingAreaCells();
    this.areaPanel.setCount(count);
    if (selection.drag) {
      this.hud.setReadout(`plocha: ${cells.length} buněk označeno — pusť myš a klikni Aplikovat`);
    }
  }

  applyAreaSelection() {
    const selection = this.mode.getAreaSelection();
    if (!selection || !selection.cells.length) return false;
    const erasing = selection.tool === 'erase';
    const pending = this.mode.pendingAreaCells();
    this.mode.applyAreaSelection();
    this.s.gridSystem.clearBrush();
    this.areaPanel.setCount(0);
    this.refreshUndoButton();
    this.s.handleHover(this.s.hoverCell);
    if (!erasing) this.hud.setReadout(`Přidáno ${pending} buněk plochy`);
    else if (!pending) this.hud.setReadout('Nic k smazání — tyhle buňky v mapě nejsou');
    else this.hud.setReadout(`Smazáno ${pending} buněk i s objekty`);
    return true;
  }

  clearAreaSelection() {
    if (!this.mode.hasAreaSelection) return false;
    this.mode.clearAreaSelection();
    this.s.gridSystem.clearBrush();
    this.areaPanel.setCount(0);
    this.hud.setReadout('Výběr plochy zahozen');
    return true;
  }

  setEraseMode(on) {
    this.mode.setDraftMode(on ? 'remove' : 'add');
    this.hud.erasing = this.mode.erasing;
    this.hud.refresh();
    this.brushPanel.setDraftMode(this.mode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.s.handleHover(this.s.hoverCell);
  }

  openBrushPanel(brushKey) {
    this.mode.beginDraft(brushKey);
    this.brushPanel.open(brushKey, 0, this.mode.pathStyle);
    this.brushPanel.setDraftMode(this.mode.draftMode);
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
    this.hud.setReadout('–');
  }

  showAreaHoverReadout(cell) {
    const info = this.mode.describeAt(cell.cx, cell.cz);
    const state = this.mode.areaTool === 'erase' ? 'mažu' : 'maluju';
    const zone = info.brush ? `zóna: ${info.brush}` : 'bez zóny';
    this.hud.setReadout(`${cell.cx}, ${cell.cz} — ${state} plochu · ${zone}`);
  }

  showCellHoverReadout(cell) {
    if (this.mode.hasDraft && this.mode.mode !== 'height') {
      this.s.gridSystem.clearBrush();
    } else {
      const surfaceAt = (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz);
      this.s.gridSystem.showBrush([[cell.cx, cell.cz]], surfaceAt, this.mode.erasing);
    }
    const info = this.mode.describeAt(cell.cx, cell.cz);
    const tile = describeEntry(info);
    const height = ` · výška ${info.height === null ? '0 m' : info.height + ' m'}`;
    const draft = this.mode.draft ? ` · kreslím: ${this.mode.draft.brushKey}` : '';
    this.hud.setReadout(`${cell.cx}, ${cell.cz} — ${tile}${height}${draft}`);
  }

  startPaint(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'area') this.mode.beginAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') this.mode.paint(cell.cx, cell.cz);
    else if (!this.mode.hasBrush) this.hud.setReadout(NO_BRUSH_HINT);
    else if (!this.mode.canDraftCell(cell.cx, cell.cz)) this.hud.setReadout('Mimo hrací plochu — přepni na Plochu');
    else this.mode.draftCell(cell.cx, cell.cz);
  }

  movePaint(cell) {
    const from = this.lastPaintCell || cell;
    if (this.mode.mode === 'area') this.mode.moveAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') this.mode.paintRun(from, cell);
    else this.mode.draftRun(from, cell);
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
  }

  rightClickCell(cell) {
    if (this.mode.mode === 'area') {
      const tool = this.mode.areaTool === 'erase' ? 'paint' : 'erase';
      this.mode.setAreaTool(tool);
      this.areaPanel.setTool(this.mode.areaTool);
      return;
    }
    if (this.mode.mode === 'height') {
      const wasErasing = this.mode.erasing;
      this.mode.erasing = true;
      this.mode.paint(cell.cx, cell.cz);
      this.mode.erasing = wasErasing;
      return;
    }
    if (!this.mode.canEditCell(cell.cx, cell.cz)) return;
    if (!this.mode.hasBrush) {
      this.hud.setReadout(NO_BRUSH_HINT);
      return;
    }
    this.mode.draftCell(cell.cx, cell.cz);
  }

  applyBrushDraft() {
    const removing = this.mode.draftMode === 'remove';
    const count = this.mode.applyDraft();
    if (count) this.hud.setReadout((removing ? 'Smazáno ' : 'Aplikováno ') + count + ' buněk');
    else this.hud.setReadout(removing ? 'Nic ke smazání' : 'Prázdná zóna');
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
    this.refreshUndoButton();
    this.areaPanel.setCount(this.mode.pendingAreaCells());
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
  }

  updateDraftView(draft) {
    if (!draft) {
      this.brushPanel.setCount(0);
      this.refreshUndoButton();
      this.refreshZoneOverlay();
      return;
    }
    this.brushPanel.setDraftMode(draft.mode);
    this.brushPanel.setCount(draft.cells.size);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
  }

  refreshZoneOverlay() {
    if (!this.mode.active || !this.s.mapLayout || !this.mode.hasDraft) {
      this.s.gridSystem.clearZones();
      this.s.gridSystem.clearDraftCells();
      return;
    }
    const draft = this.mode.draft;
    const removing = draft.mode === 'remove';
    const surfaceAt = (cx, cz) => this.s.decoSystem.surfaceAt(cx, cz);
    const same = [];
    const other = [];

    const draftCells = [];
    for (const key of draft.cells) {
      const [cx, cz] = key.split(',').map(Number);
      draftCells.push([cx, cz]);
      if (removing) continue;
      if (this.mode.draftHasSame(cx, cz)) same.push([cx, cz]);
    }
    if (!removing) {
      for (const [cx, cz] of this.s.terrainSystem.realCells || []) {
        if (!this.mode.draftHasContent(cx, cz)) continue;
        if (this.mode.draftHasSame(cx, cz)) same.push([cx, cz]);
        else other.push([cx, cz]);
      }
    }

    this.s.gridSystem.showZones([
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
    ], surfaceAt);

    this.s.gridSystem.showDraftCells(draftCells, surfaceAt, draft.mode);
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

function describeEntry(info) {
  if (!info.entry) return 'prázdno';
  if (info.isPath) return `cesta (${info.style})`;
  return info.entry.key;
}

function brokenEntries(layout) {
  let count = 0;
  for (const name of ['floor', 'path', 'water', 'clearing', 'decorations']) {
    for (const entry of layout[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) count += 1;
    }
  }
  return count;
}
