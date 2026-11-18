// Část editoru: řeky — tah myší od pramene k ústí je návrh, Aplikovat z něj postaví řeku i s korytem.
// Patří k MapEditor (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { formatMeters } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { cellCount, MARK_COLORS } from './editorSettings.js';
import { planRiver, riverPath, riverFalls, riverGround, riverRestore, riverCellKeys, splitRiver } from '../utils/riverPlan.js';


function riverArrow(path, index, y, color) {
  if (path.length < 2) return [];
  const before = path[Math.max(0, index - 1)];
  const after = path[Math.min(path.length - 1, index + 1)];
  const dx = after[0] - before[0];
  const dz = after[1] - before[1];
  const length = Math.hypot(dx, dz);
  if (!length) return [];
  const [cx, cz] = path[index];
  return [{ cx, cz, y, dx: dx / length, dz: dz / length, color, source: index === 0 }];
}

export default {
  startRiver(cell) {
    if (this.mode.draftMode === 'remove') {
      this.removeRiverAt(cell);
      return;
    }
    const stroke = this.riverStroke;
    const last = stroke && stroke.length ? stroke[stroke.length - 1] : null;
    const goesOn = Boolean(last) && last[0] === cell.cx && last[1] === cell.cz;
    if (!goesOn) this.riverStroke = [[cell.cx, cell.cz]];
    this.riverDrawing = true;
    this.showRiverStroke();
    this.hud.setReadout(goesOn ? 'Řeka: táhni dál k ústí' : 'Řeka: táhni k ústí a pusť tlačítko');
  },

  endRiverStroke() {
    this.riverDrawing = false;
    const count = this.riverStroke ? this.riverStroke.length : 0;
    if (count < 2) {
      this.hud.setReadout('Řeka potřebuje aspoň dvě buňky — táhni myší od pramene k ústí');
      return;
    }
    this.hud.setReadout(`Návrh řeky: ${cellCount(count)} · Aplikovat (Enter) ji postaví, Esc zahodí · z posledního políčka jde táhnout dál`);
  },

  dropRiverStroke() {
    this.riverStroke = null;
    this.riverDrawing = false;
  },

  extendRiver(cell) {
    const stroke = this.riverStroke;
    if (!stroke || !this.riverDrawing) return;
    const [lastX, lastZ] = stroke[stroke.length - 1];
    const seen = new Set(stroke.map(([cx, cz]) => cellKey(cx, cz)));
    let added = false;
    for (const [cx, cz] of riverPath({ cx: lastX, cz: lastZ }, cell)) {
      if (seen.has(cellKey(cx, cz))) continue;
      seen.add(cellKey(cx, cz));
      stroke.push([cx, cz]);
      added = true;
    }
    if (added) this.showRiverStroke();
  },

  showRiverStroke() {
    const draft = this.mode.draft;
    if (draft) {
      draft.cells = new Set((this.riverStroke || []).map(([cx, cz]) => cellKey(cx, cz)));
      if (this.mode.onDraftChange) this.mode.onDraftChange(draft);
    }
    this.refreshRiverArrows();
  },

  refreshRiverArrows() {
    const grid = this.s.gridSystem;
    if (!this.mode.active || this.mode.mode !== 'zone' || !this.mode.isRiverBrush) {
      grid.clearArrows();
      return;
    }
    const arrows = [];
    for (const river of this.mode.riverList()) {
      const path = river.cells || [];
      for (let index = 0; index < path.length; index += 2) {
        arrows.push(...riverArrow(path, index, path[index][2], MARK_COLORS.river));
      }
    }
    const stroke = this.riverStroke || [];
    for (let index = 0; index < stroke.length; index += 1) {
      const [cx, cz] = stroke[index];
      arrows.push(...riverArrow(stroke, index, this.s.cellSurfaceAt(cx, cz), MARK_COLORS.riverStroke));
    }
    grid.showArrows(arrows);
  },

  applyRiver() {
    const stroke = this.riverStroke;
    const drafted = this.mode.draft && this.mode.draft.cells.size > 0;
    if (!stroke || !drafted || stroke.length < 2) {
      this.hud.setReadout('Nejdřív táhni myší řeku od pramene k ústí');
      return;
    }
    this.dropRiverStroke();
    this.showRiverStroke();
    const terrain = this.s.terrainSystem;
    const width = Number(this.mode.brushOptionValue(this.mode.brushKey, 'width')) || 1;
    const kind = this.mode.brushOptionValue(this.mode.brushKey, 'depth') === 'deep' ? 'deep' : 'shallow';
    const depths = {
      min: Number(this.mode.brushOptionValue(this.mode.brushKey, `${kind}Min`)),
      max: Number(this.mode.brushOptionValue(this.mode.brushKey, `${kind}Max`)),
    };
    const present = new Set(terrain.groundCells.map(([cx, cz]) => cellKey(cx, cz)));
    const redraw = this.riverRedraw(stroke, present);
    const groundAt = (cx, cz) => {
      const key = cellKey(cx, cz);
      return redraw.restore.has(key) ? redraw.restore.get(key) : terrain.heightAtCell(cx, cz);
    };
    const water = new Map();
    for (const [key, body] of this.s.waterBodies().cells) {
      if (!redraw.replaced.has(key)) water.set(key, body.level);
    }
    const path = redraw.upstream ? [...stroke].reverse() : stroke;
    const plan = planRiver(path, width, depths, present, groundAt, water, this.mode.getWaterLevel());
    if (plan.river.cells.length < 2) {
      this.hud.setReadout('Tudy řeka nepoteče — trasa vede mimo hrací plochu');
      return;
    }
    const cells = plan.river.cells;
    this.mode.setWaterShown(true);
    this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.mode.changeRivers([...redraw.kept, plan.river], redraw.restore, plan.carve);
    this.refreshRiverArrows();
    this.refreshUndoButton();
    this.markDirty();
    const falls = riverFalls(plan.river).length;
    const fallText = falls ? ` · vodopády: ${falls}` : '';
    const redrawText = redraw.replaced.size ? ' · přes starou řeku nakreslena znovu' : '';
    const standingText = plan.standing
      ? ` · pozor: na ${plan.standing} políčkách je terén níž než hladina u ústí, voda tam stojí nad zemí`
      : '';
    this.hud.setReadout(`Řeka: ${cellCount(cells.length)} · hladina z ${formatMeters(cells[0][2])} na ${formatMeters(cells[cells.length - 1][2])}${fallText}${redrawText}${standingText}`);
  },

  riverRedraw(stroke, present) {
    const strokeKeys = new Set(stroke.map(([cx, cz]) => cellKey(cx, cz)));
    const order = new Map(stroke.map(([cx, cz], index) => [cellKey(cx, cz), index]));
    const kept = [];
    const restore = new Map();
    const replaced = new Set();
    const redrawn = [];
    let mostShared = 0;
    let upstream = false;
    for (const river of this.mode.riverList()) {
      const shared = (river.cells || []).filter(([cx, cz]) => strokeKeys.has(cellKey(cx, cz)));
      if (shared.length < 2) {
        kept.push(river);
        continue;
      }
      if (shared.length > mostShared) {
        mostShared = shared.length;
        const first = shared[0];
        const last = shared[shared.length - 1];
        upstream = order.get(cellKey(first[0], first[1])) > order.get(cellKey(last[0], last[1]));
      }
      redrawn.push(river);
      kept.push(...splitRiver(river, strokeKeys, present));
    }
    const taken = new Set(kept.flatMap((river) => [...riverCellKeys(river, present)]));
    for (const river of redrawn) {
      const freed = [...riverCellKeys(river, present)].filter((key) => !taken.has(key));
      for (const key of freed) replaced.add(key);
      for (const [key, height] of riverRestore(river, freed, present)) restore.set(key, height);
    }
    return { kept, restore, replaced, upstream };
  },

  removeRiverAt(cell) {
    const hit = this.waterBodyHitAt(cell, 'river');
    if (!hit) {
      this.hud.setReadout('Tady žádná řeka není');
      return;
    }
    const remembered = riverGround(this.mode.riverList()[hit.index]).size > 0;
    this.mode.removeRiver(hit.index);
    this.refreshRiverArrows();
    this.s.handleHover(this.s.hoverCell);
    this.refreshUndoButton();
    this.markDirty();
    this.hud.setReadout(remembered
      ? 'Řeka smazána i s korytem'
      : 'Řeka smazána — je starší, koryto zasypáno odhadem těsně nad bývalou hladinu');
  },
};
