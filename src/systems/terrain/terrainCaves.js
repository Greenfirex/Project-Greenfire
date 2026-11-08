// Část terénu: jeskyně — spoje mezi patry, vchody a strop, který se nad hráčem odkryje.
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { CELL_SIZE } from '../../utils/gridMath.js';
import { DOOR_LINTEL_DEPTH } from './runVolume.js';
import { columnsByCell, layerLiftAt, floorCellAt } from '../../data/maps/areaShape.js';

const CAVE_OPEN_STEP = 0.6;
const OUTER_LIGHT_CELLS = 6;
const INNER_LIGHT_CELLS = 3;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export default {
  caveMeshes() {
    const list = [];
    for (const mesh of this.surfaces) {
      if (!mesh || mesh.isDisposed()) continue;
      const name = mesh.name || '';
      if (name.startsWith('terrainCaveWall') || name.startsWith('terrainCeiling')) {
        list.push(mesh);
      }
    }
    return list;
  },
  caveLightMap() {
    const columns = columnsByCell(this.layout || {});
    const caveCells = new Set();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [id, planes] of columns) {
      const [cx, cz] = id.split(',').map(Number);
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minZ = Math.min(minZ, cz);
      maxZ = Math.max(maxZ, cz);
      if (planes.some((plane) => plane.level < 0 && Number.isFinite(plane.ceil))) caveCells.add(id);
    }
    const rockCells = new Set();
    for (const id of caveCells) {
      const [cx, cz] = id.split(',').map(Number);
      for (const [dx, dz] of SIDES) {
        const sideId = `${cx + dx},${cz + dz}`;
        if (caveCells.has(sideId)) continue;
        const ground = (columns.get(sideId) || []).find((plane) => plane.level === 0);
        if (ground && columns.get(id).some((plane) => plane.level < 0 && Number.isFinite(plane.ceil) && ground.lift >= plane.ceil)) rockCells.add(sideId);
      }
    }
    const outerSeeds = [];
    const faces = [];
    const innerSeeds = [];
    const doors = [];
    const doorFloors = [];
    const levelOf = (end) => (Number.isFinite(end.level) ? end.level : 0);
    for (const record of this.movementConnectors || []) {
      if (!record || !record.from || !record.to || levelOf(record.from) === levelOf(record.to)) continue;
      const outside = levelOf(record.from) === 0 ? record.from : (levelOf(record.to) === 0 ? record.to : null);
      if (!outside) continue;
      const inside = outside === record.from ? record.to : record.from;
      if (caveCells.has(`${outside.cx},${outside.cz}`)) continue;
      outerSeeds.push([outside.cx, outside.cz]);
      faces.push({ cx: outside.cx, cz: outside.cz, dx: outside.cx - inside.cx, dz: outside.cz - inside.cz });
      innerSeeds.push([inside.cx, inside.cz]);
      const insidePlane = (columns.get(`${inside.cx},${inside.cz}`) || []).find((plane) => plane.level === levelOf(inside));
      if (insidePlane) doorFloors.push(insidePlane.lift);
      doors.push({ cx: inside.cx, cz: inside.cz, dx: inside.cx - outside.cx, dz: inside.cz - outside.cz });
    }
    if (!outerSeeds.length) return null;
    minX -= OUTER_LIGHT_CELLS;
    maxX += OUTER_LIGHT_CELLS;
    minZ -= OUTER_LIGHT_CELLS;
    maxZ += OUTER_LIGHT_CELLS;
    const width = maxX - minX + 1;
    const height = maxZ - minZ + 1;
    const data = new Uint8Array(width * height * 4);
    const indexOf = (cx, cz) => (cz - minZ) * width + (cx - minX);
    for (let cz = minZ; cz <= maxZ; cz += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        if (!caveCells.has(`${cx},${cz}`)) data[indexOf(cx, cz) * 4 + 3] = 255;
      }
    }
    const spread = (seeds, reach, channel, allowed) => {
      let frontier = seeds;
      const seen = new Set();
      let lit = 0;
      const nearestSeed = (cx, cz) => Math.min(...seeds.map(([sx, sz]) => Math.hypot(cx - sx, cz - sz)));
      for (let distance = 0; distance < Math.ceil(reach * 1.5) && frontier.length; distance += 1) {
        const next = [];
        for (const [cx, cz] of frontier) {
          const id = `${cx},${cz}`;
          if (seen.has(id) || cx < minX || cx > maxX || cz < minZ || cz > maxZ || !allowed(id)) continue;
          seen.add(id);
          const strength = 1 - nearestSeed(cx, cz) / reach;
          if (strength > 0) {
            data[indexOf(cx, cz) * 4 + channel] = Math.round(255 * strength);
            lit += 1;
          }
          next.push([cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]);
        }
        frontier = next;
      }
      return lit;
    };
    const waterLevel = Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : -Infinity;
    const outdoors = (id) => {
      if (caveCells.has(id) || rockCells.has(id)) return false;
      const ground = (columns.get(id) || []).find((plane) => plane.level === 0);
      if (!ground || ground.lift <= waterLevel) return false;
      const [cx, cz] = id.split(',').map(Number);
      return faces.some((face) => (cx - face.cx) * face.dx + (cz - face.cz) * face.dz >= 0);
    };
    const lit = spread(outerSeeds, OUTER_LIGHT_CELLS, 0, outdoors);
    const lowestDoor = doorFloors.length ? Math.min(...doorFloors) : null;
    for (const [id, planes] of columns) {
      const ground = planes.find((plane) => plane.level === 0);
      if (lowestDoor === null || !ground || ground.lift < lowestDoor) continue;
      const [cx, cz] = id.split(',').map(Number);
      const index = indexOf(cx, cz) * 4;
      if (!data[index + 3] || !data[index]) continue;
      let lowest = ground.lift;
      for (const ox of [-0.5, 0, 0.5]) {
        for (const oz of [-0.5, 0, 0.5]) {
          if (this.field) lowest = Math.min(lowest, this.field.heightAtSide((cx + ox) * CELL_SIZE, (cz + oz) * CELL_SIZE, cx, cz));
        }
      }
      if (lowest >= lowestDoor) data[index + 1] = 255;
    }
    const inFrontOfDoor = (id) => {
      if (!caveCells.has(id)) return false;
      const [cx, cz] = id.split(',').map(Number);
      return doors.some((door) => {
        const rx = cx - door.cx;
        const rz = cz - door.cz;
        const inward = rx * door.dx + rz * door.dz;
        const across = Math.abs(rx * door.dz - rz * door.dx);
        return inward >= across;
      });
    };
    spread(innerSeeds, INNER_LIGHT_CELLS, 1, inFrontOfDoor);
    return { data, width, height, minX, minZ, lit, floor: lowestDoor };
  },

  caveDoors() {
    const columns = columnsByCell(this.layout || {});
    const levelOf = (end) => (Number.isFinite(end.level) ? end.level : 0);
    const doors = new Map();
    const doorId = (cx, cz, dx, dz) => `${cx},${cz}|${dx},${dz}`;
    for (const record of this.movementConnectors || []) {
      if (!record || !record.from || !record.to || levelOf(record.from) === levelOf(record.to)) continue;
      const outside = levelOf(record.from) === 0 ? record.from : (levelOf(record.to) === 0 ? record.to : null);
      if (!outside) continue;
      const inside = outside === record.from ? record.to : record.from;
      const dx = outside.cx - inside.cx;
      const dz = outside.cz - inside.cz;
      if (Math.abs(dx) + Math.abs(dz) !== 1) continue;
      const cave = (columns.get(`${inside.cx},${inside.cz}`) || []).find((plane) => plane.level === levelOf(inside));
      const ground = (columns.get(`${outside.cx},${outside.cz}`) || []).find((plane) => plane.level === 0);
      if (!cave || !ground || !Number.isFinite(cave.ceil)) continue;
      const flanks = [[outside.cx - dz, outside.cz + dx], [outside.cx + dz, outside.cz - dx]];
      const style = flanks.map(([cx, cz]) => (this.field ? this.field.cliffStyleAt(cx, cz) : null)).find(Boolean) || 'dirt';
      doors.set(doorId(inside.cx, inside.cz, dx, dz), { cx: inside.cx, cz: inside.cz, dx, dz, level: levelOf(inside), floor: cave.lift, top: cave.ceil - DOOR_LINTEL_DEPTH, ground: ground.lift, style });
    }
    return [...doors.values()].map((door) => ({
      ...door,
      openLeft: doors.has(doorId(door.cx - door.dz, door.cz + door.dx, door.dx, door.dz)),
      openRight: doors.has(doorId(door.cx + door.dz, door.cz - door.dx, door.dx, door.dz)),
    }));
  },

  connectorInfo() {
    const layout = this.layout || {};
    const mouths = new Map();
    const levelOf = (end) => (end && Number.isFinite(end.level) ? end.level : 0);
    const mouthFor = (end, dx, dz) => {
      const entry = floorCellAt(layout, end.cx, end.cz, levelOf(end));
      if (!entry || !Number.isFinite(entry.ceilY)) return;
      const bottom = entry.liftY || 0;
      if (entry.ceilY <= bottom) return;
      mouths.set(`${end.cx},${end.cz}|${dx},${dz}`, { bottom, top: entry.ceilY });
    };
    const liftAt = (end, loose) => {
      const lift = layerLiftAt(layout, end.cx, end.cz, levelOf(end));
      if (lift !== null) return lift;
      if (!loose || !this.field) return null;
      const height = this.field.heightAt(end.cx * CELL_SIZE, end.cz * CELL_SIZE, levelOf(end));
      return Number.isFinite(height) ? height : null;
    };
    const records = this.effectiveConnectors();
    this.movementConnectors = records;
    for (const record of records) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const vertical = from.cx === to.cx && from.cz === to.cz;
      const fromLift = liftAt(from, vertical);
      const toLift = liftAt(to, vertical);
      if (fromLift === null || toLift === null) continue;
      if (vertical) continue;
      const dx = Math.sign(to.cx - from.cx);
      const dz = Math.sign(to.cz - from.cz);
      mouthFor(from, dx, dz);
      mouthFor(to, -dx, -dz);
    }
    return { mouths };
  },

  effectiveConnectors() {
    const explicit = (this.layout && this.layout.connectors) || [];
    const records = explicit
      .filter((record) => record && record.from && record.to)
      .map((record) => ({ from: { ...record.from }, to: { ...record.to }, kind: record.kind }));
    const columns = columnsByCell(this.layout || {});
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [id, planes] of columns) {
      const [cx, cz] = id.split(',').map(Number);
      for (const plane of planes) {
        if (plane.level >= 0 || !Number.isFinite(plane.ceil)) continue;
        const caveLevel = plane.level;
        const caveFloor = plane.lift;
        for (const [dx, dz] of dirs) {
          const nplanes = columns.get(`${cx + dx},${cz + dz}`);
          if (!nplanes) continue;
          let nGround = null;
          let nHasCave = false;
          for (const np of nplanes) {
            if (np.level === 0) nGround = np.lift;
            if (np.level === caveLevel) nHasCave = true;
          }
          if (nHasCave || nGround === null) continue;
          if (Math.abs(caveFloor - nGround) > CAVE_OPEN_STEP) continue;
          const exists = records.some((record) => {
            const fl = Number.isFinite(record.from.level) ? record.from.level : 0;
            const tl = Number.isFinite(record.to.level) ? record.to.level : 0;
            const fro = record.from;
            const too = record.to;
            return (too.cx === cx && too.cz === cz && tl === caveLevel && fro.cx === cx + dx && fro.cz === cz + dz)
              || (fro.cx === cx && fro.cz === cz && fl === caveLevel && too.cx === cx + dx && too.cz === cz + dz);
          });
          if (exists) continue;
          records.push({ from: { cx: cx + dx, cz: cz + dz, level: 0 }, to: { cx, cz, level: caveLevel }, kind: 'opening' });
        }
      }
    }
    return records;
  },
};
