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
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import { waveHeight, waveAmpFor, WAVE_REACH, WAVE_TIME_WRAP } from '../utils/waterWaves.js';
import { createWaterMaterial, createWaterSideMaterial, tickWater } from './waterShader.js';

const WATER_SINK = 0.02;
const WATER_STEPS = { high: 0.5, medium: 1, low: 2 };
const DEPTH_STEP = 0.5;
const DEPTH_MAX = 256;
const DEPTH_RANGE = 5;
const SHORE_EDGE = 0.02;
const ISLAND_MIN_TEXELS = 24;
const SHORE_BLUR_PASSES = 4;
const SHORE_BLUR_RADIUS = 3;
const SHORE_NOISE_LARGE = 1.8;
const SHORE_NOISE_MID = 0.8;
const SHORE_NOISE_SMALL = 0.35;
const POTENTIAL_MAX = 96;
const POTENTIAL_ITERATIONS = 400;
const REFLECTION_SCALES = { high: 0.6, medium: 0.45, low: 0.35 };
const FALLBACK_RGB = [0.06, 0.16, 0.19];
const FALLBACK_SKY = new Color3(0.5, 0.65, 0.8);
const SEA_FALLBACK = [0.94, 0.34];
const MAX_DEPTH = 2.5;

function hashNoise(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = hashNoise(ix, iz) + (hashNoise(ix + 1, iz) - hashNoise(ix, iz)) * sx;
  const bottom = hashNoise(ix, iz + 1) + (hashNoise(ix + 1, iz + 1) - hashNoise(ix, iz + 1)) * sx;
  return (top + (bottom - top) * sz) * 2 - 1;
}

function floatToHalf(value) {
  const buffer = new ArrayBuffer(4);
  const f32 = new Float32Array(buffer);
  const i32 = new Int32Array(buffer);
  f32[0] = value;
  const bits = i32[0];
  const sign = (bits >> 16) & 0x8000;
  const exponent = (bits >> 23) & 0xff;
  let mantissa = bits & 0x7fffff;
  if (exponent === 0xff) return sign | 0x7c00;
  let e = exponent - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mantissa |= 0x800000;
    const shift = 14 - e;
    let half = mantissa >> shift;
    if ((mantissa >> (shift - 1)) & 1) half += 1;
    return sign | half;
  }
  let half = (mantissa >> 13) & 0x03ff;
  if ((mantissa >> 12) & 1) {
    half += 1;
    if (half >= 0x0400) {
      half = 0;
      e += 1;
      if (e >= 0x1f) return sign | 0x7c00;
    }
  }
  return sign | (e << 10) | half;
}

function solvePotential(land, width, height, iterations) {
  const size = width * height;
  const phi = new Float32Array(size);
  const fixed = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    if (!land[index]) continue;
    phi[index] = 1;
    fixed[index] = 1;
  }
  let seaSeeds = 0;
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      if (i !== 0 && i !== width - 1 && j !== 0 && j !== height - 1) continue;
      const index = j * width + i;
      if (fixed[index]) continue;
      phi[index] = 0;
      fixed[index] = 1;
      seaSeeds += 1;
    }
  }
  if (!seaSeeds) {
    const middle = (height >> 1) * width + (width >> 1);
    phi[middle] = 0;
    fixed[middle] = 1;
  }
  const omega = 1.8;
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let j = 1; j < height - 1; j += 1) {
      const row = j * width;
      for (let i = 1; i < width - 1; i += 1) {
        const index = row + i;
        if (fixed[index]) continue;
        const average = (phi[index - 1] + phi[index + 1] + phi[index - width] + phi[index + width]) * 0.25;
        phi[index] += omega * (average - phi[index]);
      }
    }
  }
  return phi;
}

