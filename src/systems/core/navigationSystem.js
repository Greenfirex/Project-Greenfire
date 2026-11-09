// Kudy se dá chodit — pochozí místa, přechody mezi patry po spojích, průchody a stropy nad hlavou.
// Sám nic nestaví; mapu, mosty, hloubku vody a výšku dekorací mu dodá scéna jako dotazy.
import { worldToCellCoords, CELL_SIZE } from '../../utils/gridMath.js';
import { worldCells, levelOfEntry, ceilingLiftAt } from '../../data/maps/areaShape.js';

const FLOOR_LINK_RADIUS = 8;
const DOORWAY_SIGHT_HEIGHT = 3;
const WALK_CLEARANCE = 1.25;
export const WADE_DEPTH = 0.6;

function levelOf(end) {
  return end && Number.isFinite(end.level) ? end.level : 0;
}

export default class NavigationSystem {

  constructor(scene) {
    this.s = scene;
    this.layoutOf = null;
    this.connectorsOf = null;
    this.bridgeDeckAt = null;
    this.waterDepthAt = null;
    this.topAt = null;
    this.areaLookup = null;
    this.floorSets = new Map();
    this.floorSetsFor = null;
    this.connectorMap = null;
    this.connectorMapFor = null;
    this.passageSet = null;
    this.passageFor = null;
  }

  layout() {
    return this.layoutOf ? this.layoutOf() : null;
  }

  connectors() {
    const records = this.connectorsOf ? this.connectorsOf() : null;
    return records || [];
  }

  resetArea() {
    this.areaLookup = null;
    this.floorSets.clear();
  }

  floorCells(level) {
    const layout = this.layout();
    if (this.floorSetsFor !== layout) {
      this.floorSetsFor = layout;
      this.floorSets.clear();
    }
    if (!this.floorSets.has(level)) {
      const cells = new Set();
      for (const entry of (layout && layout.floor) || []) {
        if (entry && levelOfEntry(entry) === level) cells.add(`${entry.cx},${entry.cz}`);
      }
      this.floorSets.set(level, cells);
    }
    return this.floorSets.get(level);
  }

  areaCells() {
    return worldCells(this.layout());
  }

  onBridge(x, z) {
    return Boolean(this.bridgeDeckAt) && this.bridgeDeckAt(x, z) !== null;
  }

  tooDeep(x, z) {
    return Boolean(this.waterDepthAt) && this.waterDepthAt(x, z) > WADE_DEPTH;
  }

  isWalkableAt(x, z, level = 0) {
    if (level === 0 && this.onBridge(x, z)) return true;
    if (level === 0 && this.tooDeep(x, z)) return false;
    const { cx, cz } = worldToCellCoords(x, z);
    if (this.floorCells(level).has(`${cx},${cz}`)) return true;
    if (level !== 0) return false;
    if (!this.areaLookup) {
      this.areaLookup = new Set(this.areaCells().map(([ax, az]) => `${ax},${az}`));
    }
    if (!this.areaLookup.has(`${cx},${cz}`)) return false;
    return !this.topAt || this.topAt(cx, cz) < WALK_CLEARANCE;
  }

  connectorLevelMap() {
    const records = this.connectors();
    if (this.connectorMap && this.connectorMapFor === records) return this.connectorMap;
    const map = new Map();
    for (const record of records) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const dx = Math.sign(to.cx - from.cx);
      const dz = Math.sign(to.cz - from.cz);
      if (dx === 0 && dz === 0) continue;
      map.set(`${from.cx},${from.cz},${levelOf(from)}|${dx},${dz}`, levelOf(to));
      map.set(`${to.cx},${to.cz},${levelOf(to)}|${-dx},${-dz}`, levelOf(from));
    }
    this.connectorMap = map;
    this.connectorMapFor = records;
    return map;
  }

  stepLevel(fromX, fromZ, level, toX, toZ) {
    const from = worldToCellCoords(fromX, fromZ);
    const to = worldToCellCoords(toX, toZ);
    if (from.cx === to.cx && from.cz === to.cz) return level;
    const dx = Math.sign(to.cx - from.cx);
    const dz = Math.sign(to.cz - from.cz);
    if (dx !== 0 && dz !== 0) return level;
    const map = this.connectorLevelMap();
    if (!map.size) return level;
    const target = map.get(`${from.cx},${from.cz},${level}|${dx},${dz}`);
    return target !== undefined ? target : level;
  }

  passageCells() {
    const records = this.connectors();
    if (this.passageSet && this.passageFor === records) return this.passageSet;
    const set = new Set();
    for (const record of records) {
      for (const end of [record && record.from, record && record.to]) {
        if (!end || !Number.isFinite(end.cx) || !Number.isFinite(end.cz)) continue;
        set.add(`${end.cx},${end.cz},${levelOf(end)}`);
      }
    }
    this.passageSet = set;
    this.passageFor = records;
    return set;
  }

  floorsLinkedNear(x, z, levelA, levelB) {
    return this.doorwayNear([[x, z]], levelA, levelB);
  }

  sharesDoorway(firstX, firstZ, secondX, secondZ, levelA, levelB) {
    return this.doorwayNear([[firstX, firstZ], [secondX, secondZ]], levelA, levelB);
  }

  seesAcrossFloors(viewer, thing) {
    if (viewer.level === thing.level) return true;
    if (!this.sharesDoorway(viewer.x, viewer.z, thing.x, thing.z, viewer.level, thing.level)) return false;
    return thing.y - viewer.y <= DOORWAY_SIGHT_HEIGHT;
  }

  floorsInSight(x, z, level) {
    const floors = [level];
    for (const record of this.connectors() || []) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const a = levelOf(from);
      const b = levelOf(to);
      if (a !== level && b !== level) continue;
      const other = a === level ? b : a;
      if (floors.includes(other)) continue;
      const doorX = ((from.cx + to.cx) / 2) * CELL_SIZE;
      const doorZ = ((from.cz + to.cz) / 2) * CELL_SIZE;
      if (Math.hypot(doorX - x, doorZ - z) <= FLOOR_LINK_RADIUS) floors.push(other);
    }
    return floors;
  }

  doorwayNear(points, levelA, levelB) {
    if (levelA === levelB) return true;
    for (const record of this.connectors() || []) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const a = levelOf(from);
      const b = levelOf(to);
      if (!((a === levelA && b === levelB) || (a === levelB && b === levelA))) continue;
      const doorX = ((from.cx + to.cx) / 2) * CELL_SIZE;
      const doorZ = ((from.cz + to.cz) / 2) * CELL_SIZE;
      if (points.every(([x, z]) => Math.hypot(doorX - x, doorZ - z) <= FLOOR_LINK_RADIUS)) return true;
    }
    return false;
  }

  isPassageAt(x, z, level = 0) {
    const { cx, cz } = worldToCellCoords(x, z);
    return this.passageCells().has(`${cx},${cz},${level}`);
  }

  isUnderRoof(x, z, level = 0) {
    const layout = this.layout();
    if (!layout) return false;
    const { cx, cz } = worldToCellCoords(x, z);
    return Number.isFinite(ceilingLiftAt(layout, cx, cz, level));
  }

  nearestWalkable(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const [cx, cz] of this.areaCells()) {
      const px = cx * CELL_SIZE;
      const pz = cz * CELL_SIZE;
      if (!this.isWalkableAt(px, pz)) continue;
      const dist = Math.hypot(px - x, pz - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: px, z: pz };
      }
    }
    return best;
  }
}
