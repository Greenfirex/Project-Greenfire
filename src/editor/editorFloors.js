// Část editoru: patra — výběr patra, vykopání a zasypání jeskyně a kontrola, jestli je použitelná.
// Patří k EditorMode (sdílí jeho this); výběr buněk tažením si půjčuje od Herní plochy.
import { PAINT_ALL, PAINT_TERRAIN } from '../data/catalogs/brushes.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { CELL_SIZE, cellKey } from '../utils/gridMath.js';
import { CAVE_OPEN_STEP, DOOR_FRAME_STYLES, caveOpensInto, columnsByCell, doorFrameStyleOf, dropDecorationCell, dropLayerCell, floorCellAt, layerLiftAt, levelOfEntry, planeLevels } from '../data/maps/areaShape.js';
import { SIDES, parseCell } from './editorSettings.js';
import { CAVE_NAME_MAX, caveNameAt, caveNameIndex, caveRegion } from '../data/maps/caveNames.js';

export const MIN_CLEARANCE = 3;
export const MAX_CORRIDOR_STEP = 1;
export const DEFAULT_CLEARANCE = 3;

const CAVE_START_REACH = 1;

function edgeKind(planes, level, floor, ceil) {
  if (!planes) return 'thin';
  if (planes.some((plane) => plane.level === level)) return null;
  if (planes.some((plane) => caveOpensInto(plane, floor))) return 'door';
  const open = planes.some((plane) => (plane.level === 0 ? plane.lift < ceil : Number.isFinite(plane.ceil) && plane.lift < ceil && plane.ceil > floor));
  return open ? 'thin' : null;
}

export function corridorCells(fromX, fromZ, toX, toZ) {
  const cells = [[fromX, fromZ]];
  let x = fromX;
  let z = fromZ;
  const walkX = () => { while (x !== toX) { x += Math.sign(toX - x); cells.push([x, z]); } };
  const walkZ = () => { while (z !== toZ) { z += Math.sign(toZ - z); cells.push([x, z]); } };
  if (Math.abs(toX - fromX) >= Math.abs(toZ - fromZ)) { walkX(); walkZ(); } else { walkZ(); walkX(); }
  return cells;
}

