// Část terénu: jeskyně — spoje mezi patry, vchody a strop, který se nad hráčem odkryje.
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { CELL_SIZE } from '../../utils/gridMath.js';
import { DOOR_LINTEL_DEPTH } from './runVolume.js';
import { columnsByCell, layerLiftAt, floorCellAt, caveOpensInto } from '../../data/maps/areaShape.js';

const OUTER_LIGHT_CELLS = 6;
const INNER_LIGHT_CELLS = 3;
const ROCK_MAX_ABOVE_CEILING = 3;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export default {
  showCaveRing(on) {
    const show = Boolean(on);
    if (show === this.caveRingOn && !this.caveRingDirty) return;
    this.caveRingOn = show;
    this.caveRingDirty = false;
    for (const mesh of this.surfaces) {
      if (mesh && !mesh.isDisposed() && (mesh.name || '').startsWith('terrainCaveRing')) mesh.setEnabled(show);
    }
  },
  caveWallFaces() {
    const columns = columnsByCell(this.layout || {});
    const doorSides = new Set();
    for (const door of this.caveDoors(true)) {
      doorSides.add(`${door.cx},${door.cz}|${door.dx},${door.dz}`);
      doorSides.add(`${door.cx + door.dx},${door.cz + door.dz}|${-door.dx},${-door.dz}`);
    }
    const faces = [];
    for (const [id, planes] of columns) {
      const [cx, cz] = id.split(',').map(Number);
      for (const plane of planes) {
        if (plane.level >= 0 || !Number.isFinite(plane.ceil)) continue;
        for (const [dx, dz] of SIDES) {
          if (doorSides.has(`${cx},${cz}|${dx},${dz}`)) continue;
          const wallX = cx + dx;
          const wallZ = cz + dz;
          if ((columns.get(`${wallX},${wallZ}`) || []).some((other) => other.level === plane.level)) continue;
          const alongX = dx !== 0 ? 0 : 1;
          const alongZ = dx !== 0 ? 1 : 0;
          faces.push({
            cx: wallX,
            cz: wallZ,
            dx: -dx,
            dz: -dz,
            x: (cx + dx / 2) * CELL_SIZE,
            z: (cz + dz / 2) * CELL_SIZE,
            top: plane.ceil,
            foot: plane.lift,
            lintel: false,
            inside: true,
            style: 'stone',
            doorBefore: doorSides.has(`${wallX - alongX},${wallZ - alongZ}|${-dx},${-dz}`),
            doorAfter: doorSides.has(`${wallX + alongX},${wallZ + alongZ}|${-dx},${-dz}`),
          });
        }
      }
    }
    return faces;
  },
  liveSurfaces() {
    return this.surfaces.filter((mesh) => mesh && !mesh.isDisposed());
  },
  caveLightMap() {
    const columns = columnsByCell(this.layout || {});
    const caveCells = new Set();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let lowestVisible = Infinity;
    for (const [id, planes] of columns) {
      const [cx, cz] = id.split(',').map(Number);
      for (const plane of planes) {
        if (plane.level < 0 && Number.isFinite(plane.ceil)) lowestVisible = Math.min(lowestVisible, plane.lift);
      }
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
        if (ground && columns.get(id).some((plane) => plane.level < 0 && Number.isFinite(plane.ceil) && ground.lift >= plane.ceil && ground.lift - plane.ceil <= ROCK_MAX_ABOVE_CEILING)) rockCells.add(sideId);
      }
    }
    const outerSeeds = [];
    const faces = [];
    const innerSeeds = [];
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
    const outdoors = (id) => {
      if (caveCells.has(id) || rockCells.has(id)) return false;
      const ground = (columns.get(id) || []).find((plane) => plane.level === 0);
      if (!ground) return false;
      const [cx, cz] = id.split(',').map(Number);
      const water = this.waterAtCell(cx, cz);
      if (water !== null && ground.lift <= water) return false;
      return faces.some((face) => (cx - face.cx) * face.dx + (cz - face.cz) * face.dz >= 0);
    };
    const lit = spread(outerSeeds, OUTER_LIGHT_CELLS, 0, outdoors);
    const lowestDoor = doorFloors.length ? Math.min(...doorFloors) : null;
    for (const [id, planes] of columns) {
      const ground = planes.find((plane) => plane.level === 0);
      if (!ground) continue;
      const [cx, cz] = id.split(',').map(Number);
      const litAt = (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ && data[indexOf(x, z) * 4] > 0;
      if (litAt(cx, cz) || SIDES.some(([dx, dz]) => litAt(cx + dx, cz + dz))) lowestVisible = Math.min(lowestVisible, ground.lift);
    }
    spread(innerSeeds, INNER_LIGHT_CELLS, 1, (id) => caveCells.has(id));
    return { data, width, height, minX, minZ, lit, floor: lowestDoor, lowestVisible };
  },

  caveDoors(underground = false) {
    const columns = columnsByCell(this.layout || {});
    const levelOf = (end) => (Number.isFinite(end.level) ? end.level : 0);
    const doors = new Map();
    const doorId = (cx, cz, dx, dz) => `${cx},${cz}|${dx},${dz}`;
    for (const record of this.movementConnectors || []) {
      if (!record || !record.from || !record.to || levelOf(record.from) === levelOf(record.to)) continue;
      const outside = levelOf(record.from) > levelOf(record.to) ? record.from : record.to;
      if (!underground && levelOf(outside) !== 0) continue;
      const inside = outside === record.from ? record.to : record.from;
      const dx = outside.cx - inside.cx;
      const dz = outside.cz - inside.cz;
      if (Math.abs(dx) + Math.abs(dz) !== 1) continue;
      const cave = (columns.get(`${inside.cx},${inside.cz}`) || []).find((plane) => plane.level === levelOf(inside));
      const ground = (columns.get(`${outside.cx},${outside.cz}`) || []).find((plane) => plane.level === levelOf(outside));
      if (!cave || !ground || !Number.isFinite(cave.ceil)) continue;
      const flanks = [[outside.cx - dz, outside.cz + dx], [outside.cx + dz, outside.cz - dx]];
      const style = flanks.map(([cx, cz]) => (this.field ? this.field.cliffStyleAt(cx, cz) : null)).find(Boolean) || 'dirt';
      doors.set(doorId(inside.cx, inside.cz, dx, dz), { cx: inside.cx, cz: inside.cz, dx, dz, level: levelOf(inside), otherLevel: levelOf(outside), floor: cave.lift, top: cave.ceil - DOOR_LINTEL_DEPTH, ground: ground.lift, style });
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
          if (nplanes.some((np) => np.level === caveLevel)) continue;
          for (const np of nplanes) {
            if (!caveOpensInto(np, caveFloor)) continue;
            const here = (end) => end.cx === cx && end.cz === cz && (Number.isFinite(end.level) ? end.level : 0) === caveLevel;
            const there = (end) => end.cx === cx + dx && end.cz === cz + dz && (Number.isFinite(end.level) ? end.level : 0) === np.level;
            if (records.some((record) => (here(record.to) && there(record.from)) || (here(record.from) && there(record.to)))) continue;
            records.push({ from: { cx: cx + dx, cz: cz + dz, level: np.level }, to: { cx, cz, level: caveLevel }, kind: 'opening' });
          }
        }
      }
    }
    return records;
  },
};
