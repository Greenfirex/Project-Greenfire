// Vodní hladina — vlastní program pro orthografickou kameru.
// Drží se jen na buňkách mapy, kraj uzavírá vodní stěna a dno prosvítá podle hloubky.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector2, Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { CELL_SIZE } from '../utils/gridMath.js';
import { waveOffset, WAVE_REACH, WAVE_TIME_WRAP } from '../utils/waterWaves.js';
import { createWaterMaterial, createWaterSideMaterial, tickWater } from './waterShader.js';

const WATER_SINK = 0.02;
const WATER_STEPS = { high: 0.5, medium: 1, low: 2 };
const DEPTH_STEP = 0.5;
const DEPTH_MAX = 256;
const DEPTH_RANGE = 3;
const REFLECTION_SCALES = { high: 0.6, medium: 0.45, low: 0.35 };
const FALLBACK_RGB = [0.06, 0.16, 0.19];
const FALLBACK_SKY = new Color3(0.5, 0.65, 0.8);
const SEA_FALLBACK = [0.94, 0.34];
const MAX_DEPTH = 2.5;
const WAVE_AMP_MIN = 0.7;
const WAVE_AMP_MAX = 2.15;

function waveAmpFor(depth) {
  const t = Math.min(1, Math.max(0, (depth - 0.15) / (MAX_DEPTH - 0.15)));
  return WAVE_AMP_MIN + (WAVE_AMP_MAX - WAVE_AMP_MIN) * (t * t * (3 - 2 * t));
}
const RIPPLE_COUNT = 8;
const RIPPLE_SECONDS = 0.7;
const RIPPLE_GROW = 0.9;
const RIPPLE_SEGMENTS = 24;
const RIPPLE_INNER = 0.78;

