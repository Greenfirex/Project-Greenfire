// Hustá divoká vegetace mimo cesty — tráva, keře a květiny rozházené po volné půdě.
// Tráva se rozsází jednou při stavbě mapy po celé ploše a pak se jen kreslí a houpe ve větru.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CELL_SIZE, worldToCell } from '../utils/gridMath.js';
import { loadModel, instantiateModel, getLoadedModels } from '../utils/assetLoader.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import { createGrassMaterial, tickGrass } from './grassShader.js';

const BLADE_HEIGHT = CELL_SIZE * 0.22;
const BLADE_SEGMENTS = 3;
const BLADE_WIDTH = CELL_SIZE * 0.028;
const PER_TILE = { off: 0, medium: 120, high: 220 };
const BLADE_CAP = 40000;
const GRASS_BASE_TONE = new Color3(0.1, 0.24, 0.06);
const SCATTER_KEYS = ['bush_small', 'flower', 'flower_red', 'mushroom_red', 'mushroom_tan'];
const SCATTER_MODELS = {
  bush: `${ASSET_DIRS.plants}plant_bush.glb`,
  bush_small: `${ASSET_DIRS.plants}plant_bushSmall.glb`,
  flower: `${ASSET_DIRS.plants}flower_purpleA.glb`,
  flower_red: `${ASSET_DIRS.plants}flower_redA.glb`,
  mushroom_red: `${ASSET_DIRS.plants}mushroom_red.glb`,
  mushroom_tan: `${ASSET_DIRS.plants}mushroom_tan.glb`,
};
const SCATTER_CHANCE = 0.06;
const BUSH_CHANCE = 0.5;
const GRASS_LIFT = 0.02;

