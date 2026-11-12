// Část vodního systému: jezera a řeky — hladiny mimo moře, každá jen na svých buňkách.
// Jezero má všude stejnou výšku a stojí, řeka po proudu klesá a teče. Patří k WaterSystem (sdílí jeho this).
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
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const SMOOTH_PASSES = 2;
const SHORE_SPILL = 0.75;
const VALUES = 4;

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

function cellValues(cells) {
  const own = new Map();
  for (const cell of cells) own.set(cellKey(cell.cx, cell.cz), [cell.level, cell.flowX || 0, cell.flowZ || 0, cell.rapids || 0]);
  const ring = new Map();
  for (const cell of cells) {
    for (const [dx, dz] of AROUND) {
      const key = cellKey(cell.cx + dx, cell.cz + dz);
      if (own.has(key)) continue;
      const sum = ring.get(key) || [0, 0, 0, 0, 0];
      const values = own.get(cellKey(cell.cx, cell.cz));
      for (let k = 0; k < VALUES; k += 1) sum[k] += values[k];
      sum[VALUES] += 1;
      ring.set(key, sum);
    }
  }
  const all = new Map(own);
  for (const [key, sum] of ring) all.set(key, sum.slice(0, VALUES).map((value) => value / sum[VALUES]));
  return { own, all };
}

function smoothValues(values, inReach, width, height) {
  const temp = new Float32Array(values.length);
  for (let pass = 0; pass < SMOOTH_PASSES; pass += 1) {
    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const index = j * width + i;
        if (!inReach[index]) {
          for (let k = 0; k < VALUES; k += 1) temp[index * VALUES + k] = values[index * VALUES + k];
          continue;
        }
        const sum = [0, 0, 0, 0];
        let count = 0;
        for (let dj = -1; dj <= 1; dj += 1) {
          for (let di = -1; di <= 1; di += 1) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= width || jj >= height) continue;
            const next = jj * width + ii;
            if (!inReach[next]) continue;
            for (let k = 0; k < VALUES; k += 1) sum[k] += values[next * VALUES + k];
            count += 1;
          }
        }
        for (let k = 0; k < VALUES; k += 1) temp[index * VALUES + k] = sum[k] / count;
      }
    }
    values.set(temp);
  }
}

function spreadValues(values, inReach, width, height) {
  let filled = Uint8Array.from(inReach);
  for (let pass = 0; pass < 2; pass += 1) {
    const next = Uint8Array.from(filled);
    for (let index = 0; index < filled.length; index += 1) {
      if (filled[index]) continue;
      const i = index % width;
      const j = (index - i) / width;
      for (const [di, dj] of AROUND) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= width || jj >= height) continue;
        const from = jj * width + ii;
        if (!filled[from]) continue;
        for (let k = 0; k < VALUES; k += 1) values[index * VALUES + k] = values[from * VALUES + k];
        next[index] = 1;
        break;
      }
    }
    filled = next;
  }
}

