// Kreslí trávu na buňkách, které jsou označené v mapě — stébla se houpou ve větru.
// Rostliny se nikdy nevysévají samy; co v mapě není, to na zemi neroste.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CELL_SIZE, worldToCell } from '../utils/gridMath.js';
import { createGrassMaterial, tickGrass } from './grassShader.js';

const BLADE_HEIGHT = CELL_SIZE * 0.22;
const BLADE_SEGMENTS = 3;
const BLADE_WIDTH = CELL_SIZE * 0.028;
const PER_TILE = { off: 0, medium: 121, high: 225 };
const BLADE_CAP = 500000;
const GRASS_BASE_TONE = new Color3(0.1, 0.24, 0.06);
const GRASS_LIFT = 0.02;
const TREE_CLEARANCE = 0.35;

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
  if (deco.isBlocked(cx, cz) && !deco.isTreeCell(cx, cz)) return false;
  if (deco.surfaceKeyAt(cx, cz)) return false;
  return true;
}

export default class FloraSystem {

  constructor(scene) {
    this.s = scene;
    this.deco = null;
    this.density = 'high';
    this.grass = null;
    this.slots = [];
    this.grassMeshes = [];
    this.observer = null;
    this.clock = 0;
    this.lastTime = performance.now();
    this.dayness = 1;
    this.sunDirection = new Vector3(0.35, 1, 0.25).normalize();
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
  }

  dispose() {
    this.s.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.disposeGrass();
  }

  disposeGrass() {
    if (this.grass && !this.grass.isDisposed()) this.grass.dispose(false, true);
    this.grass = null;
    this.grassMeshes.length = 0;
    this.slots.length = 0;
  }

  setDensity(density) {
    if (density === this.density) return;
    this.density = density;
    if (!this.deco) return;
    this.dispose();
    this.build();
  }

  setDayness(value) {
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    if (v === this.dayness) return;
    this.dayness = v;
  }

  setSunDirection(direction) {
    if (!direction) return;
    this.sunDirection.copyFrom(direction);
    if (this.sunDirection.lengthSquared() > 0) this.sunDirection.normalize();
  }

  buildGrass() {
    if (!this.deco || !PER_TILE[this.density]) return [];
    if (this.grassMeshes.length) return this.grassMeshes.slice();
    const cells = this.patchCells();
    if (!cells.length) return [];
    this.makeBlades(cells);
    this.createGrassMesh();
    this.grass = new TransformNode('grassPatches', this.s);
    for (const mesh of this.grassMeshes) mesh.parent = this.grass;
    this.animate();
    return this.grassMeshes.slice();
  }

  patchCells() {
    const layout = this.deco.layout;
    if (!layout) return [];
    const cells = [];
    for (const entry of layout.grass || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      cells.push([entry.cx, entry.cz]);
    }
    return cells;
  }

  makeBlades(cells) {
    const perTile = PER_TILE[this.density];
    const budget = Math.floor(BLADE_CAP / cells.length);
    const side = Math.max(1, Math.floor(Math.sqrt(Math.min(perTile, budget))));
    const bladesPerTile = side * side;
    const step = CELL_SIZE / side;
    let index = 0;
    for (const [cx, cz] of cells) {
      if (!this.tileFree(cx, cz)) {
        index += bladesPerTile;
        continue;
      }
      for (let cell = 0; cell < side; cell += 1) {
        for (let row = 0; row < side; row += 1) {
          if (this.slots.length >= BLADE_CAP) return;
          const slot = this.makeSlot(cx, cz, index, cell, row, step);
          index += 1;
          if (slot) this.slots.push(slot);
        }
      }
    }
  }

  tileFree(cx, cz) {
    return isFree(this.deco, cx, cz);
  }

  makeSlot(cx, cz, seed, cell, row, step) {
    const tx = cx * CELL_SIZE;
    const tz = cz * CELL_SIZE;
    const jitterX = (hash(seed, cell, 3) - 0.5) * step * 0.9;
    const jitterZ = (hash(seed, row, 7) - 0.5) * step * 0.9;
    const x = tx - CELL_SIZE * 0.5 + (cell + 0.5) * step + jitterX;
    const z = tz - CELL_SIZE * 0.5 + (row + 0.5) * step + jitterZ;
    const gx = worldToCell(x);
    const gz = worldToCell(z);
    if (!isFree(this.deco, gx, gz)) return null;
    if (this.deco.isTreeCell(gx, gz)) {
      const dx = x - gx * CELL_SIZE;
      const dz = z - gz * CELL_SIZE;
      if (dx * dx + dz * dz < TREE_CLEARANCE * TREE_CLEARANCE) return null;
    }
    const ground = this.deco.groundHeightAt ? this.deco.groundHeightAt(x, z) : this.deco.topAt(gx, gz);
    return {
      x,
      z,
      y: ground + GRASS_LIFT,
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
      lightDir: this.sunDirection,
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
      if (mat) {
        tickGrass(mat, this.clock);
        mat.setFloat('dayness', this.dayness);
        mat.setVector3('lightDir', this.sunDirection);
      }
    });
  }
}
