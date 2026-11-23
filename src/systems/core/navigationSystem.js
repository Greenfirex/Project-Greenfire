// Kudy se dá chodit — pochozí místa, přechody mezi patry po spojích, průchody a stropy nad hlavou.
// Sám nic nestaví; mapu, mosty, hloubku vody a výšku dekorací mu dodá scéna jako dotazy.
import { worldToCellCoords, CELL_SIZE } from '../../utils/gridMath.js';
import { worldCells, levelOfEntry, ceilingLiftAt, DOOR_WALK_HALF, DOOR_FRAME_DEPTH } from '../../data/maps/areaShape.js';

const FLOOR_LINK_RADIUS = 8;
const BODY_SAMPLES = 8;
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
    this.wallRiseAt = null;
    this.cliffOverlapAt = null;
    this.buildingGapAt = null;
    this.objectGapAt = null;
    this.stepLimit = Infinity;
    this.areaLookup = null;
    this.floorSets = new Map();
    this.floorSetsFor = null;
    this.connectorMap = null;
    this.connectorMapFor = null;
    this.passageSet = null;
    this.passageFor = null;
    this.doorwayList = null;
    this.doorwayFor = null;
    this.caveSet = null;
    this.caveSetFor = null;
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

  hasCaveAt(cx, cz) {
    const layout = this.layout();
    if (this.caveSetFor !== layout) {
      this.caveSetFor = layout;
      this.caveSet = new Set();
      for (const entry of (layout && layout.floor) || []) {
        if (entry && levelOfEntry(entry) !== 0) this.caveSet.add(`${entry.cx},${entry.cz}`);
      }
    }
    return this.caveSet.has(`${cx},${cz}`);
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

  doorways() {
    const records = this.connectors();
    if (this.doorwayList && this.doorwayFor === records) return this.doorwayList;
    const list = [];
    for (const record of records) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to || levelOf(from) === levelOf(to)) continue;
      const dx = to.cx - from.cx;
      const dz = to.cz - from.cz;
      if (Math.abs(dx) + Math.abs(dz) !== 1) continue;
      list.push({ x: ((from.cx + to.cx) / 2) * CELL_SIZE, z: ((from.cz + to.cz) / 2) * CELL_SIZE, dx, dz });
    }
    this.doorwayList = list;
    this.doorwayFor = records;
    return list;
  }

  inDoorFrame(x, z) {
    for (const door of this.doorways()) {
      const rx = x - door.x;
      const rz = z - door.z;
      const along = Math.abs(rx * door.dx + rz * door.dz);
      const across = Math.abs(rx * door.dz - rz * door.dx);
      if (along < DOOR_FRAME_DEPTH && across > DOOR_WALK_HALF && across <= CELL_SIZE / 2) return true;
    }
    return false;
  }

  isWalkableAt(x, z, level = 0) {
    if (level === 0 && this.onBridge(x, z)) return true;
    if (level === 0 && this.tooDeep(x, z)) return false;
    if (this.inDoorFrame(x, z)) return false;
    const { cx, cz } = worldToCellCoords(x, z);
    if (this.floorCells(level).has(`${cx},${cz}`)) return true;
    if (level !== 0) return false;
    if (!this.areaLookup) {
      this.areaLookup = new Set(this.areaCells().map(([ax, az]) => `${ax},${az}`));
    }
    if (!this.areaLookup.has(`${cx},${cz}`)) return false;
    return !this.topAt || this.topAt(cx, cz) < WALK_CLEARANCE;
  }

  bodyFree(x, z, level, here, body, relaxed = false) {
    const reach = body.radius + body.margin;
    if (this.buildingGapAt) {
      const gap = this.buildingGapAt(x, z, here.feetY, level);
      if (gap < reach && gap < this.buildingGapAt(here.x, here.z, here.feetY, here.level)) return false;
    }
    if (relaxed) return true;
    if (!this.isWalkableAt(x, z, level)) return false;
    if (this.objectGapAt) {
      const gap = this.objectGapAt(x, z, reach, level);
      if (gap < 0 && gap < this.objectGapAt(here.x, here.z, reach, here.level)) return false;
    }
    if (this.isPassageAt(x, z, level)) return true;
    const worse = (measure) => {
      const there = measure(x, z, level);
      return there > 0 && there >= measure(here.x, here.z, here.level);
    };
    if (this.cliffOverlapAt && worse((px, pz, floor) => this.cliffOverlapAt(px, pz, floor))) return false;
    if (level !== 0 && !this.bodyFits(x, z, level, body.radius) && this.bodyFits(here.x, here.z, here.level, body.radius)) return false;
    if (this.wallRiseAt) {
      const rise = this.wallRiseAt(x, z, reach, level);
      if (rise > this.stepLimit && rise >= this.wallRiseAt(here.x, here.z, reach, here.level)) return false;
    }
    return true;
  }

  objectInWay(x, z, radius, level) {
    return Boolean(this.objectGapAt) && this.objectGapAt(x, z, radius, level) < 0;
  }

  bodyFits(x, z, level, radius) {
    for (let index = 0; index < BODY_SAMPLES; index += 1) {
      const angle = (index / BODY_SAMPLES) * Math.PI * 2;
      if (!this.isWalkableAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, level)) return false;
    }
    return true;
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

  doorsBetween(fromLevel, toLevel) {
    const doors = [];
    for (const record of this.connectors()) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const [near, far] = levelOf(from) === fromLevel && levelOf(to) === toLevel ? [from, to]
        : levelOf(to) === fromLevel && levelOf(from) === toLevel ? [to, from] : [null, null];
      if (!near) continue;
      doors.push({
        x: ((near.cx + far.cx) / 2) * CELL_SIZE,
        z: ((near.cz + far.cz) / 2) * CELL_SIZE,
        farX: far.cx * CELL_SIZE,
        farZ: far.cz * CELL_SIZE,
      });
    }
    return doors;
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
