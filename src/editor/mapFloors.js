// Část řízení editoru: patra a jeskyně — výběr patra, začátek kopání u útesu, rám vchodu, značky a popisky.
// Patří k MapEditor (sdílí jeho this); do mapy zapisuje editorFloors.js.
import { formatMeters } from '../data/maps/layoutStore.js';
import { brushAboveGroundOnly } from '../data/catalogs/brushes.js';
import { NO_FLOOR_PICK_HEIGHT } from '../scenes/sceneSettings.js';
import { floorName } from './floorPanel.js';
import { nextDoorFrame } from './editorFloors.js';
import { CAVE_NAME_MAX } from '../data/maps/caveNames.js';
import { SIDES, MARK_COLORS } from './editorSettings.js';
import { ZONE } from './mapOverlays.js';

const FRAME_NAMES = { stone: 'kamenný', dirt: 'hliněný' };

function frameLabel(style, autoStyle) {
  if (!style) return `podle útesu (${FRAME_NAMES[autoStyle] || autoStyle})`;
  return FRAME_NAMES[style] || style;
}

export default {
  floorPlane(x, z, picking = false) {
    if (!this.mode.active || !this.mode.undergroundView) return null;
    const level = this.mode.floorLevel;
    const navigation = this.s.navigation;
    if (navigation.isWalkableAt(x, z, level)) return this.s.terrainSystem.heightAt(x, z, level);
    return picking && this.mode.mode === 'zone' && navigation.floorCells(level).size ? NO_FLOOR_PICK_HEIGHT : this.mode.floorHeight;
  },

  floorView() {
    return this.mode.floorView();
  },

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
  },

  selectFloor(level) {
    this.mode.selectFloor(level);
    this.mode.clearDraft();
    this.syncFloorView();
    this.announceBrushFloor();
    this.s.handleHover(this.s.hoverCell);
  },

  stepFloorHeight(delta) {
    this.mode.stepFloorHeight(delta);
    this.syncFloorView();
    this.showAreaPreview(this.mode.getAreaSelection());
    this.s.handleHover(this.s.hoverCell);
  },

  currentFloorReport() {
    return this.mode.floorReport(this.s.terrainSystem.movementConnectors);
  },

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
      caveTarget: this.mode.caveTarget,
    };
  },

  refreshFloorPanel() {
    this.floorPanel.update(this.floorPanelView());
  },

  showFloorMarks() {
    if (!this.mode.undergroundFloor) {
      this.s.gridSystem.clearZones();
      return;
    }
    const report = this.currentFloorReport();
    this.floorMarksReport = report;
    this.s.gridSystem.showZones([
      { cells: report.doors, color: ZONE.door, glow: ZONE.door, alpha: 0.6, lift: 0.06 },
      { cells: [...report.low, ...report.pierced, ...report.steep], color: ZONE.problem, glow: ZONE.problem, alpha: 0.45, lift: 0.05 },
    ], (cx, cz) => this.s.cellSurfaceAt(cx, cz));
  },

  showFloorEdges(selection) {
    const preview = this.mode.floorEdgePreview(selection);
    this.floorEdgeCounts = { door: preview.door.length, thin: preview.thin.length, pierced: preview.pierced.length };
    const edges = [
      ...preview.door.map((edge) => ({ ...edge, color: MARK_COLORS.door })),
      ...preview.thin.map((edge) => ({ ...edge, color: MARK_COLORS.thin })),
    ];
    for (const cell of preview.pierced) {
      for (const [dx, dz] of SIDES) edges.push({ ...cell, dx, dz, color: MARK_COLORS.problem });
    }
    this.s.gridSystem.showEdges(edges);
  },

  askFloorName(floor) {
    this.s.dialog.ask({
      title: 'Přejmenovat patro',
      text: 'Prázdné pole vrátí původní název. Název se uloží s mapou.',
      input: { value: floor.name || '', placeholder: floorName(floor.level), maxLength: 32 },
      confirmLabel: 'Uložit',
      onConfirm: (name) => {
        this.mode.renameFloor(floor.level, name);
        this.syncFloorView();
        this.refreshUndoButton();
        this.refreshFloorPanel();
      },
    });
  },

  askCaveName(cell) {
    const level = this.mode.floorLevel;
    const dug = this.mode.floorEntries(level).some((entry) => entry.cx === cell.cx && entry.cz === cell.cz);
    if (!dug) {
      this.hud.setReadout('Klikni na vykopanou jeskyni v tomhle patře');
      return;
    }
    this.s.dialog.ask({
      title: 'Pojmenovat jeskyni',
      text: 'Jméno platí pro celou souvislou jeskyni v tomhle patře. Hráč ho uvidí na mapě a v oznámení Objeveno. Prázdné pole jméno smaže.',
      input: { value: this.mode.caveNameOf(level, cell.cx, cell.cz) || '', placeholder: this.caveFloorLabel(level), maxLength: CAVE_NAME_MAX },
      confirmLabel: 'Uložit',
      onConfirm: (name) => {
        if (!this.mode.renameCave(level, cell.cx, cell.cz, name)) return;
        this.refreshUndoButton();
        this.refreshFloorPanel();
        this.markDirty();
        const text = String(name || '').trim();
        this.hud.setReadout(text ? `Jeskyně se jmenuje „${text}“` : 'Jméno jeskyně smazáno');
      },
    });
  },

  showCaveStart(plan) {
    if (!plan) {
      this.s.gridSystem.showEdges([]);
      this.s.tooltipPanel.show('Povrch', 'Najeď na stěnu útesu a klikni — začneš kopat jeskyni');
      return;
    }
    const door = this.doorAtPlan(plan);
    const color = door ? MARK_COLORS.door : plan.missing ? MARK_COLORS.problem : plan.overlap ? MARK_COLORS.thin : MARK_COLORS.door;
    this.s.gridSystem.showEdges([{ cx: plan.cx, cz: plan.cz, dx: plan.dx, dz: plan.dz, y: plan.floor, color }]);
    if (door) {
      const next = frameLabel(nextDoorFrame(door.frameStyle), door.autoStyle);
      this.s.tooltipPanel.show('Vchod do jeskyně', `Rám: ${frameLabel(door.frameStyle, door.autoStyle)} · klikni → ${next}`);
      return;
    }
    if (plan.missing) {
      this.s.tooltipPanel.show('Sem jeskyně nepůjde', `Útes je moc nízký, chybí ${formatMeters(plan.missing)}`);
      return;
    }
    const where = this.caveFloorLabel(plan.level);
    const warning = plan.overlap ? ` · pozor: v patře ${where} tu už jeskyně je, nová se s ní spojí` : '';
    this.s.tooltipPanel.show('Vykopat jeskyni', `Klikni · vchod ve výšce ${formatMeters(plan.floor)} · ${where}${warning}`);
  },

  caveFloorLabel(level) {
    const names = this.mode.getMap().floorNames || {};
    return floorName(level, names[level]);
  },

  doorAtPlan(plan) {
    if (!plan) return null;
    return this.s.terrainSystem.caveDoors().find((door) => (
      door.cx === plan.cx && door.cz === plan.cz && door.dx === plan.dx && door.dz === plan.dz
    )) || null;
  },

  startCave(cell) {
    const plan = this.mode.caveStartAt(cell);
    if (!plan) {
      this.hud.setReadout('Klikni na stěnu útesu, tam začne vchod do jeskyně');
      return;
    }
    const door = this.doorAtPlan(plan);
    if (door) {
      const next = this.mode.cycleDoorFrame(door);
      if (next === undefined) return;
      this.refreshUndoButton();
      this.hud.setReadout(`Rám vchodu: ${frameLabel(next, door.autoStyle)}`);
      this.s.handleHover(this.s.hoverCell);
      return;
    }
    if (plan.missing) {
      this.hud.setReadout(`Útes je moc nízký, chybí ${formatMeters(plan.missing)}`);
      return;
    }
    this.mode.beginCave(plan);
    this.syncFloorView();
    const joined = plan.overlap ? ' · napojí se na jeskyni, která tu v patře už je' : '';
    this.hud.setReadout(`${this.caveFloorLabel(plan.level)}: táhni výběr do skály a potvrď Aplikovat${joined}`);
  },

  showFloorHoverReadout(cell) {
    this.hud.setCursorValue(null);
    if (!this.mode.undergroundView) {
      this.showCaveStart(this.mode.caveStartAt(cell));
      return;
    }
    if (this.mode.mode !== 'zone' && this.mode.areaTool === 'name') {
      const level = this.mode.floorLevel;
      const dug = this.mode.floorEntries(level).some((entry) => entry.cx === cell.cx && entry.cz === cell.cz);
      const name = dug ? this.mode.caveNameOf(level, cell.cx, cell.cz) : null;
      this.s.tooltipPanel.show(dug ? (name || 'Jeskyně bez jména') : 'Tady jeskyně není', dug ? `Klikni a napiš jméno · bez jména se použije „${this.caveFloorLabel(level)}“` : `${cell.cx}, ${cell.cz}`);
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
  },
};
