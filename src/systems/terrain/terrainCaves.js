// Část terénu: jeskyně — spoje mezi patry, vchody a strop, který se nad hráčem odkryje.
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { columnsByCell, layerLiftAt, floorCellAt } from '../../data/maps/areaShape.js';

const CAVE_OPEN_STEP = 0.6;

export default {
  caveMeshes() {
    const list = [];
    for (const mesh of this.surfaces) {
      if (!mesh || mesh.isDisposed()) continue;
      const name = mesh.name || '';
      if (name.startsWith('terrainCaveWall') || name.startsWith('terrainCeiling') || name.includes('_L-')) {
        list.push(mesh);
      }
    }
    return list;
  },

  createCaveReveal(map) {
    const columns = columnsByCell(this.layout || {});
    const roofs = new Map();
    for (const [id, planes] of columns) {
      let top = null;
      let ceil = null;
      for (const plane of planes) {
        if (plane.level === 0 && top === null) top = plane.lift;
        if (plane.level < 0 && Number.isFinite(plane.ceil)) ceil = plane.ceil;
      }
      if (top === null || ceil === null || top <= ceil) continue;
      roofs.set(id, { top, ceil });
    }
    this.caveRoofCells = new Set(roofs.keys());
    if (!roofs.size) return;
    const half = CELL_SIZE / 2;
    const positions = [];
    const indices = [];
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => {
      const start = positions.length / 3;
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    for (const [id, info] of roofs) {
      const [cx, cz] = id.split(',').map(Number);
      const x0 = cx * CELL_SIZE - half;
      const x1 = x0 + CELL_SIZE;
      const z0 = cz * CELL_SIZE - half;
      const z1 = z0 + CELL_SIZE;
      const b = info.ceil;
      const t = info.top;
      if (!roofs.has(`${cx + 1},${cz}`)) quad(x1, b, z0, x1, b, z1, x1, t, z1, x1, t, z0);
      if (!roofs.has(`${cx - 1},${cz}`)) quad(x0, b, z0, x0, b, z1, x0, t, z1, x0, t, z0);
      if (!roofs.has(`${cx},${cz + 1}`)) quad(x0, b, z1, x1, b, z1, x1, t, z1, x0, t, z1);
      if (!roofs.has(`${cx},${cz - 1}`)) quad(x0, b, z0, x1, b, z0, x1, t, z0, x0, t, z0);
    }
    if (!positions.length) return;
    const normals = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new Mesh('terrainCaveRim', this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    let material = this.materials.get('caveRim');
    if (!material) {
      material = new StandardMaterial('terrainCaveRimMat', this.s);
      material.diffuseColor = new Color3(0.34, 0.31, 0.28);
      material.specularColor = new Color3(0, 0, 0);
      material.ambientColor = new Color3(0.1, 0.1, 0.1);
      material.backFaceCulling = false;
      this.materials.set('caveRim', material);
    }
    mesh.material = material;
    mesh.metadata = { caveRim: true };
    mesh.setEnabled(false);
    this.surfaces.push(mesh);
    this.caveRimMesh = mesh;
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
