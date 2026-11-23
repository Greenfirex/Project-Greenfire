// Část řízení editoru: značky v mapě — návrh štětce, hologram a popisky výšek, start hráče a kruhy tvorů.
// Patří k MapEditor (sdílí jeho this).
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { HEIGHT_STEP, formatMeters } from '../data/maps/layoutStore.js';
import { CELL_SIZE } from '../utils/gridMath.js';
import { MARK_COLORS, parseCell } from './editorSettings.js';

const HEIGHT_LABEL_LIFT = 0.45;
const HEIGHT_LABEL_LIMIT = 240;
const MARKS_FOLLOW_SECONDS = 0.25;

export const ZONE = Object.fromEntries(Object.entries(MARK_COLORS).map(([name, rgb]) => [name, Color3.FromArray(rgb)]));

export default {
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

    const draftCells = [...draft.cells].map(parseCell).map(({ cx, cz }) => [cx, cz]);

    const groups = [
      {
        cells: draftCells,
        color: removing ? ZONE.erase : ZONE.draft,
        glow: removing ? ZONE.eraseGlow : ZONE.draftGlow,
        alpha: 0.72,
        lift: 0.055,
      },
      {
        cells: shape ? shape.slope.map((entry) => [entry.cx, entry.cz]) : [],
        color: ZONE.slope,
        glow: ZONE.slopeGlow,
        alpha: 0.34,
        lift: 0.035,
      },
      {
        cells: shape && shape.rim ? shape.rim.map((entry) => [entry.cx, entry.cz]) : [],
        color: ZONE.rim,
        glow: ZONE.rimGlow,
        alpha: 0.22,
        lift: 0.03,
      },
    ];
    this.s.gridSystem.showZones(spawnZone ? [spawnZone, ...groups] : groups, surfaceAt);

    this.s.gridSystem.showDraftCells(draftCells, surfaceAt, draft.mode);
  },

  spawnZone() {
    if (!this.mode.active || this.mode.mode !== 'zone' || !this.mode.isSpawnBrush) return null;
    const spawn = this.mode.spawnCell();
    if (!spawn) return null;
    return {
      cells: [[spawn.cx, spawn.cz]],
      color: ZONE.spawn,
      glow: ZONE.spawnGlow,
      alpha: 0.5,
      lift: 0.05,
    };
  },

  showHeightDraftOverlay() {
    const groups = this.mode.heightDraftGroups();
    const surfaceAt = (cx, cz) => this.s.cellSurfaceAt(cx, cz);
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
  },

  updateHeightLabels() {
    if (!this.heightLabels.items.length) return;
    this.heightLabels.update((x, y, z) => this.s.screenPointOf(x, y, z));
  },

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
  },

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
  },

  followCreatureMarks(dt) {
    if (!this.mode.active || !(this.mode.isCreatureBrush || this.mode.isNestBrush)) return;
    this.marksClock += dt;
    if (this.marksClock < MARKS_FOLLOW_SECONDS) return;
    this.marksClock = 0;
    this.refreshCreatureMarks();
  },
};
