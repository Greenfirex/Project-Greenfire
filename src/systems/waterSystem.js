// Vodní hladina — vlastní program pro orthografickou kameru.
// Drží se jen na buňkách mapy, kraj uzavírá vodní stěna a dno prosvítá podle hloubky.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { CELL_SIZE } from '../utils/gridMath.js';
import { createWaterMaterial, createWaterSideMaterial, tickWater } from './waterShader.js';

const WATER_SINK = 0.02;
const WATER_STEPS = { high: 0.5, medium: 1, low: 2 };
const PROBE_SIZES = { high: 128, medium: 96, low: 64 };
const FALLBACK_RGB = [0.06, 0.16, 0.19];
const MAX_DEPTH = 2.5;

export default class WaterSystem {

  constructor(scene) {
    this.s = scene;
    this.mesh = null;
    this.sideMesh = null;
    this.material = null;
    this.sideMaterial = null;
    this.sunLight = null;
    this.dayness = 1;
    this.time = 0;
    this.quality = 'high';
    this.waterRgb = null;
    this.probe = null;
    this.probeSize = 0;
    this.reflectors = [];
  }

  setSun(light) {
    this.sunLight = light || null;
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, Number(value) || 0));
    this.applyColors();
  }

  clear() {
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.dispose(false, false);
    if (this.sideMesh && !this.sideMesh.isDisposed()) this.sideMesh.dispose(false, true);
    this.mesh = null;
    this.sideMesh = null;
    this.sideMaterial = null;
    if (this.probe) this.probe.refreshRate = 0;
  }

  setReflectors(meshes) {
    this.reflectors = Array.isArray(meshes) ? meshes.slice() : [];
    this.applyReflectors();
  }

  applyReflectors() {
    if (!this.probe) return;
    this.probe.renderList = this.reflectors.filter((node) => node && !node.isDisposed());
  }

  skyClearColor() {
    const sky = this.s.clearColor;
    return sky ? new Color4(sky.r, sky.g, sky.b, 1) : new Color4(0.05, 0.06, 0.08, 1);
  }

  probeFor(quality, centerX, centerZ, surfaceY) {
    const size = PROBE_SIZES[quality] || PROBE_SIZES.high;
    if (!this.probe || this.probeSize !== size) {
      if (this.probe) this.probe.dispose();
      const probe = new ReflectionProbe('waterProbe', size, this.s);
      probe.refreshRate = 2;
      probe.renderList = [];
      this.probe = probe;
      this.probeSize = size;
      if (this.material) this.material.setTexture('reflectionSampler', probe.cubeTexture);
    }
    this.probe.position = new Vector3(centerX, surfaceY + 1.2, centerZ);
    this.probe.refreshRate = 2;
    if (this.probe.cubeTexture) this.probe.cubeTexture.clearColor = this.skyClearColor();
    this.applyReflectors();
    return this.probe;
  }

  colorOptions() {
    const base = this.waterRgb || FALLBACK_RGB;
    return {
      shallowColor: this.shallowColor(base),
      deepColor: this.deepColor(base),
      foamColor: new Color3(0.82, 0.92, 0.94),
      sunColor: new Color3(1, 0.95, 0.86),
      skyColor: new Color3(0.5, 0.65, 0.8),
      maxDepth: MAX_DEPTH,
    };
  }

  materialFor() {
    if (!this.material) this.material = createWaterMaterial(this.s, this.colorOptions());
    this.applyColors();
    return this.material;
  }

  shallowColor(base) {
    return new Color3(
      Math.min(base[0] * 3.4 + 0.06, 0.5),
      Math.min(base[1] * 2.6 + 0.1, 0.7),
      Math.min(base[2] * 2.2 + 0.08, 0.6),
    );
  }

  deepColor(base) {
    return new Color3(base[0], base[1], base[2]);
  }

  sideColor(base, scale, lift) {
    return new Color3(
      Math.min(base[0] * scale + lift, 0.6),
      Math.min(base[1] * scale + lift, 0.75),
      Math.min(base[2] * scale + lift, 0.75),
    );
  }

  applyColors(rgb) {
    this.waterRgb = rgb || this.waterRgb;
    const base = this.waterRgb || FALLBACK_RGB;
    if (this.material) {
      this.material.setColor3('shallowColor', this.shallowColor(base));
      this.material.setColor3('deepColor', this.deepColor(base));
      this.material.setColor3('foamColor', new Color3(0.82, 0.92, 0.94));
      this.material.setFloat('dayness', this.dayness);
      const sky = this.s.clearColor;
      if (sky) this.material.setColor3('skyColor', new Color3(sky.r, sky.g, sky.b));
      if (this.probe && this.probe.cubeTexture) this.probe.cubeTexture.clearColor = this.skyClearColor();
    }
    if (this.sideMaterial) {
      this.sideMaterial.setColor3('surfaceColor', this.sideColor(base, 1.9, 0.05));
      this.sideMaterial.setColor3('deepColor', this.sideColor(base, 0.45, 0));
      this.sideMaterial.setFloat('dayness', this.dayness);
    }
  }

  create(cells, level, heightAt = null, waterRgb = null, quality = 'high') {
    this.clear();
    this.quality = quality;
    this.waterRgb = waterRgb || this.waterRgb;
    const step = WATER_STEPS[quality] || WATER_STEPS.medium;
    if (!Number.isFinite(level) || typeof heightAt !== 'function' || !cells || !cells.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const cellSet = new Set();
    for (const [cx, cz] of cells) {
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minZ = Math.min(minZ, cz);
      maxZ = Math.max(maxZ, cz);
      cellSet.add(`${cx},${cz}`);
    }
    if (!cellSet.size) return null;
    const half = CELL_SIZE / 2;
    const x0 = minX * CELL_SIZE - half;
    const x1 = maxX * CELL_SIZE + half;
    const z0 = minZ * CELL_SIZE - half;
    const z1 = maxZ * CELL_SIZE + half;
    const cols = Math.max(1, Math.ceil((x1 - x0) / step));
    const rows = Math.max(1, Math.ceil((z1 - z0) / step));
    const dx = (x1 - x0) / cols;
    const dz = (z1 - z0) / rows;
    const cellAt = (x, z) => `${Math.floor((x + half) / CELL_SIZE)},${Math.floor((z + half) / CELL_SIZE)}`;
    const inside = (i, j) => {
      if (i < 0 || j < 0 || i >= cols || j >= rows) return false;
      return cellSet.has(cellAt(x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dz));
    };
    const surfaceY = level - WATER_SINK;
    const positions = [];
    const uvs = [];
    const depths = [];
    for (let j = 0; j <= rows; j += 1) {
      const z = z0 + j * dz;
      for (let i = 0; i <= cols; i += 1) {
        const x = x0 + i * dx;
        const depth = Math.max(0, level - heightAt(x, z));
        positions.push(x, surfaceY, z);
        uvs.push(depth, 0);
        depths.push(depth);
      }
    }
    const included = new Set();
    const indices = [];
    let wet = false;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        if (!inside(i, j)) continue;
        included.add(`${i},${j}`);
        const a = j * (cols + 1) + i;
        const b = a + 1;
        const c = a + cols + 2;
        const d = a + cols + 1;
        indices.push(a, c, b, a, d, c);
        if (depths[a] > 0.005 || depths[b] > 0.005 || depths[c] > 0.005 || depths[d] > 0.005) wet = true;
      }
    }
    if (!wet) return null;

    const mesh = new Mesh('waterSurface', this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.uvs = uvs;
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    const material = this.materialFor();
    this.probeFor(quality, (x0 + x1) / 2, (z0 + z1) / 2, surfaceY);
    mesh.material = material;
    this.mesh = mesh;

    const sidePositions = [];
    const sideUvs = [];
    const sideIndices = [];
    const vertex = (i, j) => {
      const index = j * (cols + 1) + i;
      return { x: positions[index * 3], z: positions[index * 3 + 2], depth: depths[index] };
    };
    const addSide = (i1, j1, i2, j2) => {
      const a = vertex(i1, j1);
      const b = vertex(i2, j2);
      if (a.depth <= 0.005 && b.depth <= 0.005) return;
      const aBottom = Math.min(surfaceY, level - a.depth);
      const bBottom = Math.min(surfaceY, level - b.depth);
      const start = sidePositions.length / 3;
      sidePositions.push(
        a.x, surfaceY, a.z,
        a.x, aBottom, a.z,
        b.x, surfaceY, b.z,
        b.x, bBottom, b.z,
      );
      sideUvs.push(a.depth, 0, a.depth, 1, b.depth, 0, b.depth, 1);
      sideIndices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    };
    for (const key of included) {
      const [i, j] = key.split(',').map(Number);
      if (!included.has(`${i - 1},${j}`)) addSide(i, j, i, j + 1);
      if (!included.has(`${i + 1},${j}`)) addSide(i + 1, j, i + 1, j + 1);
      if (!included.has(`${i},${j - 1}`)) addSide(i, j, i + 1, j);
      if (!included.has(`${i},${j + 1}`)) addSide(i, j + 1, i + 1, j + 1);
    }
    if (sidePositions.length) {
      const sides = new Mesh('waterSides', this.s);
      const sideData = new VertexData();
      sideData.positions = sidePositions;
      sideData.indices = sideIndices;
      sideData.uvs = sideUvs;
      sideData.applyToMesh(sides);
      sides.isPickable = false;
      const base = this.waterRgb || FALLBACK_RGB;
      sides.material = createWaterSideMaterial(this.s, {
        shallowColor: this.sideColor(base, 1.9, 0.05),
        deepColor: this.sideColor(base, 0.45, 0),
        foamColor: new Color3(0.62, 0.72, 0.73),
      });
      this.sideMesh = sides;
      this.sideMaterial = sides.material;
    }

    this.applyColors();
    this.update(0);
    return mesh;
  }

  update(dt) {
    this.time += dt;
    const material = this.material;
    if (!material) return;
    tickWater(material, this.time);
    if (this.sideMaterial) tickWater(this.sideMaterial, this.time);
    if (this.probe && this.probe.cubeTexture) this.probe.cubeTexture.clearColor = this.skyClearColor();
    const sun = this.sunLight;
    if (sun) {
      const direction = sun.direction;
      const toward = new Vector3(-direction.x, -direction.y, -direction.z);
      if (toward.lengthSquared() > 0) toward.normalize();
      material.setVector3('sunDir', toward);
      material.setColor3('sunColor', sun.diffuse);
      material.setFloat('sunIntensity', sun.intensity);
    }
    const sky = this.s.clearColor;
    if (sky) material.setColor3('skyColor', new Color3(sky.r, sky.g, sky.b));
    const camera = this.s.activeCamera;
    if (camera && typeof camera.getForwardRay === 'function') {
      const toward = camera.getForwardRay().direction.scale(-1);
      if (toward.lengthSquared() > 0) {
        toward.normalize();
        material.setVector3('cameraDir', toward);
      }
    }
    material.setFloat('dayness', this.dayness);
  }
}