export function nextDoorFrame(current) {
  const order = [null, ...DOOR_FRAME_STYLES];
  return order[(order.indexOf(current || null) + 1) % order.length];
}

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
        name: ((this.layout && this.layout.floorNames) || {})[level] || null,
        empty: this.floorIsEmpty(level),
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

  floorIsEmpty(level) {
    if (level === 0 || !this.layout || planeLevels(this.layout).includes(level)) return false;
    return !['decorations', 'creatures'].some((name) => (this.layout[name] || []).some((entry) => entry && levelOfEntry(entry) === level));
  },

  deleteFloor(level) {
    if (!this.floorIsEmpty(level)) return false;
    this.floorExtra.delete(level);
    if (this.layout.floorNames) delete this.layout.floorNames[level];
    if (this.floorLevel === level) this.selectFloor(0);
    return true;
  },

  renameFloor(level, name) {
    if (!this.layout || level === 0) return;
    if (!this.layout.floorNames) this.layout.floorNames = {};
    const text = String(name || '').trim();
    if ((this.layout.floorNames[level] || '') === text) return;
    this.pushHistory([]);
    if (text) this.layout.floorNames[level] = text;
    else delete this.layout.floorNames[level];
    this.repaint([]);
  },

  caveNameOf(level, cx, cz) {
    const found = caveNameAt(caveNameIndex(this.layout), level, cx, cz);
    return found ? found.name : null;
  },

  renameCave(level, cx, cz, name) {
    if (!this.layout || level === 0) return false;
    const region = caveRegion(this.layout, level, cx, cz);
    if (!region.size) return false;
    const text = String(name || '').trim().slice(0, CAVE_NAME_MAX);
    if ((this.caveNameOf(level, cx, cz) || '') === text) return true;
    this.pushHistory([]);
    const kept = (this.layout.caveNames || []).filter((item) => item.level !== level || !region.has(`${item.cx},${item.cz}`));
    if (text) kept.push({ level, cx, cz, name: text });
    this.layout.caveNames = kept;
    this.repaint([]);
    return true;
  },

  selectFloor(level) {
    this.floorLevel = level;
    this.clearAreaSelection();
    const cells = this.floorEntries(level);
    if (level < 0 && cells.length) this.floorHeight = Math.min(...cells.map((entry) => entry.liftY || 0));
  },

  addFloor() {
    const level = this.lowestFloor() - 1;
    this.floorExtra.add(level);
    this.selectFloor(level);
    return level;
  },

  caveWallAt(cell, columns) {
    const surfaceLift = (cx, cz) => {
      const plane = (columns.get(`${cx},${cz}`) || []).find((item) => item.level === 0);
      return plane ? plane.lift : null;
    };
    const pointX = cell.point ? cell.point.x / CELL_SIZE : cell.cx;
    const pointZ = cell.point ? cell.point.z / CELL_SIZE : cell.cz;
    let best = null;
    for (const [dx, dz] of SIDES) {
      for (const [rockX, rockZ, sideX, sideZ] of [[cell.cx, cell.cz, dx, dz], [cell.cx + dx, cell.cz + dz, -dx, -dz]]) {
        const rock = surfaceLift(rockX, rockZ);
        const ground = surfaceLift(rockX + sideX, rockZ + sideZ);
        if (rock === null || ground === null || rock - ground <= CAVE_OPEN_STEP) continue;
        const distance = Math.hypot(rockX + sideX / 2 - pointX, rockZ + sideZ / 2 - pointZ);
        if (distance > CAVE_START_REACH || (best && distance >= best.distance)) continue;
        best = { cx: rockX, cz: rockZ, dx: sideX, dz: sideZ, floor: ground, wall: rock - ground, distance };
      }
    }
    return best;
  },

  lowestFloor() {
    return Math.min(0, ...this.floorExtra, ...planeLevels(this.layout));
  },

  caveSpotTaken(wall, columns, level) {
    const cells = [[wall.cx, wall.cz], ...SIDES.map(([dx, dz]) => [wall.cx + dx, wall.cz + dz])];
    return cells.some(([cx, cz]) => (columns.get(`${cx},${cz}`) || []).some((plane) => plane.level === level));
  },

  freeCaveLevel(wall, columns) {
    const lowest = this.lowestFloor();
    for (let level = -1; level >= lowest; level -= 1) {
      if (!this.caveSpotTaken(wall, columns, level)) return level;
    }
    return lowest - 1;
  },

  cycleDoorFrame(door) {
    const entry = this.layout ? floorCellAt(this.layout, door.cx, door.cz, door.level) : null;
    if (!entry) return undefined;
    const next = nextDoorFrame(doorFrameStyleOf(entry));
    this.pushHistory([PAINT_TERRAIN]);
    if (next) entry.frameStyle = next;
    else delete entry.frameStyle;
    this.repaint([PAINT_TERRAIN]);
    return next;
  },

  setCaveTarget(target) {
    this.caveTarget = target === 'new' || (Number.isInteger(target) && target < 0) ? target : 'auto';
  },

  caveTargetLevel(wall, columns) {
    if (this.caveTarget === 'new') return this.lowestFloor() - 1;
    const known = [...this.floorExtra, ...planeLevels(this.layout)];
    if (Number.isInteger(this.caveTarget) && known.includes(this.caveTarget)) return this.caveTarget;
    return this.freeCaveLevel(wall, columns);
  },

  caveStartAt(cell) {
    if (!cell || !this.layout || this.floorLevel !== 0) return null;
    const columns = columnsByCell(this.layout);
    const wall = this.caveWallAt(cell, columns);
    if (!wall) return null;
    const missing = this.floorClearance - wall.wall;
    const level = this.caveTargetLevel(wall, columns);
    const overlap = Number.isInteger(this.caveTarget) && this.caveSpotTaken(wall, columns, level);
    return { ...wall, level, overlap, missing: missing > 0 ? missing : 0 };
  },

  beginCave(plan) {
    this.setAreaTool('paint');
    this.floorExtra.add(plan.level);
    this.selectFloor(plan.level);
    this.floorHeight = plan.floor;
    this.beginFloorDrag(plan.cx, plan.cz);
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
    this.floorDragShift = [0, 0];
    if (this.areaTool === 'corridor') this.areaStroke = null;
    this.beginAreaDrag(cx, cz);
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
    this.repaint(PAINT_ALL);
    return low.length;
  },

  applyFloorSelection() {
    const selection = this.areaSelection;
    if (!selection || !this.layout || !this.undergroundFloor) return 0;
    if (selection.tool === 'corridor') return this.applyCorridor(selection.cells);
    const erasing = selection.tool === 'erase';
    const level = this.floorLevel;
    this.pushHistory();
    let count = 0;
    for (const [cx, cz] of selection.cells) {
      const dropped = dropLayerCell(this.layout, cx, cz, level);
      if (erasing) {
        if (dropped) count += 1;
        dropDecorationCell(this.layout, cx, cz, level);
        continue;
      }
      const entry = { key: this.areaSurface, cx, cz, rotation: 0, ceilY: this.floorHeight + this.floorClearance, level };
      if (this.floorHeight) entry.liftY = this.floorHeight;
      this.layout.floor.push(entry);
      count += 1;
    }
    if (erasing) this.dropConnectorsAt(selection.cells, level);
    else this.lowerDugOutside(selection.cells, selection.cells.map(() => this.floorHeight));
    if (!count) {
      this.history.pop();
      this.clearAreaSelection();
      return 0;
    }
    this.clearAreaSelection();
    this.repaint(PAINT_ALL);
    return count;
  },

  corridorLifts(cells) {
    const entries = this.floorEntries(this.floorLevel);
    const liftAt = (cx, cz) => {
      const entry = entries.find((item) => item.cx === cx && item.cz === cz);
      return entry ? entry.liftY || 0 : null;
    };
    const [firstX, firstZ] = cells[0];
    let start = liftAt(firstX, firstZ);
    let offset = 0;
    if (start === null) {
      const inPath = new Set(cells.map(([cx, cz]) => cellKey(cx, cz)));
      for (const [dx, dz] of SIDES) {
        const lift = inPath.has(cellKey(firstX + dx, firstZ + dz)) ? null : liftAt(firstX + dx, firstZ + dz);
        if (lift === null) continue;
        start = lift;
        offset = 1;
        break;
      }
    }
    if (start === null) start = this.floorHeight;
    const steps = Math.max(1, cells.length - 1 + offset);
    return cells.map((cell, index) => Math.round((start + (this.floorHeight - start) * ((index + offset) / steps)) / HEIGHT_STEP) * HEIGHT_STEP);
  },

  floorEdgePreview(selection) {
    const preview = { door: [], thin: [], pierced: [] };
    if (!selection || !this.layout || !this.undergroundFloor || !selection.cells.length || selection.tool === 'erase') return preview;
    const level = this.floorLevel;
    const lifts = selection.tool === 'corridor' ? this.corridorLifts(selection.cells) : null;
    const planned = new Set(selection.cells.map(([cx, cz]) => `${cx},${cz}`));
    const columns = columnsByCell(this.layout);
    selection.cells.forEach(([cx, cz], index) => {
      const floor = lifts ? lifts[index] : this.floorHeight;
      const ceil = floor + this.floorClearance;
      const surface = (columns.get(`${cx},${cz}`) || []).find((plane) => plane.level === 0);
      if (surface && ceil > surface.lift) preview.pierced.push({ cx, cz, y: floor });
      for (const [dx, dz] of SIDES) {
        if (planned.has(`${cx + dx},${cz + dz}`)) continue;
        const kind = edgeKind(columns.get(`${cx + dx},${cz + dz}`), level, floor, ceil);
        if (kind) preview[kind].push({ cx, cz, dx, dz, y: floor });
      }
    });
    return preview;
  },

  applyCorridor(cells) {
    const level = this.floorLevel;
    const lifts = this.corridorLifts(cells);
    this.pushHistory();
    cells.forEach(([cx, cz], index) => {
      dropLayerCell(this.layout, cx, cz, level);
      const lift = lifts[index];
      const entry = { key: this.areaSurface, cx, cz, rotation: 0, ceilY: lift + this.floorClearance, level };
      if (lift) entry.liftY = lift;
      this.layout.floor.push(entry);
    });
    this.lowerDugOutside(cells, lifts);
    this.clearAreaSelection();
    this.repaint(PAINT_ALL);
    return cells.length;
  },

  lowerDugOutside(cells, lifts) {
    const level = this.floorLevel;
    const planned = new Set(cells.map(([cx, cz]) => `${cx},${cz}`));
    const columns = columnsByCell(this.layout);
    const lowered = new Map();
    cells.forEach(([cx, cz], index) => {
      const floor = lifts[index];
      const ceil = floor + this.floorClearance;
      for (const [dx, dz] of SIDES) {
        const key = `${cx + dx},${cz + dz}`;
        if (planned.has(key)) continue;
        const planes = columns.get(key);
        if (edgeKind(planes, level, floor, ceil) !== 'thin') continue;
        const surface = planes.find((plane) => plane.level === 0);
        if (!surface || surface.lift <= floor + CAVE_OPEN_STEP || surface.lift >= ceil) continue;
        if (planes.some((plane) => plane.level < 0 && Number.isFinite(plane.ceil) && plane.ceil > floor)) continue;
        const known = lowered.get(key);
        if (!known || floor < known.floor) lowered.set(key, { cx: cx + dx, cz: cz + dz, floor });
      }
    });
    for (const { cx, cz, floor } of lowered.values()) this.setCellHeight(cx, cz, floor);
    if (lowered.size) this.cleanFlatCliffs([...lowered.values()].map(({ cx, cz }) => [cx, cz]));
    return lowered.size;
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
    const steep = new Map();
    for (const [key, entry] of cells) {
      for (const [dx, dz] of SIDES) {
        const near = cells.get(cellKey(entry.cx + dx, entry.cz + dz));
        if (near && Math.abs((near.liftY || 0) - (entry.liftY || 0)) > MAX_CORRIDOR_STEP + 1e-3) steep.set(key, [entry.cx, entry.cz]);
      }
    }
    return { doors: [...doors.values()], low, pierced, sealed, steep: [...steep.values()] };
  },

  floorView() {
    if (!this.active || !this.undergroundView) return null;
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
      const { cx, cz } = parseCell(id);
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
    for (let index = 2; index < data.length; index += 4) data[index] = 255;
    for (const entry of this.floorEntries()) {
      const index = ((entry.cz - minZ) * width + (entry.cx - minX)) * 4;
      data[index + 1] = 255;
    }
    return { data, width, height, minX, minZ, lit: 0 };
  },
};
