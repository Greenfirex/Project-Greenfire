// Terén krajiny — podkladová plocha podle druhu povrchu a neviditelná vrstva pro klikání.
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
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { groundCells, worldCells, floorCellAt, layerLiftAt } from '../data/maps/areaShape.js';

const PICK_LIFT = 0.002;
const GRID_LIFT = 0.02;

function toHeight(lift) {
  if (!Number.isFinite(lift) || Math.abs(lift) < 0.001) return 0;
  return Math.round(lift * 1000) / 1000;
}

function color3(rgb) {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

export default class TerrainSystem {

  constructor(scene) {
    this.s = scene;
    this.ground = null;
    this.surfaces = [];
    this.materials = new Map();
    this.gridLines = null;
    this.mapKey = null;
    this.ready = Promise.resolve(null);
  }

  whenReady() {
    return this.ready || Promise.resolve();
  }

  clear() {
    for (const mesh of [this.ground, this.gridLines, ...this.surfaces]) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.ground = null;
    this.surfaces = [];
    this.gridLines = null;
    this.groundCells = [];
    this.realCells = [];
  }

  create(mapKey, world = null, extraCells = null) {
    const map = getMap(mapKey);
    if (!map) return null;

    if (this.mapKey && this.mapKey !== mapKey) this.disposeMaterials();
    this.mapKey = mapKey;
    this.layout = world;
    this.groundCells = groundCells(world);
    this.realCells = worldCells(world);
    this.createSurface(map, this.groundCells);
    this.createPicker(this.pickCells());
    this.gridLines = this.createGridLines(map, this.realCells);
    this.ready = Promise.resolve(this.surfaces);
    return this.surfaces;
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
    for (const mesh of this.surfaces) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.surfaces = [];

    const heights = this.cellHeights();
    const tint = new Color3(0.72, 0.7, 0.64);
    const groups = new Map();
    const groupFor = (key) => {
      let group = groups.get(key);
      if (!group) {
        group = { positions: [], indices: [], uvs: [], colors: [] };
        groups.set(key, group);
      }
      return group;
    };
    const slot = (group, x, lift, z, tile) => {
      const index = group.positions.length / 3;
      group.positions.push(x, lift, z);
      group.uvs.push(x / tile, z / tile);
      group.colors.push(tint.r, tint.g, tint.b, lift ? 0.55 : 1);
      return index;
    };

    for (const [cx, cz] of cells) {
      const floor = floorCellAt(this.layout, cx, cz);
      const key = floor && floor.key ? floor.key : DEFAULT_FLOOR;
      const cfg = this.surfaceConfig(key);
      if (!cfg) continue;
      const group = groupFor(key);
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      const lift = heights.get(`${cx},${cz}`) || 0;
      const a = slot(group, x - 1, lift, z - 1, cfg.tile);
      const b = slot(group, x + 1, lift, z - 1, cfg.tile);
      const c = slot(group, x + 1, lift, z + 1, cfg.tile);
      const d = slot(group, x - 1, lift, z + 1, cfg.tile);
      group.indices.push(a, b, c, a, c, d);
    }

    for (const [key, group] of groups) {
      if (!group.positions.length) continue;
      const mesh = new Mesh(key === DEFAULT_FLOOR ? 'terrainSurface' : `terrainSurface_${key}`, this.s);
      const data = new VertexData();
      data.positions = group.positions;
      data.indices = group.indices;
      data.uvs = group.uvs;
      data.colors = group.colors;
      data.normals = [];
      VertexData.ComputeNormals(group.positions, group.indices, data.normals);
      data.applyToMesh(mesh);
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.material = this.materialFor(key, map);
      this.surfaces.push(mesh);
    }
  }

  surfaceConfig(key) {
    const def = getDecoration(key);
    if (def && def.surface && def.surface.texture) return def.surface;
    const fallback = getDecoration(DEFAULT_FLOOR);
    return fallback && fallback.surface && fallback.surface.texture ? fallback.surface : null;
  }

  materialFor(key, map) {
    const cached = this.materials.get(key);
    if (cached) return cached;
    const cfg = this.surfaceConfig(key);
    const material = new StandardMaterial(`terrainSurfaceMat_${key}`, this.s);
    material.diffuseTexture = new Texture(cfg.texture, this.s);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
    material.useVertexColor = true;
    material.diffuseColor = color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
    this.materials.set(key, material);
    return material;
  }

  disposeMaterials() {
    for (const material of this.materials.values()) {
      if (material) material.dispose(false, true);
    }
    this.materials.clear();
  }

  cellHeight(cx, cz) {
    return toHeight(layerLiftAt(this.layout, cx, cz));
  }

  cellHeights() {
    const heights = new Map();
    for (const [cx, cz] of this.realCells || []) {
      const height = this.cellHeight(cx, cz);
      if (height) heights.set(`${cx},${cz}`, height);
    }
    return heights;
  }

  tintOf(map) {
    const tone = map.colors.surfaceTint || [0.5, 0.62, 0.45];
    return [tone[0] * 2, tone[1] * 2, tone[2] * 2];
  }

  createGridLines(map, cells) {
    const edges = new Map();
    const add = (x1, y1, z1, x2, y2, z2) => {
      const id = `${x1},${y1},${z1},${x2},${y2},${z2}`;
      const back = `${x2},${y2},${z2},${x1},${y1},${z1}`;
      if (edges.has(back)) {
        edges.delete(back);
        return;
      }
      edges.set(id, [new Vector3(x1, y1, z1), new Vector3(x2, y2, z2)]);
    };
    for (const [cx, cz] of cells) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      const y = this.cellHeight(cx, cz) + GRID_LIFT;
      add(x - 1, y, z - 1, x + 1, y, z - 1);
      add(x + 1, y, z - 1, x + 1, y, z + 1);
      add(x + 1, y, z + 1, x - 1, y, z + 1);
      add(x - 1, y, z + 1, x - 1, y, z - 1);
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