function harmonicPotential(land, width, height) {
  const factor = Math.max(1, Math.ceil(Math.max(width, height) / POTENTIAL_MAX));
  if (factor <= 1) return solvePotential(land, width, height, POTENTIAL_ITERATIONS);
  const coarseWidth = Math.max(3, Math.ceil((width - 1) / factor) + 1);
  const coarseHeight = Math.max(3, Math.ceil((height - 1) / factor) + 1);
  const coarse = new Uint8Array(coarseWidth * coarseHeight);
  for (let j = 0; j < coarseHeight; j += 1) {
    const source = Math.min(height - 1, Math.round(j * factor));
    for (let i = 0; i < coarseWidth; i += 1) {
      const sourceX = Math.min(width - 1, Math.round(i * factor));
      coarse[j * coarseWidth + i] = land[source * width + sourceX];
    }
  }
  const solved = solvePotential(coarse, coarseWidth, coarseHeight, POTENTIAL_ITERATIONS);
  const out = new Float32Array(width * height);
  for (let j = 0; j < height; j += 1) {
    const fy = Math.min(coarseHeight - 1, j / factor);
    const j0 = Math.floor(fy);
    const j1 = Math.min(coarseHeight - 1, j0 + 1);
    const ty = fy - j0;
    for (let i = 0; i < width; i += 1) {
      const fx = Math.min(coarseWidth - 1, i / factor);
      const i0 = Math.floor(fx);
      const i1 = Math.min(coarseWidth - 1, i0 + 1);
      const tx = fx - i0;
      const top = solved[j0 * coarseWidth + i0] * (1 - tx) + solved[j0 * coarseWidth + i1] * tx;
      const bottom = solved[j1 * coarseWidth + i0] * (1 - tx) + solved[j1 * coarseWidth + i1] * tx;
      out[j * width + i] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
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
    this.bumpDetail = null;
    this.detail = true;
    this.depthOrigin = new Vector2(0, 0);
    this.clipPlane = new Plane(0, -1, 0, 0);
    this.savedClipPlane = null;
    this.depthScale = new Vector2(1, 1);
    this.waveDistData = null;
    this.waveDistMap = null;
    this.waveDistWidth = 0;
    this.waveDistHeight = 0;
    this.level = null;
    this.heightAt = null;
    this.shoreCells = [];
    this.maxDepth = MAX_DEPTH;
    this.ripples = [];
    this.hidden = false;
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

  setVisible(visible) {
    this.hidden = visible === false;
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.setEnabled(!this.hidden);
    if (this.sideMesh && !this.sideMesh.isDisposed()) this.sideMesh.setEnabled(!this.hidden);
    if (!this.hidden) return;
    for (const ripple of this.ripples) {
      ripple.life = 0;
      ripple.material.alpha = 0;
      ripple.mesh.setEnabled(false);
    }
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
    if (this.waveDistMap) {
      this.waveDistMap.dispose();
      this.waveDistMap = null;
    }
    this.waveDistData = null;
  }

  depthAt(x, z) {
    if (!this.heightAt || !Number.isFinite(this.level)) return 0;
    const ground = this.heightAt(x, z);
    if (!Number.isFinite(ground)) return 0;
    return Math.max(0, this.surfaceY - ground);
  }

  surfaceHeightAt(x, z, ground = null) {
    if (!Number.isFinite(this.level)) return 0;
    const distance = this.waveDistAt(x, z);
    const height = Number.isFinite(ground) ? ground : (this.heightAt ? this.heightAt(x, z) : null);
    const deep = !Number.isFinite(height);
    const depth = deep ? MAX_DEPTH : Math.max(0, this.level - height);
    const amp = waveAmpFor(depth, MAX_DEPTH);
    return this.surfaceY + waveHeight(distance, this.time % WAVE_TIME_WRAP) * amp;
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
    if (this.hidden) return;
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
    this.waveFieldFor(smooth, width, height, spanX, spanZ);
    return this.depthMap;
  }

  waveFieldFor(depths, width, height, spanX, spanZ) {
    const size = width * height;
    const land = new Uint8Array(size);
    for (let index = 0; index < size; index += 1) land[index] = depths[index] <= SHORE_EDGE ? 1 : 0;
    this.dropTinyIslands(land, width, height);
    const texel = ((spanX / (width - 1)) + (spanZ / (height - 1))) * 0.5;
    const potential = harmonicPotential(land, width, height);
    let gradientSum = 0;
    let gradientCount = 0;
    for (let j = 1; j < height - 1; j += 1) {
      const row = j * width;
      for (let i = 1; i < width - 1; i += 1) {
        const index = row + i;
        if (land[index]) continue;
        const gx = potential[index + 1] - potential[index - 1];
        const gz = potential[index + width] - potential[index - width];
        gradientSum += Math.hypot(gx, gz);
        gradientCount += 1;
      }
    }
    const meanGradient = gradientCount ? gradientSum / gradientCount : 0;
    const spread = meanGradient > 1e-6 ? (2 * texel) / meanGradient : Math.max(spanX, spanZ);
    const distance = new Float32Array(size);
    for (let index = 0; index < size; index += 1) distance[index] = -potential[index] * spread;
    this.blurField(distance, width, height, land);
    for (let j = 0; j < height; j += 1) {
      const row = j * width;
      const z = j * texel;
      for (let i = 0; i < width; i += 1) {
        const index = row + i;
        const x = i * texel;
        const fade = Math.min(1, Math.max(0, (distance[index] - 2) / 12));
        if (fade <= 0) continue;
        const wobble = smoothNoise(x / 30, z / 30) * SHORE_NOISE_LARGE
          + smoothNoise(x / 13, z / 13) * SHORE_NOISE_MID
          + smoothNoise(x / 5.5, z / 5.5) * SHORE_NOISE_SMALL;
        distance[index] += wobble * fade;
      }
    }
    if (this.waveDistMap) this.waveDistMap.dispose();
    const halves = new Uint16Array(distance.length);
    for (let index = 0; index < distance.length; index += 1) halves[index] = floatToHalf(distance[index]);
    this.waveDistMap = new RawTexture(halves, width, height, Constants.TEXTUREFORMAT_R, this.s, false, false, Texture.BILINEAR_SAMPLINGMODE, Constants.TEXTURETYPE_HALF_FLOAT);
    this.waveDistMap.wrapU = Texture.CLAMP_ADDRESSMODE;
    this.waveDistMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.waveDistData = distance;
    this.waveDistWidth = width;
    this.waveDistHeight = height;
  }

  dropTinyIslands(land, width, height) {
    const size = width * height;
    const seen = new Uint8Array(size);
    const stack = [];
    const blob = [];
    for (let start = 0; start < size; start += 1) {
      if (!land[start] || seen[start]) continue;
      blob.length = 0;
      stack.length = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const index = stack.pop();
        blob.push(index);
        const i = index % width;
        const j = (index - i) / width;
        if (i > 0 && land[index - 1] && !seen[index - 1]) {
          seen[index - 1] = 1;
          stack.push(index - 1);
        }
        if (i < width - 1 && land[index + 1] && !seen[index + 1]) {
          seen[index + 1] = 1;
          stack.push(index + 1);
        }
        if (j > 0 && land[index - width] && !seen[index - width]) {
          seen[index - width] = 1;
          stack.push(index - width);
        }
        if (j < height - 1 && land[index + width] && !seen[index + width]) {
          seen[index + width] = 1;
          stack.push(index + width);
        }
      }
      if (blob.length >= ISLAND_MIN_TEXELS) continue;
      for (const index of blob) land[index] = 0;
    }
  }

  blurField(field, width, height, land) {
    const temp = new Float32Array(field.length);
    const isLand = (index) => Boolean(land && land[index]);
    for (let pass = 0; pass < SHORE_BLUR_PASSES; pass += 1) {
      for (let j = 0; j < height; j += 1) {
        const row = j * width;
        for (let i = 0; i < width; i += 1) {
          if (isLand(row + i)) {
            temp[row + i] = field[row + i];
            continue;
          }
          let sum = 0;
          let count = 0;
          for (let k = -SHORE_BLUR_RADIUS; k <= SHORE_BLUR_RADIUS; k += 1) {
            const ii = i + k;
            if (ii < 0 || ii >= width) continue;
            if (isLand(row + ii)) continue;
            sum += field[row + ii];
            count += 1;
          }
          temp[row + i] = count ? sum / count : field[row + i];
        }
      }
      for (let j = 0; j < height; j += 1) {
        for (let i = 0; i < width; i += 1) {
          if (isLand(j * width + i)) {
            field[j * width + i] = temp[j * width + i];
            continue;
          }
          let sum = 0;
          let count = 0;
          for (let k = -SHORE_BLUR_RADIUS; k <= SHORE_BLUR_RADIUS; k += 1) {
            const jj = j + k;
            if (jj < 0 || jj >= height) continue;
            if (isLand(jj * width + i)) continue;
            sum += temp[jj * width + i];
            count += 1;
          }
          field[j * width + i] = count ? sum / count : temp[j * width + i];
        }
      }
    }
  }

  waveDistAt(x, z) {
    if (!this.waveDistData) return 0;
    const u = (x - this.depthOrigin.x) * this.depthScale.x;
    const v = (z - this.depthOrigin.y) * this.depthScale.y;
    const fx = Math.min(this.waveDistWidth - 1, Math.max(0, u * (this.waveDistWidth - 1)));
    const fz = Math.min(this.waveDistHeight - 1, Math.max(0, v * (this.waveDistHeight - 1)));
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    const i1 = Math.min(this.waveDistWidth - 1, i0 + 1);
    const j1 = Math.min(this.waveDistHeight - 1, j0 + 1);
    const tx = fx - i0;
    const tz = fz - j0;
    const data = this.waveDistData;
    const top = data[j0 * this.waveDistWidth + i0] * (1 - tx) + data[j0 * this.waveDistWidth + i1] * tx;
    const bottom = data[j1 * this.waveDistWidth + i0] * (1 - tx) + data[j1 * this.waveDistWidth + i1] * tx;
    return top * (1 - tz) + bottom * tz;
  }

  waveDirAt(x, z, out) {
    const result = out || { x: 1, z: 0 };
    result.x = 1;
    result.z = 0;
    if (!this.waveDistData) return result;
    const u = (x - this.depthOrigin.x) * this.depthScale.x;
    const v = (z - this.depthOrigin.y) * this.depthScale.y;
    const i = Math.min(this.waveDistWidth - 1, Math.max(0, Math.round(u * (this.waveDistWidth - 1))));
    const j = Math.min(this.waveDistHeight - 1, Math.max(0, Math.round(v * (this.waveDistHeight - 1))));
    const data = this.waveDistData;
    let gx = 0;
    let gz = 0;
    for (let dj = -1; dj <= 1; dj += 1) {
      const jj = Math.min(this.waveDistHeight - 1, Math.max(0, j + dj));
      const j0 = Math.max(0, jj - 1);
      const j1 = Math.min(this.waveDistHeight - 1, jj + 1);
      for (let di = -1; di <= 1; di += 1) {
        const ii = Math.min(this.waveDistWidth - 1, Math.max(0, i + di));
        const i0 = Math.max(0, ii - 1);
        const i1 = Math.min(this.waveDistWidth - 1, ii + 1);
        gx += data[jj * this.waveDistWidth + i1] - data[jj * this.waveDistWidth + i0];
        gz += data[j1 * this.waveDistWidth + ii] - data[j0 * this.waveDistWidth + ii];
      }
    }
    const length = Math.hypot(gx, gz);
    if (length > 1e-4) {
      result.x = gx / length;
      result.z = gz / length;
    }
    return result;
  }

  setDetail(on) {
    this.detail = on !== false;
    if (this.material) this.material.setFloat('waterDetail', this.detail ? 1 : 0);
  }

  bumpTextures() {
    if (!this.bumpDetail) {
      this.bumpDetail = new Texture(`${ASSET_DIRS.textures}water_normals.jpg`, this.s, false, false, Texture.TRILINEAR_SAMPLINGMODE);
      this.bumpDetail.wrapU = Texture.WRAP_ADDRESSMODE;
      this.bumpDetail.wrapV = Texture.WRAP_ADDRESSMODE;
    }
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
    this.depthMapFor(level, heightAt, x0, x1, z0, z1);
    const positions = [];
    const depths = [];
    const waveDirs = [];
    const waveDists = [];
    const vertexDir = { x: 1, z: 0 };
    for (let j = 0; j <= rows; j += 1) {
      const z = z0 + j * dz;
      for (let i = 0; i <= cols; i += 1) {
        const x = x0 + i * dx;
        const drop = level - heightAt(x, z);
        const depth = Math.max(0, drop);
        positions.push(x, surfaceY, z);
        depths.push(depth);
        this.waveDirAt(x, z, vertexDir);
        waveDirs.push(vertexDir.x, vertexDir.z);
        waveDists.push(this.waveDistAt(x, z));
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
    mesh.setVerticesData('waveAmp', new Float32Array(depths.map((depth) => waveAmpFor(depth, MAX_DEPTH))), false, 1);
    mesh.setVerticesData('waveDir', new Float32Array(waveDirs), false, 2);
    mesh.setVerticesData('waveDist', new Float32Array(waveDists), false, 1);
    mesh.isPickable = false;
    mesh.alphaIndex = 2;
    const material = this.materialFor();
    material.setFloat('waterLevel', level);
    material.setTexture('depthMap', this.depthMap);
    this.bumpTextures();
    material.setTexture('bumpDetail', this.bumpDetail);
    material.setTexture('waveDistMap', this.waveDistMap);
    material.setFloat('waterDetail', this.detail ? 1 : 0);
    material.setVector2('depthOrigin', this.depthOrigin);
    material.setVector2('depthScale', this.depthScale);
    material.setFloat('depthRange', DEPTH_RANGE);
    this.reflectionFor(quality, surfaceY);
    mesh.material = material;
    this.mesh = mesh;
    material.disableDepthWrite = true;

    const sidePositions = [];
    const sideUvs = [];
    const sideIndices = [];
    const sideAmps = [];
    const sideDists = [];
    const vertex = (i, j) => {
      const index = j * (cols + 1) + i;
      return {
        x: positions[index * 3],
        z: positions[index * 3 + 2],
        depth: depths[index],
        dist: waveDists[index],
      };
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
      sideAmps.push(waveAmpFor(a.depth, MAX_DEPTH), 0, waveAmpFor(b.depth, MAX_DEPTH), 0);
      sideDists.push(a.dist, a.dist, b.dist, b.dist);
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
      sides.setVerticesData('waveDist', new Float32Array(sideDists), false, 1);
      sides.isPickable = false;
      sides.alphaIndex = 1;
      const base = this.waterRgb || FALLBACK_RGB;
      sides.material = createWaterSideMaterial(this.s, {
        shallowColor: this.sideColor(base, 1.9, 0.05),
        deepColor: this.sideColor(base, 0.45, 0),
        foamColor: new Color3(0.62, 0.72, 0.73),
      });
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