export default {
  buildBodies(bodies, heightAt, step) {
    this.clearBodies();
    for (const body of bodies || []) {
      const built = this.buildBody(body, heightAt, step, this.bodies.length);
      if (built) this.bodies.push(built);
    }
  },

  clearBodies() {
    for (const body of this.bodies) {
      if (body.mesh && !body.mesh.isDisposed()) body.mesh.dispose(false, false);
      body.material.dispose(false, false);
      body.texture.dispose();
    }
    this.bodies = [];
  },

  buildBody(body, heightAt, step, index) {
    const cells = body && Array.isArray(body.cells) ? body.cells.filter((cell) => Number.isFinite(cell.level)) : [];
    if (!cells.length) return null;
    const { own, all } = cellValues(cells);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const { cx, cz } of cells) {
      minX = Math.min(minX, cx - 1);
      maxX = Math.max(maxX, cx + 1);
      minZ = Math.min(minZ, cz - 1);
      maxZ = Math.max(maxZ, cz + 1);
    }
    const x0 = minX * CELL_SIZE - HALF;
    const x1 = maxX * CELL_SIZE + HALF;
    const z0 = minZ * CELL_SIZE - HALF;
    const z1 = maxZ * CELL_SIZE + HALF;
    const field = this.bodyField(own, all, heightAt, x0, x1, z0, z1);
    if (!field) return null;

    const cols = Math.max(1, Math.ceil((x1 - x0) / step));
    const rows = Math.max(1, Math.ceil((z1 - z0) / step));
    const dx = (x1 - x0) / cols;
    const dz = (z1 - z0) / rows;
    const count = (cols + 1) * (rows + 1);
    const positions = [];
    const flows = new Float32Array(count * 3);
    for (let j = 0; j <= rows; j += 1) {
      for (let i = 0; i <= cols; i += 1) {
        const x = x0 + i * dx;
        const z = z0 + j * dz;
        const vertex = j * (cols + 1) + i;
        positions.push(x, this.fieldValue(field, x, z, 0) - WATER_SINK, z);
        flows[vertex * 3] = this.fieldValue(field, x, z, 1);
        flows[vertex * 3 + 1] = this.fieldValue(field, x, z, 2);
        flows[vertex * 3 + 2] = this.fieldValue(field, x, z, 3);
      }
    }
    const indices = [];
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        if (!all.has(cellOf(x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dz))) continue;
        const a = j * (cols + 1) + i;
        const b = a + 1;
        const c = a + cols + 2;
        const d = a + cols + 1;
        indices.push(a, c, b, a, d, c);
      }
    }
    if (!indices.length) {
      field.texture.dispose();
      return null;
    }
    const mesh = new Mesh(`waterBody${index}`, this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.applyToMesh(mesh);
    mesh.setVerticesData('waveAmp', new Float32Array(count), false, 1);
    mesh.setVerticesData('waveDist', new Float32Array(count).fill(LAKE_OPEN_DIST), false, 1);
    mesh.setVerticesData('waveDir', new Float32Array(count * 2), false, 2);
    mesh.setVerticesData('waveCliff', new Float32Array(count), false, 1);
    mesh.setVerticesData('waveFlow', flows, false, 3);
    mesh.isPickable = false;
    mesh.alphaIndex = 2;

    const material = createWaterMaterial(this.s, { ...this.colorOptions(), swellScale: 0 });
    material.setTexture('depthMap', field.texture);
    material.setTexture('reflectionSampler', field.texture);
    material.setFloat('reflectionOn', 0);
    material.setVector2('depthOrigin', new Vector2(x0, z0));
    material.setVector2('depthScale', new Vector2(1 / (x1 - x0), 1 / (z1 - z0)));
    material.setFloat('depthRange', DEPTH_RANGE);
    material.setVector2('foamDir', new Vector2(LAKE_FOAM_DIR[0], LAKE_FOAM_DIR[1]));
    material.disableDepthWrite = true;
    mesh.material = material;
    mesh.setEnabled(!this.hidden);
    return { kind: body.kind, cells, mesh, material, ...field };
  },

  bodyField(own, all, heightAt, x0, x1, z0, z1) {
    const spanX = x1 - x0;
    const spanZ = z1 - z0;
    const width = Math.max(2, Math.min(DEPTH_MAX, Math.ceil(spanX / DEPTH_STEP) + 1));
    const height = Math.max(2, Math.min(DEPTH_MAX, Math.ceil(spanZ / DEPTH_STEP) + 1));
    const stepX = spanX / (width - 1);
    const stepZ = spanZ / (height - 1);
    const size = width * height;
    const values = new Float32Array(size * VALUES);
    const inReach = new Uint8Array(size);
    const nearOwn = new Uint8Array(size);
    const cellIds = new Array(size);
    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const index = j * width + i;
        const x = x0 + i * stepX;
        const z = z0 + j * stepZ;
        const id = cellOf(x, z);
        cellIds[index] = id;
        const cell = all.get(id);
        if (!cell) continue;
        inReach[index] = 1;
        nearOwn[index] = own.has(id) || this.ownWithin(own, x, z, SHORE_SPILL) ? 1 : 0;
        for (let k = 0; k < VALUES; k += 1) values[index * VALUES + k] = cell[k];
      }
    }
    smoothValues(values, inReach, width, height);
    spreadValues(values, inReach, width, height);
    const raw = new Float32Array(size);
    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const index = j * width + i;
        const ground = heightAt(x0 + i * stepX, z0 + j * stepZ);
        raw[index] = inReach[index] && Number.isFinite(ground) ? values[index * VALUES] - ground : -1;
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
        if (mask[next] || raw[next] <= 0 || !nearOwn[next]) continue;
        mask[next] = 1;
        stack.push(next);
      }
    }
    const shore = [];
    for (let index = 0; index < size; index += 1) {
      if (mask[index] || !nearOwn[index]) continue;
      const i = index % width;
      const j = (index - i) / width;
      const touches = SIDES.some(([di, dj]) => {
        const ii = i + di;
        const jj = j + dj;
        return ii >= 0 && jj >= 0 && ii < width && jj < height && mask[jj * width + ii] === 1;
      });
      if (touches) shore.push(index);
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
    return { texture, mask, values, width, height, x0, z0, stepX, stepZ };
  },

  ownWithin(own, x, z, reach) {
    const cx = Math.floor((x + HALF) / CELL_SIZE);
    const cz = Math.floor((z + HALF) / CELL_SIZE);
    for (const [dx, dz] of AROUND) {
      if (!own.has(cellKey(cx + dx, cz + dz))) continue;
      const gapX = Math.max(0, Math.abs(x - (cx + dx) * CELL_SIZE) - HALF);
      const gapZ = Math.max(0, Math.abs(z - (cz + dz) * CELL_SIZE) - HALF);
      if (Math.max(gapX, gapZ) <= reach) return true;
    }
    return false;
  },

  fieldValue(field, x, z, channel) {
    const fx = Math.min(field.width - 1, Math.max(0, (x - field.x0) / field.stepX));
    const fz = Math.min(field.height - 1, Math.max(0, (z - field.z0) / field.stepZ));
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    const i1 = Math.min(field.width - 1, i0 + 1);
    const j1 = Math.min(field.height - 1, j0 + 1);
    const tx = fx - i0;
    const tz = fz - j0;
    const at = (i, j) => field.values[(j * field.width + i) * VALUES + channel];
    const top = at(i0, j0) * (1 - tx) + at(i1, j0) * tx;
    const bottom = at(i0, j1) * (1 - tx) + at(i1, j1) * tx;
    return top * (1 - tz) + bottom * tz;
  },

  bodyAt(x, z) {
    for (const body of this.bodies) {
      const i = Math.round((x - body.x0) / body.stepX);
      const j = Math.round((z - body.z0) / body.stepZ);
      if (i < 0 || j < 0 || i >= body.width || j >= body.height) continue;
      if (body.mask[j * body.width + i]) return body;
    }
    return null;
  },

  bodyLevelAt(body, x, z) {
    return this.fieldValue(body, x, z, 0);
  },

  bodySurfaceAt(body, x, z) {
    return this.bodyLevelAt(body, x, z) - WATER_SINK;
  },

  bodyDepthAt(body, x, z) {
    const ground = this.groundAt ? this.groundAt(x, z) : null;
    return Number.isFinite(ground) ? Math.max(0, this.bodySurfaceAt(body, x, z) - ground) : 0;
  },

  surfaceMaterials() {
    const list = this.material ? [this.material] : [];
    for (const body of this.bodies) list.push(body.material);
    return list;
  },
};