function bladeShape() {
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  for (let s = 0; s <= BLADE_SEGMENTS; s += 1) {
    const t = s / BLADE_SEGMENTS;
    const x = BLADE_WIDTH * 0.5 * (1 - Math.pow(t, 1.8) * 0.97);
    positions.push(-x, BLADE_HEIGHT * t, 0, x, BLADE_HEIGHT * t, 0);
    uvs.push(0, t, 1, t);
    normals.push(0, 0, 1, 0, 0, 1);
    if (s > 0) {
      const a = (s - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return { positions, uvs, normals, indices };
}

function hash(cx, cz, salt) {
  const n = Math.sin(cx * 127.1 + cz * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function tintMesh(mesh, color, plain = false, tinted = false) {
  const mat = new StandardMaterial(`${mesh.name}_wildMat`, mesh.getScene());
  mat.diffuseColor = plain || tinted ? color : new Color3(1, 1, 1);
  mat.emissiveColor = plain ? color.scale(0.22) : Color3.Black();
  mat.specularColor = new Color3(0.02, 0.02, 0.02);
  mat.ambientColor = plain ? color.scale(0.5) : new Color3(0.5, 0.5, 0.5);
  mat.backFaceCulling = false;
  mesh.material = mat;
  return mat;
}

function groundColor(scene) {
  const mat = scene?.getMeshByName?.('terrainSurface')?.material;
  if (!mat || !mat.diffuseColor) return new Color3(0.5, 0.66, 0.28);
  return new Color3(
    Math.min(mat.diffuseColor.r * 1.9, 0.62),
    Math.min(mat.diffuseColor.g * 1.9, 0.78),
    Math.min(mat.diffuseColor.b * 1.7, 0.36),
  );
}

function isFree(deco, cx, cz) {
  if (deco.isBlocked(cx, cz)) return false;
  if (deco.surfaceKeyAt(cx, cz)) return false;
  return deco.topAt(cx, cz) <= 0;
}

export default class FloraSystem {

  constructor(scene) {
    this.s = scene;
    this.deco = null;
    this.density = 'high';
    this.grass = null;
    this.span = 7;
    this.slots = [];
    this.grassMeshes = [];
    this.scatterNode = new TransformNode('wildScatter', scene);
    this.scatterNodes = [];
    this.scatterTemplates = new Map();
    this.scatterDone = false;
    this.bladesReady = false;
    this.observer = null;
    this.clock = 0;
    this.lastTime = performance.now();
  }

  create(deco, density = 'high') {
    this.dispose();
    this.deco = deco;
    this.density = density;
    this.build();
  }

  build() {
    if (!this.deco) return;
    this.buildGrass();
    this.regrowScatter();
    this.populateScatter();
  }

  dispose() {
    this.s.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.disposeGrass();
    for (const node of this.scatterNodes) node.dispose(false, false);
    this.scatterNodes.length = 0;
  }

  disposeGrass() {
    if (this.grass && !this.grass.isDisposed()) this.grass.dispose(false, false);
    this.grass = null;
    this.grassMeshes.length = 0;
    this.slots.length = 0;
  }

  setDensity(density) {
    if (density === this.density) return;
    this.density = density;
    this.bladesReady = false;
    if (!this.deco) return;
    this.dispose();
    this.build();
  }

  buildGrass() {
    if (!this.deco || !PER_TILE[this.density]) return [];
    if (this.grassMeshes.length) return this.grassMeshes.slice();
    const bounds = this.deco.boundsOfCells();
    if (!bounds) return [];
    this.makeBlades(bounds);
    this.createGrassMesh();
    this.grass = new TransformNode('wildGrass', this.s);
    for (const mesh of this.grassMeshes) mesh.parent = this.grass;
    this.animate();
    return this.grassMeshes.slice();
  }

  makeBlades(bounds) {
    const perTile = PER_TILE[this.density];
    const side = Math.round(Math.sqrt(perTile));
    const step = CELL_SIZE / side;
    const fromX = bounds.minX - this.span;
    const toX = bounds.maxX + this.span;
    const fromZ = bounds.minZ - this.span;
    const toZ = bounds.maxZ + this.span;
    let index = 0;
    for (let tz = fromZ; tz <= toZ; tz += 1) {
      for (let tx = fromX; tx <= toX; tx += 1) {
        if (!this.tileFree(tx, tz)) {
          index += perTile;
          continue;
        }
        for (let cell = 0; cell < side; cell += 1) {
          for (let row = 0; row < side; row += 1) {
            if (this.slots.length >= BLADE_CAP) return;
            const slot = this.makeSlot(tx, tz, index, cell, row, step);
            index += 1;
            if (slot) this.slots.push(slot);
          }
        }
      }
    }
  }

  tileFree(tx, tz) {
    const cx = worldToCell(tx);
    const cz = worldToCell(tz);
    return isFree(this.deco, cx, cz) && !this.deco.nearBlocked(cx, cz, 0.9);
  }

  spotChance(tx, tz) {
    const edge = this.deco.fieldDistance(worldToCell(tx), worldToCell(tz));
    return edge > 2 ? 0.6 : 1;
  }

  makeSlot(tx, tz, seed, cell, row, step) {
    const jitterX = (hash(seed, cell, 3) - 0.5) * step * 0.9;
    const jitterZ = (hash(seed, row, 7) - 0.5) * step * 0.9;
    const x = tx - CELL_SIZE * 0.5 + (cell + 0.5) * step + jitterX;
    const z = tz - CELL_SIZE * 0.5 + (row + 0.5) * step + jitterZ;
    const cx = worldToCell(x);
    const cz = worldToCell(z);
    if (!isFree(this.deco, cx, cz)) return null;
    if (hash(seed, cell + row, 11) > this.spotChance(tx, tz)) return null;
    return {
      x,
      z,
      y: this.deco.topAt(cx, cz) + GRASS_LIFT,
      size: 0.6 + hash(seed, row + cell, 5) * 0.8,
      yaw: hash(seed, cell, 13) * Math.PI * 2,
      lean: hash(seed, row, 17),
      mesh: null,
      slot: 0,
    };
  }

  createGrassMesh() {
    const total = Math.min(this.slots.length, BLADE_CAP);
    if (!total) return;
    const shape = bladeShape();
    const mesh = new Mesh('wildGrass', this.s);
    const data = new VertexData();
    data.positions = shape.positions;
    data.uvs = shape.uvs;
    data.normals = shape.normals;
    data.indices = shape.indices;
    data.applyToMesh(mesh);
    mesh.material = createGrassMaterial(this.s, {
      height: BLADE_HEIGHT,
      base: groundColor(this.s),
      root: GRASS_BASE_TONE,
    });
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.receiveShadows = false;
    const matrices = new Float32Array(total * 16);
    for (let i = 0; i < total; i += 1) {
      const slot = this.slots[i];
      slot.mesh = mesh;
      slot.slot = i;
      this.bladeMatrix(slot).copyToArray(matrices, i * 16);
    }
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    this.grassMeshes[0] = mesh;
  }

  bladeMatrix(slot) {
    const size = slot.size || 1;
    const yaw = slot.yaw || 0;
    const lean = (slot.lean || 0) * 0.35;
    const tilt = Quaternion.RotationAxis(new Vector3(Math.cos(yaw), 0, Math.sin(yaw)), lean);
    const turn = Quaternion.RotationAxis(Vector3.Up(), yaw);
    return Matrix.Compose(
      new Vector3(size, size, size),
      tilt.multiply(turn),
      new Vector3(slot.x, slot.y ?? GRASS_LIFT, slot.z),
    );
  }

  animate() {
    if (this.observer) return;
    this.observer = this.s.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      this.clock += Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      const mat = this.grassMeshes[0]?.material;
      if (mat) tickGrass(mat, this.clock);
    });
  }

  buildScatter() {
    if (!this.deco) return [];
    const bounds = this.deco.boundsOfCells();
    if (!bounds) return [];
    const spots = [];
    const ring = { minX: bounds.minX - 2, maxX: bounds.maxX + 2, minZ: bounds.minZ - 2, maxZ: bounds.maxZ + 2 };
    for (let cx = ring.minX; cx <= ring.maxX; cx += 1) {
      for (let cz = ring.minZ; cz <= ring.maxZ; cz += 1) {
        if (Math.abs(this.edgeDistance(cx, cz, bounds)) >= 2) continue;
        const outside = this.edgeDistance(cx, cz, bounds) <= 0;
        if (outside) {
          if (hash(cx, cz, 21) > BUSH_CHANCE) continue;
        } else {
          if (hash(cx, cz, 9) > SCATTER_CHANCE) continue;
          if (!isFree(this.deco, cx, cz)) continue;
        }
        const key = outside
          ? 'bush'
          : SCATTER_KEYS[Math.floor(hash(cx, cz, 10) * SCATTER_KEYS.length) % SCATTER_KEYS.length];
        spots.push({
          key,
          x: cx * CELL_SIZE + (hash(cx, cz, 11) - 0.5) * CELL_SIZE * 0.65,
          z: cz * CELL_SIZE + (hash(cx, cz, 12) - 0.5) * CELL_SIZE * 0.65,
          scale: 1.6 + hash(cx, cz, 13) * 1.2 + (outside ? 1.6 : 0),
          turn: hash(cx, cz, 14) * Math.PI * 2,
        });
      }
    }
    return spots;
  }

  edgeDistance(cx, cz, bounds) {
    return Math.min(cx - bounds.minX, bounds.maxX - cx, cz - bounds.minZ, bounds.maxZ - cz);
  }

  async collectScatter() {
    const loaded = new Map(getLoadedModels().map((entry) => [entry.path, entry.promise]));
    this.scatterTemplates.clear();
    for (const key of [...SCATTER_KEYS, 'bush']) {
      const path = SCATTER_MODELS[key];
      const root = await (loaded.get(path) ?? loadModel(this.s, path));
      if (!root) continue;
      const clone = instantiateModel(this.s, root, `wildTemplate_${key}`);
      if (!clone) continue;
      clone.setEnabled(false);
      for (const child of clone.getChildMeshes()) {
        child.isPickable = false;
        tintMesh(child, new Color3(0.62, 0.72, 0.5), true);
      }
      this.scatterTemplates.set(key, clone);
    }
  }

  async populateScatter() {
    if (this.scatterDone) return;
    this.scatterDone = true;
    const spots = this.buildScatter();
    if (!spots.length) return;
    await this.collectScatter();
    if (!this.deco) return;
    for (const spot of spots) {
      const node = this.spawnScatter(spot);
      if (!node) continue;
      this.scatterNodes.push(node);
      if (spot.key !== 'bush' && spot.key !== 'bush_small') continue;
      this.clearGrassAround(spot.x, spot.z, spot.scale * 0.45);
    }
  }

  regrowScatter() {
    if (!this.bladesReady) {
      this.bladesReady = true;
      for (const spot of this.buildScatter()) {
        if (spot.key !== 'bush' && spot.key !== 'bush_small') continue;
        this.clearGrassAround(spot.x, spot.z, spot.scale * 0.45);
      }
    }
    for (const node of this.scatterNodes) node.dispose(false, false);
    this.scatterNodes.length = 0;
    if (!this.scatterTemplates.size) return;
    for (const spot of this.buildScatter()) {
      const node = this.spawnScatter(spot);
      if (node) this.scatterNodes.push(node);
    }
  }

  spawnScatter(spot) {
    const template = this.scatterTemplates.get(spot.key);
    if (!template) return null;
    const node = instantiateModel(this.s, template, `wild_${spot.key}_${spot.x.toFixed(1)}_${spot.z.toFixed(1)}`);
    if (!node) return null;
    node.parent = this.scatterNode;
    node.position = new Vector3(spot.x, 0, spot.z);
    node.rotation.y = spot.turn;
    node.scaling = node.scaling.scale(spot.scale * 0.5);
    node.isPickable = false;
    for (const child of node.getChildMeshes()) child.isPickable = false;
    return node;
  }

  clearGrassAround(x, z, radius) {
    const mesh = this.grassMeshes[0];
    if (!mesh) return;
    const data = mesh._thinInstanceDataStorage.matrixData;
    let changed = false;
    for (const slot of this.slots) {
      if (Math.hypot(slot.x - x, slot.z - z) > radius) continue;
      Matrix.Scaling(0, 0, 0).copyToArray(data, slot.slot * 16);
      changed = true;
    }
    if (!changed) return;
    mesh.thinInstanceBufferUpdated('matrix');
  }
}
