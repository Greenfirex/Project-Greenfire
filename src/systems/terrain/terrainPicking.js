// Část terénu: neviditelná vrstva pro klikání a čáry mřížky (klávesa G).
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { color3 } from './terrainSettings.js';

const PICK_LIFT = 0.002;
const GRID_LIFT = 0.02;
const GRID_SUB = 2;

export default {
  pickCells() {
    const cells = (this.realCells || []).slice();
    const seen = new Set(cells.map(([cx, cz]) => `${cx},${cz}`));
    for (const entry of (this.layout || {}).path || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const key = `${entry.cx},${entry.cz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push([entry.cx, entry.cz]);
    }
    return cells;
  },

  createPicker(cells) {
    if (this.ground && !this.ground.isDisposed()) this.ground.dispose(false, false);
    const points = [];
    const indices = [];
    const spot = new Map();
    const slot = (px, pz) => {
      const id = `${px},${pz}`;
      if (!spot.has(id)) {
        spot.set(id, points.length / 3);
        points.push(px, PICK_LIFT, pz);
      }
      return spot.get(id);
    };
    for (const [cx, cz] of cells) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      const a = slot(x - 1, z - 1);
      const b = slot(x + 1, z - 1);
      const c = slot(x + 1, z + 1);
      const d = slot(x - 1, z + 1);
      indices.push(a, c, b, a, d, c);
    }
    const ground = new Mesh('gridGround', this.s);
    const data = new VertexData();
    data.positions = points;
    data.indices = indices;
    data.applyToMesh(ground);
    ground.isPickable = true;
    ground.isVisible = false;
    this.ground = ground;
  },

  createGridLines(map, cells) {
    const edges = new Map();
    const add = (x1, z1, x2, z2) => {
      const id = `${x1},${z1},${x2},${z2}`;
      const back = `${x2},${z2},${x1},${z1}`;
      if (edges.has(back)) {
        edges.delete(back);
        return;
      }
      const y1 = this.heightAt(x1, z1) + GRID_LIFT;
      const y2 = this.heightAt(x2, z2) + GRID_LIFT;
      edges.set(id, [new Vector3(x1, y1, z1), new Vector3(x2, y2, z2)]);
    };
    const step = CELL_SIZE / GRID_SUB;
    const half = CELL_SIZE / 2;
    for (const [cx, cz] of cells) {
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (let i = 0; i < GRID_SUB; i += 1) {
        const a = i * step;
        const b = (i + 1) * step;
        add(x0 + a, z0, x0 + b, z0);
        add(x0 + a, z0 + CELL_SIZE, x0 + b, z0 + CELL_SIZE);
        add(x0, z0 + a, x0, z0 + b);
        add(x0 + CELL_SIZE, z0 + a, x0 + CELL_SIZE, z0 + b);
      }
    }

    if (this.gridLines && !this.gridLines.isDisposed()) this.gridLines.dispose(false, false);
    const lines = MeshBuilder.CreateLineSystem('terrainGridLines', { lines: [...edges.values()] }, this.s);
    lines.color = color3(map.colors.gridLine);
    lines.alpha = 0.22;
    lines.isPickable = false;
    lines.setEnabled(this.gridVisible);
    return lines;
  },

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    if (this.gridLines && !this.gridLines.isDisposed()) this.gridLines.setEnabled(this.gridVisible);
    return this.gridVisible;
  },
};
