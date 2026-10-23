// Cesty — položí na políčko plnou dlaždici hlíny, kamene nebo prken.
// Nic nevykrajuje, nic nepočítá: jedno políčko s cestou = jedna plná dlaždice.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE, cellKey } from '../utils/gridMath.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const PATH_LIFT = 0.01;
const HALF = CELL_SIZE / 2;
const HALF_WIDTH = CELL_SIZE / 4;
const UV_TILE = 1;

const STYLE_TEXTURES = {
  dirt: `${ASSET_DIRS.pathTextures}Ground071_1K-JPG_Color.jpg`,
  stone: `${ASSET_DIRS.pathTextures}PavingStones092_1K-JPG_Color.jpg`,
  wood: `${ASSET_DIRS.pathTextures}Planks004_1K-JPG_Color.jpg`,
};

function styleOf(entry) {
  return entry && entry.style ? entry.style : 'dirt';
}

export default class PathSystem {
  constructor(scene) {
    this.s = scene;
    this.meshes = [];
    this.materials = new Map();
    this.shapes = new Map();
  }

  clear() {
    for (const mesh of this.meshes) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.meshes = [];
    this.shapes.clear();
    this.dropUnusedMaterials();
  }

  dropUnusedMaterials() {
    const used = new Set(this.meshes.map((mesh) => mesh.material).filter(Boolean));
    for (const [key, material] of this.materials) {
      if (used.has(material)) continue;
      material.dispose(false, true);
      this.materials.delete(key);
    }
  }

  groundHeightAt(world, cx, cz) {
    const key = cellKey(cx, cz);
    for (const name of ['floor', 'clearing', 'grass']) {
      for (const entry of (world && world[name]) || []) {
        if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
        return entry.liftY || 0;
      }
    }
    return 0;
  }

  buildFromLayout(world) {
    this.clear();
    if (!world || !Array.isArray(world.path)) return;
    const cells = [];
    const pathKeys = new Set();
    for (const entry of world.path) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      pathKeys.add(cellKey(entry.cx, entry.cz));
    }
    for (const entry of world.path) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (this.shapes.has(key)) continue;
      const cell = {
        cx: entry.cx,
        cz: entry.cz,
        style: styleOf(entry),
        across: pathKeys.has(cellKey(entry.cx - 1, entry.cz)) || pathKeys.has(cellKey(entry.cx + 1, entry.cz)),
        y: Math.max(entry.liftY || 0, this.groundHeightAt(world, entry.cx, entry.cz)),
      };
      cells.push(cell);
      this.shapes.set(key, cell);
    }
    if (!cells.length) return;
    const groups = new Map();
    for (const cell of cells) {
      let list = groups.get(cell.style);
      if (!list) {
        list = { positions: [], indices: [], uvs: [] };
        groups.set(cell.style, list);
      }
      this.addTile(cell, list);
    }
    for (const [style, list] of groups) {
      if (!list.positions.length) continue;
      this.addMesh(`path_${style}`, list, this.materialFor(style));
    }
  }

  addTile(cell, list) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const y = cell.y + PATH_LIFT;
    const start = list.positions.length / 3;
    const corners = cell.across
      ? [[-HALF, -HALF_WIDTH], [HALF, -HALF_WIDTH], [HALF, HALF_WIDTH], [-HALF, HALF_WIDTH]]
      : [[-HALF_WIDTH, -HALF], [HALF_WIDTH, -HALF], [HALF_WIDTH, HALF], [-HALF_WIDTH, HALF]];
    for (const [dx, dz] of corners) {
      const px = x + dx;
      const pz = z + dz;
      list.positions.push(px, y, pz);
      list.uvs.push(px / UV_TILE, pz / UV_TILE);
    }
    list.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  addMesh(name, list, material) {
    const mesh = new Mesh(name, this.s);
    const data = new VertexData();
    data.positions = list.positions;
    data.indices = list.indices;
    data.uvs = list.uvs;
    data.normals = [];
    VertexData.ComputeNormals(list.positions, list.indices, data.normals);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    this.meshes.push(mesh);
    return mesh;
  }

  materialFor(key) {
    const cached = this.materials.get(key);
    if (cached) return cached;
    const material = new StandardMaterial(`path_${key}`, this.s);
    const texture = new Texture(STYLE_TEXTURES[key] || STYLE_TEXTURES.dirt, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = new Color3(0.12, 0.1, 0.08);
    this.materials.set(key, material);
    return material;
  }
}
