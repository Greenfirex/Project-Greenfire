// Část editoru: patra — výběr patra, vykopání a zasypání jeskyně a kontrola, jestli je použitelná.
// Patří k EditorMode (sdílí jeho this); výběr buněk tažením si půjčuje od Herní plochy.
import { PAINT_ALL } from '../data/catalogs/brushes.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { columnsByCell, dropLayerCell, layerLiftAt, levelOfEntry, planeLevels } from '../data/maps/areaShape.js';
import { SIDES } from './editorSettings.js';

export const MIN_CLEARANCE = 2.6;
export const DEFAULT_CLEARANCE = 3;
export const FLOOR_MARKS = { door: [0.25, 0.95, 0.5], problem: [1, 0.2, 0.2] };
const SURFACE_DIM = 115;

function levelOfEnd(end) {
  return Number.isFinite(end.level) ? end.level : 0;
}

export default {
  floorEntries(level = this.floorLevel) {
    return ((this.layout && this.layout.floor) || []).filter((entry) => entry && levelOfEntry(entry) === level);
  },

  floorList() {
    const levels = new Set([0, ...this.floorExtra, ...planeLevels(this.layout)]);
    const list = [...levels].map((level) => {
      const cells = this.floorEntries(level);
      const lifts = cells.map((entry) => entry.liftY || 0);
      const ceilings = cells.map((entry) => (Number.isFinite(entry.ceilY) ? entry.ceilY : entry.liftY || 0));
      return {
        level,
        count: cells.length,
        bottom: cells.length ? Math.min(...lifts) : null,
        top: cells.length ? Math.max(...ceilings) : null,
      };
    });
    return list.sort((a, b) => {
      if (a.level === 0 || b.level === 0) return a.level === 0 ? -1 : 1;
      if (a.bottom === null || b.bottom === null) return a.bottom === null ? 1 : -1;
      return b.bottom - a.bottom || b.level - a.level;
    });
  },

  selectFloor(level) {
    this.floorLevel = level;
    this.clearAreaSelection();
    const cells = this.floorEntries(level);
    if (level < 0 && cells.length) this.floorHeight = Math.min(...cells.map((entry) => entry.liftY || 0));
  },

  addFloor() {
    const lowest = Math.min(0, ...this.floorExtra, ...planeLevels(this.layout));
    const level = lowest - 1;
    this.floorExtra.add(level);
    this.selectFloor(level);
    return level;
  },

  stepFloorHeight(delta) {
    this.floorHeight += delta * HEIGHT_STEP;
    return this.floorHeight;
  },

  stepFloorClearance(delta) {
    const next = this.floorClearance + delta * HEIGHT_STEP;
    if (next >= MIN_CLEARANCE) this.floorClearance = next;
    return this.floorClearance;
  },

  beginFloorDrag(cx, cz) {
    const cells = this.strokeCells();
    let fromX = cx;
    let fromZ = cz;
    let toX = cx;
    let toZ = cz;
    if (cells.some(([x, z]) => x === cx && z === cz)) {
      const xs = cells.map(([x]) => x);
      const zs = cells.map(([, z]) => z);
      const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const nearMaxX = maxX - cx <= cx - minX;
      const nearMaxZ = maxZ - cz <= cz - minZ;
      fromX = nearMaxX ? minX : maxX;
      fromZ = nearMaxZ ? minZ : maxZ;
      toX = nearMaxX ? maxX : minX;
      toZ = nearMaxZ ? maxZ : minZ;
    }
    this.floorDragShift = [toX - cx, toZ - cz];
    this.areaStroke = null;
    this.areaBase = new Map();
    this.areaDrag = { mode: this.areaTool, fromX, fromZ, toX, toZ };
    this.refreshAreaDrag();
  },

  moveFloorDrag(cx, cz) {
    this.moveAreaDrag(cx + this.floorDragShift[0], cz + this.floorDragShift[1]);
  },

  raiseLowCeilings() {
    if (!this.layout || !this.undergroundFloor) return 0;
    const low = this.floorEntries().filter((entry) => Number.isFinite(entry.ceilY) && entry.ceilY - (entry.liftY || 0) < MIN_CLEARANCE);
    if (!low.length) return 0;
    const clearance = Math.ceil(MIN_CLEARANCE / HEIGHT_STEP) * HEIGHT_STEP;
    this.pushHistory();
    for (const entry of low) entry.ceilY = (entry.liftY || 0) + clearance;
    this.scheduleRegenerate(PAINT_ALL);
    return low.length;
  },

  applyFloorSelection() {
    const selection = this.areaSelection;
    if (!selection || !this.layout || !this.undergroundFloor) return 0;
    const erasing = selection.tool === 'erase';
    const level = this.floorLevel;
    this.pushHistory();
    let count = 0;
    for (const [cx, cz] of selection.cells) {
      const dropped = dropLayerCell(this.layout, cx, cz, level);
      if (erasing) {
        if (dropped) count += 1;
        continue;
      }
      const entry = { key: this.areaSurface, cx, cz, rotation: 0, ceilY: this.floorHeight + this.floorClearance, level };
      if (this.floorHeight) entry.liftY = this.floorHeight;
      this.layout.floor.push(entry);
      count += 1;
    }
    if (erasing) this.dropConnectorsAt(selection.cells, level);
    if (!count) {
      this.history.pop();
      this.clearAreaSelection();
      return 0;
    }
    this.clearAreaSelection();
    this.scheduleRegenerate(PAINT_ALL);
    return count;
  },

  dropConnectorsAt(cells, level) {
    const gone = new Set(cells.map(([cx, cz]) => cellKey(cx, cz)));
    const touches = (end) => levelOfEnd(end) === level && gone.has(cellKey(end.cx, end.cz));
    this.layout.connectors = (this.layout.connectors || []).filter((record) => !touches(record.from) && !touches(record.to));
  },

  floorReport(connectors) {
    const level = this.floorLevel;
    const cells = new Map();
    const low = [];
    const pierced = [];
    for (const entry of this.floorEntries(level)) {
      cells.set(cellKey(entry.cx, entry.cz), entry);
      if (!Number.isFinite(entry.ceilY)) continue;
      if (entry.ceilY - (entry.liftY || 0) < MIN_CLEARANCE) low.push([entry.cx, entry.cz]);
      const surface = layerLiftAt(this.layout, entry.cx, entry.cz);
      if (surface !== null && entry.ceilY > surface) pierced.push([entry.cx, entry.cz]);
    }
    const doors = new Map();
    for (const record of connectors || []) {
      if (!record || !record.from || !record.to || levelOfEnd(record.from) === levelOfEnd(record.to)) continue;
      for (const end of [record.from, record.to]) {
        const key = cellKey(end.cx, end.cz);
        if (levelOfEnd(end) === level && cells.has(key)) doors.set(key, [end.cx, end.cz]);
      }
    }
    const seen = new Set();
    let sealed = 0;
    for (const start of cells.keys()) {
      if (seen.has(start)) continue;
      seen.add(start);
      const group = [start];
      let open = false;
      while (group.length) {
        const key = group.pop();
        if (doors.has(key)) open = true;
        const { cx, cz } = cells.get(key);
        for (const [dx, dz] of SIDES) {
          const next = cellKey(cx + dx, cz + dz);
          if (!cells.has(next) || seen.has(next)) continue;
          seen.add(next);
          group.push(next);
        }
      }
      if (!open) sealed += 1;
    }
    return { doors: [...doors.values()], low, pierced, sealed };
  },

  floorView() {
    if (!this.active || !this.undergroundFloor) return null;
    const cells = this.floorEntries();
    if (!cells.length) return { floor: this.floorHeight, cut: this.floorHeight + this.floorClearance };
    return {
      floor: Math.min(...cells.map((entry) => entry.liftY || 0)),
      cut: Math.max(...cells.map((entry) => (Number.isFinite(entry.ceilY) ? entry.ceilY : entry.liftY || 0))),
    };
  },

  floorViewMap() {
    const columns = columnsByCell(this.layout || {});
    let minX = 0;
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;
    for (const id of columns.keys()) {
      const [cx, cz] = id.split(',').map(Number);
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minZ = Math.min(minZ, cz);
      maxZ = Math.max(maxZ, cz);
    }
    minX -= 1;
    minZ -= 1;
    const width = maxX - minX + 2;
    const height = maxZ - minZ + 2;
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = SURFACE_DIM;
      data[index + 2] = 255;
      data[index + 3] = 255;
    }
    for (const entry of this.floorEntries()) {
      const index = ((entry.cz - minZ) * width + (entry.cx - minX)) * 4;
      data[index] = 0;
      data[index + 1] = 255;
      data[index + 3] = 0;
    }
    return { data, width, height, minX, minZ, lit: 0 };
  },
};