function rippleShape() {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i < RIPPLE_SEGMENTS; i += 1) {
    const a0 = (i / RIPPLE_SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / RIPPLE_SEGMENTS) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const base = positions.length / 3;
    positions.push(
      c0 * RIPPLE_INNER, 0, s0 * RIPPLE_INNER,
      c0, 0, s0,
      c1, 0, s1,
      c1 * RIPPLE_INNER, 0, s1 * RIPPLE_INNER,
    );
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

export default class WaterSystem {

  constructor(scene) {
    this.s = scene;
    this.mesh = null;
    this.sideMesh = null;
    this.material = null;
    this.sideMaterial = null;
    this.sunLight = null;
    this.dayness = 1;
    this.skyTint = null;
    this.time = 0;
    this.quality = 'high';
    this.waterRgb = null;
    this.reflection = null;
    this.reflectionExclusions = [];
    this.hiddenReflectionMeshes = [];
    this.reflectionScale = 0;
    this.surfaceY = 0;
    this.plane = new Plane(0, 1, 0, 0);
    this.mirror = new Matrix();
    this.reflectionView = new Matrix();
    this.reflectionViewProjection = new Matrix();
    this.mirrorEye = new Vector3();
    this.savedView = new Matrix();
    this.depthMap = null;
    this.depthOrigin = new Vector2(0, 0);
    this.clipPlane = new Plane(0, -1, 0, 0);
    this.savedClipPlane = null;
    this.depthScale = new Vector2(1, 1);
    this.level = null;
    this.heightAt = null;
    this.shoreCells = [];
    this.maxDepth = MAX_DEPTH;
    this.ripples = [];
  }

  setSun(light) {
    this.sunLight = light || null;
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, Number(value) || 0));
    this.applyColors();
  }

  setSkyTint(color) {
    this.skyTint = color ? color.clone() : null;
    this.applyColors();
    if (this.reflection) this.reflection.clearColor = this.skyClearColor();
  }

  setReflectionExclusions(meshes) {
    this.reflectionExclusions = Array.isArray(meshes) ? meshes.filter((mesh) => mesh && !mesh.isDisposed()) : [];
  }

  clear() {
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.dispose(false, false);
    if (this.sideMesh && !this.sideMesh.isDisposed()) this.sideMesh.dispose(false, true);
    this.mesh = null;
    this.sideMesh = null;
    this.sideMaterial = null;
    this.level = null;
    this.heightAt = null;
    this.shoreCells = [];
    for (const ripple of this.ripples) {
      ripple.life = 0;
      ripple.material.alpha = 0;
      ripple.mesh.setEnabled(false);
    }
    if (this.depthMap) {
      this.depthMap.dispose();
      this.depthMap = null;
    }
  }

  depthAt(x, z) {
    if (!this.heightAt || !Number.isFinite(this.level)) return 0;
    const ground = this.heightAt(x, z);
    if (!Number.isFinite(ground)) return 0;
    return Math.max(0, this.surfaceY - ground);
  }

  surfaceHeightAt(x, z) {
    if (!Number.isFinite(this.level)) return 0;
    const dirX = this.seaDir ? this.seaDir.x : 1;
    const dirZ = this.seaDir ? this.seaDir.y : 0;
    return this.surfaceY + waveOffset(x, z, dirX, dirZ, this.time % WAVE_TIME_WRAP);
  }

  waveDepthAt(x, z) {
    if (!this.heightAt || !Number.isFinite(this.level)) return 0;
    const ground = this.heightAt(x, z);
    if (!Number.isFinite(ground)) return 0;
    return Math.max(0, this.surfaceHeightAt(x, z) - ground);
  }

  reachesAt(x, z) {
    if (!this.heightAt || !Number.isFinite(this.level)) return false;
    const ground = this.heightAt(x, z);
    if (!Number.isFinite(ground)) return false;
    return this.surfaceY + WAVE_REACH > ground;
  }

  shoreDistanceAt(x, z) {
    if (!this.shoreCells.length || !Number.isFinite(this.level)) return Infinity;
    let best = Infinity;
    for (const [cx, cz] of this.shoreCells) {
      const dx = Math.abs(x - cx * CELL_SIZE) - CELL_SIZE * 0.5;
      const dz = Math.abs(z - cz * CELL_SIZE) - CELL_SIZE * 0.5;
      const distance = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
      if (distance < best) best = distance;
      if (best === 0) return 0;
    }
    return best;
  }

  splash(x, z, strength = 1) {
    const depth = this.waveDepthAt(x, z);
    if (depth <= 0.02) return;
    const pool = this.ripplePool();
    let ripple = pool.find((item) => item.life <= 0);
    if (!ripple) ripple = pool.reduce((a, b) => (a.time / a.life > b.time / b.life ? a : b));
    ripple.time = 0;
    ripple.life = RIPPLE_SECONDS;
    const scale = (0.18 + Math.min(depth, 0.6) * 0.35) * strength;
    ripple.mesh.position.set(x, this.surfaceHeightAt(x, z) + 0.015, z);
    ripple.mesh.scaling.set(scale, 1, scale);
    ripple.mesh.setEnabled(true);
    ripple.material.alpha = 0.4;
  }

  ripplePool() {
    if (this.ripples.length) return this.ripples;
    const shape = rippleShape();
    for (let i = 0; i < RIPPLE_COUNT; i += 1) {
      const mesh = new Mesh(`waterSplash${i}`, this.s);
      const data = new VertexData();
      data.positions = shape.positions;
      data.normals = shape.normals;
      data.indices = shape.indices;
      data.applyToMesh(mesh);
      const material = new StandardMaterial(`waterSplashMat${i}`, this.s);
      material.disableLighting = true;
      material.emissiveColor = new Color3(0.78, 0.9, 0.94);
      material.diffuseColor = Color3.Black();
      material.specularColor = Color3.Black();
      material.alpha = 0;
      material.backFaceCulling = false;
      mesh.material = material;
      mesh.isPickable = false;
      mesh.receiveShadows = false;
      mesh.setEnabled(false);
      mesh.alphaIndex = 3;
      material.disableDepthWrite = true;
      this.ripples.push({ mesh, material, time: 0, life: 0 });
    }
    return this.ripples;
  }

  updateRipples(dt) {
    for (const ripple of this.ripples) {
      if (ripple.life <= 0) continue;
      ripple.time += dt;
      const t = Math.min(1, ripple.time / ripple.life);
      ripple.mesh.position.y = this.surfaceHeightAt(ripple.mesh.position.x, ripple.mesh.position.z) + 0.015;
      const scale = ripple.mesh.scaling.x + dt * RIPPLE_GROW;
      ripple.mesh.scaling.set(scale, 1, scale);
      ripple.material.alpha = 0.4 * (1 - t);
      if (t >= 1) {
        ripple.life = 0;
        ripple.material.alpha = 0;
        ripple.mesh.setEnabled(false);
      }
    }
  }

  skyClearColor() {
    const tint = this.skyTint || FALLBACK_SKY;
    return new Color4(tint.r, tint.g, tint.b, 1);
  }

  reflectionSize(scale) {
    const engine = this.s.getEngine();
    return {
      width: Math.max(64, Math.floor(engine.getRenderWidth() * scale)),
      height: Math.max(64, Math.floor(engine.getRenderHeight() * scale)),
    };
  }

  depthMapFor(level, heightAt, x0, x1, z0, z1) {
    const spanX = Math.max(1e-6, x1 - x0);
    const spanZ = Math.max(1e-6, z1 - z0);
    const width = Math.max(2, Math.min(DEPTH_MAX, Math.ceil(spanX / DEPTH_STEP) + 1));
    const height = Math.max(2, Math.min(DEPTH_MAX, Math.ceil(spanZ / DEPTH_STEP) + 1));
    const raw = new Float32Array(width * height);
    for (let j = 0; j < height; j += 1) {
      const z = z0 + (j / (height - 1)) * spanZ;
      for (let i = 0; i < width; i += 1) {
        const x = x0 + (i / (width - 1)) * spanX;
        raw[j * width + i] = level - heightAt(x, z);
      }
    }
    const smooth = new Float32Array(raw.length);
    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        let sum = 0;
        for (let dj = -1; dj <= 1; dj += 1) {
          const jj = Math.min(height - 1, Math.max(0, j + dj));
          for (let di = -1; di <= 1; di += 1) {
            const ii = Math.min(width - 1, Math.max(0, i + di));
            sum += raw[jj * width + ii];
          }
        }
        smooth[j * width + i] = sum / 9;
      }
    }
    const data = new Uint8Array(width * height);
    for (let index = 0; index < smooth.length; index += 1) {
      const normalized = Math.min(1, Math.max(0, 0.5 + smooth[index] / (2 * DEPTH_RANGE)));
      data[index] = Math.round(normalized * 255);
    }
    if (this.depthMap) this.depthMap.dispose();
    this.depthMap = new RawTexture(data, width, height, Constants.TEXTUREFORMAT_R, this.s, false, false, Texture.BILINEAR_SAMPLINGMODE);
    this.depthMap.wrapU = Texture.CLAMP_ADDRESSMODE;
    this.depthMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.depthOrigin.set(x0, z0);
    this.depthScale.set(1 / spanX, 1 / spanZ);
    return this.depthMap;
  }

  reflectionFor(quality, surfaceY) {
    const scale = REFLECTION_SCALES[quality] || REFLECTION_SCALES.medium;
    if (!this.reflection) {
      const rtt = new RenderTargetTexture('waterReflection', this.reflectionSize(scale), this.s, false, true);
      rtt.renderList = null;
      rtt.wrapU = Texture.CLAMP_ADDRESSMODE;
      rtt.wrapV = Texture.CLAMP_ADDRESSMODE;
      rtt.refreshRate = 1;
      rtt.clearColor = this.skyClearColor();
      rtt.onBeforeRenderObservable.add(() => this.beginReflection());
      rtt.onAfterRenderObservable.add(() => this.endReflection());
      this.s.customRenderTargets.push(rtt);
      this.reflection = rtt;
      this.reflectionScale = scale;
    } else if (this.reflectionScale !== scale) {
      this.reflection.resize(this.reflectionSize(scale));
      this.reflectionScale = scale;
    }
    this.reflection.refreshRate = 1;
    this.surfaceY = surfaceY;
    this.plane.d = -surfaceY;
    if (this.material) this.material.setTexture('reflectionSampler', this.reflection);
    return this.reflection;
  }

  beginReflection() {
    const camera = this.s.activeCamera;
    if (!camera) return;
    this.hideReflectionMeshes(true);
    const view = camera.getViewMatrix(true);
    this.savedView.copyFrom(view);
    this.plane.d = -this.surfaceY;
    Matrix.ReflectionToRef(this.plane, this.mirror);
    this.mirror.multiplyToRef(view, this.reflectionView);
    const projection = camera.getProjectionMatrix();
    this.reflectionView.multiplyToRef(projection, this.reflectionViewProjection);
    this.s.setTransformMatrix(this.reflectionView, projection);
    Vector3.TransformCoordinatesToRef(camera.globalPosition, this.mirror, this.mirrorEye);
    this.s._mirroredCameraPosition = this.mirrorEye;
    this.savedClipPlane = this.s.clipPlane;
    this.clipPlane.normal.set(0, -1, 0);
    this.clipPlane.d = this.surfaceY;
    this.s.clipPlane = this.clipPlane;
    this.s._forcedViewPosition = this.mirrorEye;
  }

  endReflection() {
    const camera = this.s.activeCamera;
    this.s._mirroredCameraPosition = null;
    this.s.clipPlane = this.savedClipPlane;
    this.savedClipPlane = null;
    this.s._forcedViewPosition = null;
    if (camera) this.s.setTransformMatrix(this.savedView, camera.getProjectionMatrix());
    if (this.material) this.material.setMatrix('reflectionViewProjection', this.reflectionViewProjection);
    this.hideReflectionMeshes(false);
  }

  hideReflectionMeshes(hidden) {
    if (hidden) {
      this.hiddenReflectionMeshes = [];
      const hide = (mesh) => {
        if (!mesh || mesh.isDisposed() || !mesh.isVisible) return;
        this.hiddenReflectionMeshes.push(mesh);
        mesh.isVisible = false;
      };
      hide(this.mesh);
      hide(this.sideMesh);
      for (const mesh of this.s.meshes) {
        if (mesh.getClassName() === 'LinesMesh') hide(mesh);
      }
      for (const mesh of this.reflectionExclusions) hide(mesh);
      return;
    }
    for (const mesh of this.hiddenReflectionMeshes) {
      if (!mesh.isDisposed()) mesh.isVisible = true;
    }
    this.hiddenReflectionMeshes = [];
  }

  syncReflection() {
    const rtt = this.reflection;
    if (!rtt) return;
    const size = this.reflectionSize(this.reflectionScale);
    if (rtt.getRenderWidth() !== size.width || rtt.getRenderHeight() !== size.height) rtt.resize(size);
    rtt.clearColor = this.skyClearColor();
  }

  colorOptions() {
    const base = this.waterRgb || FALLBACK_RGB;
    return {
      shallowColor: this.shallowColor(base),
      deepColor: this.deepColor(base),
      foamColor: new Color3(0.82, 0.92, 0.94),
      sunColor: new Color3(1, 0.95, 0.86),
      skyColor: FALLBACK_SKY.clone(),
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
      if (this.skyTint) this.material.setColor3('skyColor', this.skyTint);
      if (this.reflection) this.reflection.clearColor = this.skyClearColor();
    }
    if (this.sideMaterial) {
      this.sideMaterial.setColor3('surfaceColor', this.sideColor(base, 1.9, 0.05));
      this.sideMaterial.setColor3('deepColor', this.sideColor(base, 0.45, 0));
      this.sideMaterial.setFloat('dayness', this.dayness);
    }
  }

  create(cells, level, heightAt = null, waterRgb = null, quality = 'high') {
    this.clear();
    if (this.reflection) this.reflection.refreshRate = 0;
    this.quality = quality;
    this.waterRgb = waterRgb || this.waterRgb;
    const step = WATER_STEPS[quality] || WATER_STEPS.medium;
    if (!Number.isFinite(level) || typeof heightAt !== 'function' || !cells || !cells.length) return null;
    this.level = level;
    this.heightAt = heightAt;
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
    let seaDirX = 0;
    let seaDirZ = 0;
    const shoreCells = [];
    for (const [cx, cz] of cells) {
      if (heightAt(cx * CELL_SIZE, cz * CELL_SIZE) >= level) continue;
      shoreCells.push([cx, cz]);
      if (cx === minX) seaDirX += 1;
      if (cx === maxX) seaDirX -= 1;
      if (cz === minZ) seaDirZ += 1;
      if (cz === maxZ) seaDirZ -= 1;
    }
    this.shoreCells = shoreCells;
    const seaDirLength = Math.hypot(seaDirX, seaDirZ);
    this.seaDir = new Vector2(SEA_FALLBACK[0], SEA_FALLBACK[1]);
    if (seaDirLength > 1e-4) this.seaDir.set(seaDirX / seaDirLength, seaDirZ / seaDirLength);
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
    this.surfaceY = surfaceY;
    const positions = [];
    const depths = [];
    for (let j = 0; j <= rows; j += 1) {
      const z = z0 + j * dz;
      for (let i = 0; i <= cols; i += 1) {
        const x = x0 + i * dx;
        const drop = level - heightAt(x, z);
        const depth = Math.max(0, drop);
        positions.push(x, surfaceY, z);
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
    data.applyToMesh(mesh);
    mesh.setVerticesData('waveAmp', new Float32Array(depths.map(waveAmpFor)), false, 1);
    mesh.isPickable = false;
    mesh.alphaIndex = 2;
    const material = this.materialFor();
    material.setFloat('waterLevel', level);
    this.depthMapFor(level, heightAt, x0, x1, z0, z1);
    material.setTexture('depthMap', this.depthMap);
    material.setVector2('depthOrigin', this.depthOrigin);
    material.setVector2('depthScale', this.depthScale);
    material.setFloat('depthRange', DEPTH_RANGE);
    material.setVector2('seaDir', this.seaDir);
    this.reflectionFor(quality, surfaceY);
    mesh.material = material;
    this.mesh = mesh;
    material.disableDepthWrite = true;

    const sidePositions = [];
    const sideUvs = [];
    const sideIndices = [];
    const sideAmps = [];
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
      sideAmps.push(waveAmpFor(a.depth), 0, waveAmpFor(b.depth), 0);
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
      sides.setVerticesData('waveAmp', new Float32Array(sideAmps), false, 1);
      sides.isPickable = false;
      sides.alphaIndex = 1;
      const base = this.waterRgb || FALLBACK_RGB;
      sides.material = createWaterSideMaterial(this.s, {
        shallowColor: this.sideColor(base, 1.9, 0.05),
        deepColor: this.sideColor(base, 0.45, 0),
        foamColor: new Color3(0.62, 0.72, 0.73),
      });
      sides.material.setVector2('seaDir', this.seaDir);
      sides.material.disableDepthWrite = true;
      this.sideMesh = sides;
      this.sideMaterial = sides.material;
    }

    this.applyColors();
    this.update(0);
    return mesh;
  }

  update(dt) {
    this.time += dt;
    this.updateRipples(dt);
    const material = this.material;
    if (!material) return;
    tickWater(material, this.time);
    if (this.sideMaterial) tickWater(this.sideMaterial, this.time);
    this.syncReflection();
    const sun = this.sunLight;
    if (sun) {
      const direction = sun.direction;
      const toward = new Vector3(-direction.x, -direction.y, -direction.z);
      if (toward.lengthSquared() > 0) toward.normalize();
      material.setVector3('sunDir', toward);
      material.setColor3('sunColor', sun.diffuse);
      material.setFloat('sunIntensity', sun.intensity);
    }
    const sky = this.skyTint;
    if (sky) material.setColor3('skyColor', sky);
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
