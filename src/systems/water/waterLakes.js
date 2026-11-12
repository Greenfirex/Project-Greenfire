// Část vodního systému: jezera — klidné hladiny v různých výškách, každá jen ve své prohlubni.
// Patří k WaterSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { CELL_SIZE, cellKey } from '../../utils/gridMath.js';
import { createWaterMaterial } from './waterShader.js';
import { WATER_SINK, DEPTH_STEP, DEPTH_MAX, DEPTH_RANGE, CLIFF_DEPTH_JUMP, LAKE_OPEN_DIST, LAKE_FOAM_DIR } from './waterSettings.js';

const HALF = CELL_SIZE / 2;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function cellOf(x, z) {
  return cellKey(Math.floor((x + HALF) / CELL_SIZE), Math.floor((z + HALF) / CELL_SIZE));
}

export function extendIntoCliffs(raw, out, width, height) {
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const index = j * width + i;
      if (raw[index] > 0) continue;
      let deep = 0;
      for (const [di, dj] of SIDES) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= width || jj >= height) continue;
        const value = raw[jj * width + ii];
        if (value - raw[index] < CLIFF_DEPTH_JUMP) continue;
        if (value > deep) deep = value;
      }
      if (deep > 0) out[index] = deep;
    }
  }
}

export default {
  buildLakes(lakes, heightAt, step) {
    this.clearLakes();
    for (const lake of lakes || []) {
      const built = this.buildLake(lake, heightAt, step, this.lakes.length);
      if (built) this.lakes.push(built);
    }
  },

  clearLakes() {
    for (const lake of this.lakes) {
      if (lake.mesh && !lake.mesh.isDisposed()) lake.mesh.dispose(false, false);
      lake.material.dispose(false, false);
      lake.texture.dispose();
    }
    this.lakes = [];
  },

  buildLake({ level, cells }, heightAt, step, index) {
    if (!Number.isFinite(level) || !cells || !cells.length) return null;
    const own = new Set();
    const reach = new Set();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [cx, cz] of cells) {
      own.add(cellKey(cx, cz));
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) reach.add(cellKey(cx + dx, cz + dz));
      }
      minX = Math.min(minX, cx - 1);
      maxX = Math.max(maxX, cx + 1);
      minZ = Math.min(minZ, cz - 1);
      maxZ = Math.max(maxZ, cz + 1);
    }
    const x0 = minX * CELL_SIZE - HALF;
    const x1 = maxX * CELL_SIZE + HALF;
    const z0 = minZ * CELL_SIZE - HALF;
    const z1 = maxZ * CELL_SIZE + HALF;
    const depth = this.lakeDepthMap(level, heightAt, own, reach, x0, x1, z0, z1);
    if (!depth) return null;

    const surfaceY = level - WATER_SINK;
    const cols = Math.max(1, Math.ceil((x1 - x0) / step));
    const rows = Math.max(1, Math.ceil((z1 - z0) / step));
    const dx = (x1 - x0) / cols;
    const dz = (z1 - z0) / rows;
    const positions = [];
    for (let j = 0; j <= rows; j += 1) {
      for (let i = 0; i <= cols; i += 1) positions.push(x0 + i * dx, surfaceY, z0 + j * dz);
    }
    const indices = [];
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        if (!reach.has(cellOf(x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dz))) continue;
        const a = j * (cols + 1) + i;
        const b = a + 1;
        const c = a + cols + 2;
        const d = a + cols + 1;
        indices.push(a, c, b, a, d, c);
      }
    }
    if (!indices.length) {
      depth.texture.dispose();
      return null;
    }
    const count = (cols + 1) * (rows + 1);
    const mesh = new Mesh(`lakeSurface${index}`, this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.applyToMesh(mesh);
    mesh.setVerticesData('waveAmp', new Float32Array(count), false, 1);
    mesh.setVerticesData('waveDist', new Float32Array(count).fill(LAKE_OPEN_DIST), false, 1);
    mesh.setVerticesData('waveDir', new Float32Array(count * 2), false, 2);
    mesh.setVerticesData('waveCliff', new Float32Array(count), false, 1);
    mesh.isPickable = false;
    mesh.alphaIndex = 2;

    const material = createWaterMaterial(this.s, { ...this.colorOptions(), swellScale: 0 });
    material.setFloat('waterLevel', level);
    material.setTexture('depthMap', depth.texture);
    material.setTexture('reflectionSampler', depth.texture);
    material.setFloat('reflectionOn', 0);
    material.setVector2('depthOrigin', new Vector2(x0, z0));
    material.setVector2('depthScale', new Vector2(1 / (x1 - x0), 1 / (z1 - z0)));
    material.setFloat('depthRange', DEPTH_RANGE);
    material.setVector2('foamDir', new Vector2(LAKE_FOAM_DIR[0], LAKE_FOAM_DIR[1]));
    material.disableDepthWrite = true;
    mesh.material = material;
    mesh.setEnabled(!this.hidden);
    return { level, surfaceY, cells, mesh, material, ...depth };
  },

  lakeDepthMap(level, heightAt, own, reach, x0, x1, z0, z1) {
    const spanX = x1 - x0;
    const spanZ = z1 - z0;
    const width = Math.max(2, Math.min(DEPTH_MAX, Math.ceil(spanX / DEPTH_STEP) + 1));
    const height = Math.max(2, Math.min(DEPTH_MAX, Math.ceil(spanZ / DEPTH_STEP) + 1));
    const stepX = spanX / (width - 1);
    const stepZ = spanZ / (height - 1);
    const size = width * height;
    const raw = new Float32Array(size);
    const cellIds = new Array(size);
    for (let j = 0; j < height; j += 1) {
      const z = z0 + j * stepZ;
      for (let i = 0; i < width; i += 1) {
        const x = x0 + i * stepX;
        const index = j * width + i;
        const ground = heightAt(x, z);
        raw[index] = Number.isFinite(ground) ? level - ground : -1;
        cellIds[index] = cellOf(x, z);
      }
    }
    const mask = new Uint8Array(size);
    const stack = [];
    for (let index = 0; index < size; index += 1) {
      if (raw[index] <= 0 || !own.has(cellIds[index])) continue;
      mask[index] = 1;
      stack.push(index);
    }
    if (!stack.length) return null;
    while (stack.length) {
      const index = stack.pop();
      const i = index % width;
      const j = (index - i) / width;
      for (const [di, dj] of SIDES) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= width || jj >= height) continue;
        const next = jj * width + ii;
        if (mask[next] || raw[next] <= 0 || !reach.has(cellIds[next])) continue;
        mask[next] = 1;
        stack.push(next);
      }
    }
    const shore = [];
    for (let index = 0; index < size; index += 1) {
      if (mask[index]) continue;
      const i = index % width;
      const j = (index - i) / width;
      const touches = SIDES.some(([di, dj]) => {
        const ii = i + di;
        const jj = j + dj;
        return ii >= 0 && jj >= 0 && ii < width && jj < height && mask[jj * width + ii] === 1;
      });
      if (touches && reach.has(cellIds[index])) shore.push(index);
    }
    for (const index of shore) mask[index] = 1;
    const shown = Float32Array.from(raw);
    extendIntoCliffs(raw, shown, width, height);
    const data = new Uint8Array(size * 4);
    for (let index = 0; index < size; index += 1) {
      const normalized = Math.min(1, Math.max(0, 0.5 + shown[index] / (2 * DEPTH_RANGE)));
      data[index * 4] = Math.round(normalized * 255);
      data[index * 4 + 2] = mask[index] ? 255 : 0;
      data[index * 4 + 3] = 255;
    }
    const texture = new RawTexture(data, width, height, Constants.TEXTUREFORMAT_RGBA, this.s, false, false, Texture.BILINEAR_SAMPLINGMODE);
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    return { texture, mask, width, height, x0, z0, stepX, stepZ };
  },

  lakeAt(x, z) {
    for (const lake of this.lakes) {
      const i = Math.round((x - lake.x0) / lake.stepX);
      const j = Math.round((z - lake.z0) / lake.stepZ);
      if (i < 0 || j < 0 || i >= lake.width || j >= lake.height) continue;
      if (lake.mask[j * lake.width + i]) return lake;
    }
    return null;
  },

  lakeDepthAt(lake, x, z) {
    const ground = this.groundAt ? this.groundAt(x, z) : null;
    return Number.isFinite(ground) ? Math.max(0, lake.surfaceY - ground) : 0;
  },

  surfaceMaterials() {
    const list = this.material ? [this.material] : [];
    for (const lake of this.lakes) list.push(lake.material);
    return list;
  },
};
