// Terén krajiny — podkladová plocha s texturou trávy a neviditelná vrstva pro klikání.
// Tuhle plochu pod stromy, cestami a trávou vidíš jen v místech, kde nic nestojí.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE } from '../utils/gridMath.js';
import { getMap } from '../data/catalogs/maps.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import { groundCells, worldCells } from '../data/maps/areaShape.js';

const GRASS_TEXTURE = `${ASSET_DIRS.textures}Grass004_1K-JPG_Color.jpg`;
const GRASS_TILE = 5.5;
const PICK_LIFT = 0.002;

function color3(rgb) {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

export default class TerrainSystem {

  constructor(scene) {
    this.s = scene;
    this.ground = null;
    this.surface = null;
    this.surfaceMaterial = null;
    this.gridLines = null;
    this.mapKey = null;
    this.ready = Promise.resolve(null);
  }

  whenReady() {
    return this.ready || Promise.resolve();
  }

  clear() {
    for (const mesh of [this.ground, this.surface, this.gridLines]) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.ground = null;
    this.surface = null;
    this.gridLines = null;
    this.groundCells = [];
    this.realCells = [];
  }

  create(mapKey, world = null, extraCells = null) {
    const map = getMap(mapKey);
    if (!map) return null;

    this.mapKey = mapKey;
    this.layout = world;
    this.groundCells = groundCells(world);
    this.realCells = worldCells(world);
    this.createSurface(map, this.groundCells);
    this.createPicker(this.pickCells());
    this.gridLines = this.createGridLines(map, this.realCells);
    this.ready = Promise.resolve(this.surface);
    return this.surface;
  }

  reachCells(step = 14) {
    const cells = this.realCells || [];
    if (!cells.length) return [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [cx, cz] of cells) {
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minZ = Math.min(minZ, cz);
      maxZ = Math.max(maxZ, cz);
    }
    const out = [];
    for (let cx = minX - step; cx <= maxX + step; cx += 1) {
      for (let cz = minZ - step; cz <= maxZ + step; cz += 1) out.push([cx, cz]);
    }
    return out;
  }

  cellsSignature(cells) {
    return cells.map(([cx, cz]) => `${cx},${cz}`).sort().join(';');
  }

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
  }

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
  }

  createSurface(map, cells) {
    if (this.surface && !this.surface.isDisposed()) this.surface.dispose(false, false);

    const heights = new Map();
    for (const entry of (this.layout && this.layout.floor) || []) {
      if (entry.liftY > 0) heights.set(`${entry.cx},${entry.cz}`, entry.liftY);
    }

    const positions = [];
    const indices = [];
    const uvs = [];
    const colors = [];
    const spot = new Map();
    const tint = new Color3(0.72, 0.7, 0.64);
    const slot = (px, pz, lift) => {
      const id = `${px},${pz}`;
      if (!spot.has(id)) {
        spot.set(id, positions.length / 3);
        positions.push(px, 0, pz);
        uvs.push(px / GRASS_TILE, pz / GRASS_TILE);
        colors.push(tint.r, tint.g, tint.b, lift ? 0.55 : 1);
      }
      return spot.get(id);
    };
    for (const [cx, cz] of cells) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      const lift = heights.get(`${cx},${cz}`) || 0;
      const a = slot(x - 1, z - 1, lift);
      const b = slot(x + 1, z - 1, lift);
      const c = slot(x + 1, z + 1, lift);
      const d = slot(x - 1, z + 1, lift);
      indices.push(a, b, c, a, c, d);
    }

    const mesh = new Mesh('terrainSurface', this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.uvs = uvs;
    data.colors = colors;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    mesh.receiveShadows = true;

    if (!this.surfaceMaterial) {
      this.surfaceMaterial = new StandardMaterial('terrainSurfaceMat', this.s);
      this.surfaceMaterial.diffuseTexture = new Texture(GRASS_TEXTURE, this.s);
      this.surfaceMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
      this.surfaceMaterial.ambientColor = new Color3(0.08, 0.1, 0.08);
      this.surfaceMaterial.useVertexColor = true;
    }
    this.surfaceMaterial.diffuseColor = color3(this.tintOf(map));
    mesh.material = this.surfaceMaterial;
    this.surface = mesh;
  }

  tintOf(map) {
    const tone = map.colors.surfaceTint || [0.5, 0.62, 0.45];
    return [tone[0] * 2, tone[1] * 2, tone[2] * 2];
  }

  createGridLines(map, cells) {
    const edges = new Map();
    const add = (x1, z1, x2, z2) => {
      const id = `${x1},${z1},${x2},${z2}`;
      const back = `${x2},${z2},${x1},${z1}`;
      if (edges.has(back)) {
        edges.delete(back);
        return;
      }
      edges.set(id, [new Vector3(x1, 0.02, z1), new Vector3(x2, 0.02, z2)]);
    };
    for (const [cx, cz] of cells) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      add(x - 1, z - 1, x + 1, z - 1);
      add(x + 1, z - 1, x + 1, z + 1);
      add(x + 1, z + 1, x - 1, z + 1);
      add(x - 1, z + 1, x - 1, z - 1);
    }

    if (this.gridLines && !this.gridLines.isDisposed()) this.gridLines.dispose(false, false);
    const lines = MeshBuilder.CreateLineSystem('terrainGridLines', { lines: [...edges.values()] }, this.s);
    lines.color = color3(map.colors.gridLine);
    lines.alpha = 0.22;
    lines.isPickable = false;
    return lines;
  }

  toggleGrid() {
    if (!this.gridLines) return false;
    this.gridLines.setEnabled(!this.gridLines.isEnabled());
    return this.gridLines.isEnabled();
  }
}
