// Terén krajiny — spojitá plocha podle druhu povrchu, bok mapy a neviditelná vrstva pro klikání.
// Výšku bere z výškového modelu, takže mezi buňkami nevznikají štěrbiny.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { CELL_SIZE } from '../utils/gridMath.js';
import { createTerrainField } from '../utils/terrainField.js';
import { getMap } from '../data/catalogs/maps.js';
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { groundCells, worldCells } from '../data/maps/areaShape.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import TerrainBlendPlugin from './terrainBlendPlugin.js';
import TerrainCausticPlugin from './terrainCausticPlugin.js';
import TerrainWetPlugin from './terrainWetPlugin.js';

const PICK_LIFT = 0.002;
const GRID_LIFT = 0.02;
const GRID_SUB = 2;
const SURFACE_SUB = 4;
const SKIRT_DEPTH = 2;
const WALL_TILE = 3;
const WALL_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const CLIFF_TEXTURE = `${ASSET_DIRS.textures}Rock030_1K-JPG_Color.jpg`;
const CLIFF_NORMAL = `${ASSET_DIRS.textures}Rock030_1K-JPG_NormalGL.jpg`;
const CLAY_CLIFF_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const SURFACE_BLEND_RADIUS = 1.8;
const SURFACE_BLEND_SOFTMIN = 0.35;
const SURFACE_BLEND_COLLAR = 0.25;
const SURFACE_BLEND_TEXEL = CELL_SIZE / 8;
const SURFACE_BLEND_NOISE = CELL_SIZE;
const SURFACE_BLEND_GRAIN = CELL_SIZE / 4;
const SURFACE_BLEND_WARP = CELL_SIZE * 2.2;
const SURFACE_BLEND_TONGUE = CELL_SIZE * 1.1;
const SURFACE_BLEND_SPECK = CELL_SIZE * 0.45;
const SURFACE_BLEND_SPECK_MIN = 10;
const SURFACE_BLEND_SPECK_EDGE = 0.78;
const SURFACE_BLEND_SPECK_MAX = 92;
const BLEND_NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const CLIFF_WAVE = 0.16;
const CLIFF_WAVE_SCALE = 0.45;
const SURFACE_SIDES = [
  { dx: -1, dz: 0 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
  { dx: 0, dz: 1 },
];

function pointId(gx, gz) {
  return `${Math.round(gx * 2)},${Math.round(gz * 2)}`;
}

function hash01(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash01(ix, iz);
  const b = hash01(ix + 1, iz);
  const c = hash01(ix, iz + 1);
  const d = hash01(ix + 1, iz + 1);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sz;
}

function cliffOffset(x, z) {
  return (valueNoise(x * CLIFF_WAVE_SCALE + 11.3, z * CLIFF_WAVE_SCALE - 7.1) - 0.5) * 2 * CLIFF_WAVE;
}

function wallBetween(field, ax, az, bx, bz) {
  const sx = Math.sign(bx - ax);
  const sz = Math.sign(bz - az);
  if (sx && (field.isHardEdge(ax, az, sx, 0) || field.isHardEdge(bx, bz, -sx, 0))) return true;
  if (sz && (field.isHardEdge(ax, az, 0, sz) || field.isHardEdge(bx, bz, 0, -sz))) return true;
  return false;
}

function smoothCoincidentNormals(positions, normals) {
  const buckets = new Map();
  const total = positions.length / 3;
  for (let i = 0; i < total; i += 1) {
    const key = `${Math.round(positions[i * 3] * 100)},${Math.round(positions[i * 3 + 1] * 100)},${Math.round(positions[i * 3 + 2] * 100)}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const sums = list.map(() => null);
    for (let i = 0; i < list.length; i += 1) {
      const index = list[i];
      const nx = normals[index * 3];
      const ny = normals[index * 3 + 1];
      const nz = normals[index * 3 + 2];
      let x = 0;
      let y = 0;
      let z = 0;
      let count = 0;
      for (const other of list) {
        const ox = normals[other * 3];
        const oy = normals[other * 3 + 1];
        const oz = normals[other * 3 + 2];
        if (nx * ox + ny * oy + nz * oz < 0.6) continue;
        x += ox;
        y += oy;
        z += oz;
        count += 1;
      }
      if (count < 2) continue;
      const length = Math.hypot(x, y, z);
      if (length < 1e-6) continue;
      sums[i] = [x / length, y / length, z / length];
    }
    for (let i = 0; i < list.length; i += 1) {
      const value = sums[i];
      if (!value) continue;
      const index = list[i];
      normals[index * 3] = value[0];
      normals[index * 3 + 1] = value[1];
      normals[index * 3 + 2] = value[2];
    }
  }
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
    this.blendPlugins = new Map();
    this.blendTextures = new Map();
    this.weightTextures = [];
    this.causticPlugins = [];
    this.wetPlugins = [];
    this.skirtMaterial = null;
    this.cliffMaterials = null;
    this.skirtMesh = null;
    this.gridLines = null;
    this.field = null;
    this.mapKey = null;
    this.ready = Promise.resolve(null);
  }

  whenReady() {
    return this.ready || Promise.resolve();
  }

  heightAt(x, z) {
    return this.field ? this.field.heightAt(x, z) : 0;
  }

  heightAtCell(cx, cz) {
    return this.field ? this.field.heightAtCell(cx, cz) : 0;
  }

  clear() {
    for (const mesh of [this.ground, this.gridLines, ...this.surfaces]) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.ground = null;
    this.surfaces = [];
    this.skirtMesh = null;
    this.gridLines = null;
    this.field = null;
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
    this.field = createTerrainField(world);
    this.createSurface(map, this.groundCells);
    this.createSkirt(this.groundCells);
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
    for (const texture of this.weightTextures) texture.dispose();
    this.weightTextures = [];

    const tint = new Color3(0.72, 0.7, 0.64);
    const step = CELL_SIZE / SURFACE_SUB;
    const half = CELL_SIZE / 2;
    const groups = new Map();
    const keys = new Map();
    const floorKeys = new Map();
    for (const entry of (this.layout || {}).floor || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      if (entry.key) floorKeys.set(`${entry.cx},${entry.cz}`, entry.key);
    }
    for (const [cx, cz] of cells) {
      keys.set(`${cx},${cz}`, floorKeys.get(`${cx},${cz}`) || DEFAULT_FLOOR);
    }
    const keyAt = (cx, cz) => keys.get(`${cx},${cz}`) || null;
    const field = this.field;
    const spreads = (key) => {
      const cfg = this.surfaceConfig(key);
      return Boolean(cfg && cfg.spreads);
    };
    const partnerFor = (key) => {
      if (spreads(key)) return null;
      const counts = new Map();
      for (const [cx, cz] of cells) {
        if (keyAt(cx, cz) !== key) continue;
        for (const [dx, dz] of BLEND_NEIGHBORS) {
          const other = keyAt(cx + dx, cz + dz);
          if (!other || other === key || !spreads(other)) continue;
          counts.set(other, (counts.get(other) || 0) + 1);
        }
      }
      let partner = null;
      let best = 0;
      for (const [other, count] of counts) {
        if (count > best) {
          best = count;
          partner = other;
        }
      }
      return partner;
    };
    const weightsFor = (partner) => {
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
      const x0 = minX * CELL_SIZE - half;
      const x1 = maxX * CELL_SIZE + half;
      const z0 = minZ * CELL_SIZE - half;
      const z1 = maxZ * CELL_SIZE + half;
      const spanX = x1 - x0;
      const spanZ = z1 - z0;
      const width = Math.max(2, Math.ceil(spanX / SURFACE_BLEND_TEXEL));
      const height = Math.max(2, Math.ceil(spanZ / SURFACE_BLEND_TEXEL));
      const data = new Uint8Array(width * height);
      const smooth = (t) => t * t * (3 - 2 * t);
      const waterLevel = this.layout && Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
      const isDry = (cx, cz) => waterLevel === null || field.heightAtCell(cx, cz) > waterLevel + 0.001;
      const blockedFrom = (cx, cz, nx, nz) => {
        const dx = nx - cx;
        const dz = nz - cz;
        if (dx && dz) {
          const blockedA = wallBetween(field, cx, cz, cx + dx, cz) || wallBetween(field, cx + dx, cz, nx, nz);
          const blockedB = wallBetween(field, cx, cz, cx, cz + dz) || wallBetween(field, cx, cz + dz, nx, nz);
          return blockedA && blockedB;
        }
        return wallBetween(field, cx, cz, nx, nz);
      };
      const wallCache = new Map();
      const againstWall = (cx, cz) => {
        const id = `${cx},${cz}`;
        if (wallCache.has(id)) return wallCache.get(id);
        const value = BLEND_NEIGHBORS.some(([dx, dz]) => (
          field.isSharp(cx + dx, cz + dz) && blockedFrom(cx, cz, cx + dx, cz + dz)
        ));
        wallCache.set(id, value);
        return value;
      };
      for (let j = 0; j < height; j += 1) {
        const z = z0 + (j + 0.5) * (spanZ / height);
        for (let i = 0; i < width; i += 1) {
          const x = x0 + (i + 0.5) * (spanX / width);
          const cx = Math.floor((x + half) / CELL_SIZE);
          const cz = Math.floor((z + half) / CELL_SIZE);
          if (field.isSharp(cx, cz)) continue;
          if (keyAt(cx, cz) === partner) {
            data[j * width + i] = isDry(cx, cz) && againstWall(cx, cz) ? 0 : 255;
            continue;
          }
          let reach = 0;
          for (const [dx, dz] of BLEND_NEIGHBORS) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (field.isSharp(nx, nz)) continue;
            if (keyAt(nx, nz) !== partner) continue;
            if (isDry(cx, cz) && blockedFrom(cx, cz, nx, nz)) continue;
            const gapX = Math.abs(x - nx * CELL_SIZE) - half;
            const gapZ = Math.abs(z - nz * CELL_SIZE) - half;
            const distance = Math.hypot(Math.max(gapX, 0), Math.max(gapZ, 0));
            reach += Math.exp(-distance / SURFACE_BLEND_SOFTMIN);
          }
          if (reach <= 0) continue;
          const soft = Math.max(0, -SURFACE_BLEND_SOFTMIN * Math.log(reach));
          const coarse = valueNoise(x / SURFACE_BLEND_NOISE, z / SURFACE_BLEND_NOISE);
          const fine = valueNoise(x / SURFACE_BLEND_GRAIN + 13.7, z / SURFACE_BLEND_GRAIN - 5.1);
          const warp = valueNoise(x / SURFACE_BLEND_WARP + 41.3, z / SURFACE_BLEND_WARP - 17.9);
          const tongue = valueNoise(
            x / SURFACE_BLEND_TONGUE + warp * 2.6,
            z / SURFACE_BLEND_TONGUE - warp * 2.1,
          );
          const band = SURFACE_BLEND_RADIUS
            * (0.65 + 0.7 * coarse)
            * (0.9 + 0.2 * fine)
            * (0.55 + 0.9 * tongue);
          const fade = Math.min(1, Math.max(0, (soft - SURFACE_BLEND_COLLAR) / band));
          let weight = Math.round((1 - smooth(fade)) * 255);
          if (weight < SURFACE_BLEND_SPECK_MIN) {
            const speck = valueNoise(x / SURFACE_BLEND_SPECK + 71.1, z / SURFACE_BLEND_SPECK - 29.3);
            if (speck > SURFACE_BLEND_SPECK_EDGE) {
              const amount = (speck - SURFACE_BLEND_SPECK_EDGE) / (1 - SURFACE_BLEND_SPECK_EDGE);
              weight = Math.round(amount * SURFACE_BLEND_SPECK_MAX);
            }
          }
          data[j * width + i] = weight;
        }
      }
      const texture = new RawTexture(data, width, height, Constants.TEXTUREFORMAT_R, this.s, false, false, Texture.BILINEAR_SAMPLINGMODE);
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      this.weightTextures.push(texture);
      return { texture, origin: new Vector2(x0, z0), scale: new Vector2(1 / spanX, 1 / spanZ) };
    };
    const groupFor = (key) => {
      let group = groups.get(key);
      if (!group) {
        const cfg = this.surfaceConfig(key);
        group = {
          positions: [],
          indices: [],
          uvs: [],
          colors: [],
          vertices: new Map(),
          tile: (cfg && cfg.tile) || 1,
        };
        groups.set(key, group);
      }
      return group;
    };
    const slot = (group, x, z, px = x, pz = z, py = null, owner = null) => {
      const id = owner ? `${x},${z}|${owner}` : `${x},${z}`;
      const found = group.vertices.get(id);
      if (found !== undefined) return found;
      const index = group.positions.length / 3;
      group.vertices.set(id, index);
      const y = py === null ? this.heightAt(px, pz) : py;
      group.positions.push(px, y, pz);
      group.uvs.push(px / group.tile, pz / group.tile);
      group.colors.push(tint.r, tint.g, tint.b, 1);
      return index;
    };

    const cliffPoints = new Set();
    const cliffShifts = new Map();
    for (const [cx, cz] of cells) {
      if (!keyAt(cx, cz)) continue;
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (const side of SURFACE_SIDES) {
        if (side.dx < 0 || side.dz < 0) continue;
        const nx = cx + side.dx;
        const nz = cz + side.dz;
        if (!keyAt(nx, nz)) continue;
        if (!field.isHardEdge(cx, cz, side.dx, side.dz)) continue;
        let x1;
        let z1;
        let x2;
        let z2;
        if (side.dx) {
          x1 = x0 + CELL_SIZE;
          z1 = z0;
          x2 = x1;
          z2 = z0 + CELL_SIZE;
        } else {
          x1 = x0;
          z1 = z0 + CELL_SIZE;
          x2 = x0 + CELL_SIZE;
          z2 = z1;
        }
        for (let i = 0; i <= SURFACE_SUB; i += 1) {
          const t = i / SURFACE_SUB;
          const gx = x1 + (x2 - x1) * t;
          const gz = z1 + (z2 - z1) * t;
          const id = pointId(gx, gz);
          cliffPoints.add(id);
          if (i === 0 || i === SURFACE_SUB) continue;
          const entry = cliffShifts.get(id) || { x: 0, z: 0 };
          if (side.dx) entry.x = cliffOffset(gx, gz);
          else entry.z = cliffOffset(gx + 37.9, gz - 19.4);
          cliffShifts.set(id, entry);
        }
      }
    }

    const positionOf = (point) => {
      const id = pointId(point.gx, point.gz);
      const shift = cliffPoints.has(id) ? cliffShifts.get(id) : null;
      return {
        px: point.gx + (shift ? shift.x : 0),
        pz: point.gz + (shift ? shift.z : 0),
      };
    };
    const heightOf = (point, cx, cz) => {
      const pos = positionOf(point);
      return field.heightAtSide(pos.px, pos.pz, cx, cz);
    };
    const wallEdges = [];
    for (const [cx, cz] of cells) {
      if (!keyAt(cx, cz)) continue;
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (const side of SURFACE_SIDES) {
        if (side.dx < 0 || side.dz < 0) continue;
        const nx = cx + side.dx;
        const nz = cz + side.dz;
        if (!keyAt(nx, nz)) continue;
        if (!field.isHardEdge(cx, cz, side.dx, side.dz)) continue;
        let x1;
        let z1;
        let x2;
        let z2;
        if (side.dx) {
          x1 = x0 + CELL_SIZE;
          z1 = z0;
          x2 = x1;
          z2 = z0 + CELL_SIZE;
        } else {
          x1 = x0;
          z1 = z0 + CELL_SIZE;
          x2 = x0 + CELL_SIZE;
          z2 = z1;
        }
        const points = [];
        let gap = false;
        for (let i = 0; i <= SURFACE_SUB; i += 1) {
          const t = i / SURFACE_SUB;
          const point = { gx: x1 + (x2 - x1) * t, gz: z1 + (z2 - z1) * t };
          points.push(point);
          if (gap) continue;
          if (Math.abs(heightOf(point, cx, cz) - heightOf(point, nx, nz)) > 0.02) gap = true;
        }
        if (gap) wallEdges.push({ points, cx, cz, nx, nz });
      }
    }

    const cliffValues = new Map();
    for (const [cx, cz] of cells) {
      const key = keyAt(cx, cz);
      if (!this.surfaceConfig(key)) continue;
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (let i = 0; i <= SURFACE_SUB; i += 1) {
        for (let j = 0; j <= SURFACE_SUB; j += 1) {
          const gx = x0 + i * step;
          const gz = z0 + j * step;
          const id = pointId(gx, gz);
          if (!cliffPoints.has(id)) continue;
          const value = heightOf({ gx, gz }, cx, cz);
          const list = cliffValues.get(id);
          if (list) list.push({ cx, cz, height: value });
          else cliffValues.set(id, [{ cx, cz, height: value }]);
        }
      }
    }

    const welded = new Map();
    for (const [id, list] of cliffValues) {
      const groupOf = list.map(() => -1);
      let groupCount = 0;
      for (let start = 0; start < list.length; start += 1) {
        if (groupOf[start] !== -1) continue;
        const group = groupCount;
        groupCount += 1;
        groupOf[start] = group;
        const queue = [start];
        while (queue.length) {
          const current = list[queue.pop()];
          for (const side of SURFACE_SIDES) {
            for (let j = 0; j < list.length; j += 1) {
              if (groupOf[j] !== -1) continue;
              const other = list[j];
              if (other.cx !== current.cx + side.dx || other.cz !== current.cz + side.dz) continue;
              if (field.isHardEdge(current.cx, current.cz, side.dx, side.dz)) continue;
              groupOf[j] = group;
              queue.push(j);
            }
          }
        }
      }
      const groupTops = new Array(groupCount).fill(-Infinity);
      for (let i = 0; i < list.length; i += 1) {
        const index = groupOf[i];
        if (list[i].height > groupTops[index]) groupTops[index] = list[i].height;
      }
      for (let i = 0; i < list.length; i += 1) {
        welded.set(`${id}|${list[i].cx},${list[i].cz}`, groupTops[groupOf[i]]);
      }
    }

    const weldedAt = (id, cx, cz) => {
      const value = welded.get(`${id}|${cx},${cz}`);
      return value === undefined ? null : value;
    };

    for (const [cx, cz] of cells) {
      const key = keyAt(cx, cz);
      if (!this.surfaceConfig(key)) continue;
      const group = groupFor(key);
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      const grid = [];
      for (let i = 0; i <= SURFACE_SUB; i += 1) {
        const row = [];
        for (let j = 0; j <= SURFACE_SUB; j += 1) {
          const gx = x0 + i * step;
          const gz = z0 + j * step;
          const point = { gx, gz };
          const pos = positionOf(point);
          const id = pointId(gx, gz);
          const split = cliffPoints.has(id);
          const weldedValue = weldedAt(id, cx, cz);
          const py = weldedValue === null ? heightOf(point, cx, cz) : weldedValue;
          row.push(slot(group, gx, gz, pos.px, pos.pz, py, split ? `${cx},${cz}` : null));
        }
        grid.push(row);
      }
      for (let i = 0; i < SURFACE_SUB; i += 1) {
        for (let j = 0; j < SURFACE_SUB; j += 1) {
          const a = grid[i][j];
          const b = grid[i + 1][j];
          const c = grid[i + 1][j + 1];
          const d = grid[i][j + 1];
          group.indices.push(a, b, c, a, c, d);
        }
      }
    }

    const blends = new Map();
    for (const key of groups.keys()) {
      const partner = partnerFor(key);
      const cfg = partner ? this.surfaceConfig(partner) : null;
      if (!partner || !cfg || !cfg.texture) {
        blends.set(key, null);
        continue;
      }
      blends.set(key, {
        partner,
        tile: cfg.tile || 1,
        color: this.surfaceColor(partner, map),
        weights: weightsFor(partner),
      });
    }

    const borderNormals = new Map();
    const onBorder = (value) => {
      const rounded = Math.round(value);
      return Math.abs(value - rounded) < 0.001 && Math.abs(rounded % 2) === 1;
    };
    const borderId = (px, pz) => `${Math.round(px * 1000)},${Math.round(pz * 1000)}`;
    for (const group of groups.values()) {
      if (!group.positions.length) continue;
      group.normals = [];
      VertexData.ComputeNormals(group.positions, group.indices, group.normals);
      const total = group.positions.length / 3;
      for (let v = 0; v < total; v += 1) {
        const px = group.positions[v * 3];
        const pz = group.positions[v * 3 + 2];
        if (!onBorder(px) && !onBorder(pz)) continue;
        const id = borderId(px, pz);
        let entry = borderNormals.get(id);
        if (!entry) {
          entry = { x: 0, y: 0, z: 0, count: 0 };
          borderNormals.set(id, entry);
        }
        entry.x += group.normals[v * 3];
        entry.y += group.normals[v * 3 + 1];
        entry.z += group.normals[v * 3 + 2];
        entry.count += 1;
      }
    }
    for (const group of groups.values()) {
      if (!group.positions.length) continue;
      const total = group.positions.length / 3;
      for (let v = 0; v < total; v += 1) {
        const px = group.positions[v * 3];
        const pz = group.positions[v * 3 + 2];
        if (!onBorder(px) && !onBorder(pz)) continue;
        const entry = borderNormals.get(borderId(px, pz));
        if (!entry || entry.count < 2) continue;
        const length = Math.hypot(entry.x, entry.y, entry.z);
        if (length < 1e-6) continue;
        group.normals[v * 3] = entry.x / length;
        group.normals[v * 3 + 1] = entry.y / length;
        group.normals[v * 3 + 2] = entry.z / length;
      }
    }

    for (const [key, group] of groups) {
      if (!group.positions.length) continue;
      const mesh = new Mesh(key === DEFAULT_FLOOR ? 'terrainSurface' : `terrainSurface_${key}`, this.s);
      const data = new VertexData();
      data.positions = group.positions;
      data.indices = group.indices;
      data.uvs = group.uvs;
      data.colors = group.colors;
      data.normals = group.normals;
      data.applyToMesh(mesh);
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.material = this.materialFor(key, map, blends.get(key));
      this.surfaces.push(mesh);
    }

    if (wallEdges.length) this.createCliffMesh(wallEdges, positionOf, heightOf, weldedAt);
  }

  createCliffMesh(edges, positionOf, heightOf, weldedAt) {
    const tops = new Map();
    const bottoms = new Map();
    for (const edge of edges) {
      for (const point of edge.points) {
        const id = pointId(point.gx, point.gz);
        const first = heightOf(point, edge.cx, edge.cz);
        const second = heightOf(point, edge.nx, edge.nz);
        const weldedFirst = weldedAt(id, edge.cx, edge.cz);
        const weldedSecond = weldedAt(id, edge.nx, edge.nz);
        const top = Math.max(weldedFirst === null ? first : weldedFirst, weldedSecond === null ? second : weldedSecond);
        const bottom = Math.min(first, second);
        if (!tops.has(id) || top > tops.get(id)) tops.set(id, top);
        if (!bottoms.has(id) || bottom < bottoms.get(id)) bottoms.set(id, bottom);
      }
    }
    const groups = new Map();
    for (const edge of edges) {
      const style = this.cliffStyleOf(edge);
      if (!groups.has(style)) groups.set(style, []);
      groups.get(style).push(edge);
    }
    for (const [style, list] of groups) this.buildCliffFaces(list, positionOf, heightOf, style, tops, bottoms);
  }

  cliffStyleOf(edge) {
    const field = this.field;
    if (!field || !field.cliffStyleAt) return 'dirt';
    return field.cliffStyleAt(edge.cx, edge.cz) || field.cliffStyleAt(edge.nx, edge.nz) || 'dirt';
  }

  buildCliffFaces(edges, positionOf, heightOf, style, tops, bottoms) {
    const positions = [];
    const indices = [];
    const uvs = [];
    const colors = [];
    for (const edge of edges) {
      const points = edge.points;
      for (let i = 0; i < SURFACE_SUB; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const a1 = heightOf(a, edge.cx, edge.cz);
        const a2 = heightOf(a, edge.nx, edge.nz);
        const b1 = heightOf(b, edge.cx, edge.cz);
        const b2 = heightOf(b, edge.nx, edge.nz);
        if (Math.abs(a1 - a2) < 0.02 && Math.abs(b1 - b2) < 0.02) continue;
        const aId = pointId(a.gx, a.gz);
        const bId = pointId(b.gx, b.gz);
        const apos = positionOf(a);
        const bpos = positionOf(b);
        const rise = (a1 - a2) || (b1 - b2);
        const outX = rise > 0 ? edge.nx - edge.cx : edge.cx - edge.nx;
        const outZ = rise > 0 ? edge.nz - edge.cz : edge.cz - edge.nz;
        const aTop = tops.get(aId) + 0.03;
        const aBottom = bottoms.get(aId) - 0.03;
        const bTop = tops.get(bId) + 0.03;
        const bBottom = bottoms.get(bId) - 0.03;
        const start = positions.length / 3;
        positions.push(
          apos.px, aTop, apos.pz,
          apos.px, aBottom, apos.pz,
          bpos.px, bTop, bpos.pz,
          bpos.px, bBottom, bpos.pz,
        );
        const s0 = (CELL_SIZE * i) / SURFACE_SUB;
        const s1 = (CELL_SIZE * (i + 1)) / SURFACE_SUB;
        const tone = 0.9 + (Math.abs(edge.cx * 7 + edge.cz * 13) % 5) * 0.02;
        const foot = tone * 0.78;
        colors.push(
          tone, tone, tone, 1,
          foot, foot, foot, 1,
          tone, tone, tone, 1,
          foot, foot, foot, 1,
        );
        uvs.push(
          s0 / WALL_TILE, aTop / WALL_TILE,
          s0 / WALL_TILE, aBottom / WALL_TILE,
          s1 / WALL_TILE, bTop / WALL_TILE,
          s1 / WALL_TILE, bBottom / WALL_TILE,
        );
        const dx = b.gx - a.gx;
        const dz = b.gz - a.gz;
        if (-dz * outX + dx * outZ < 0) indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
        else indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }
    if (!positions.length) return;
    const mesh = new Mesh(`terrainCliffs_${style}`, this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.uvs = uvs;
    data.colors = colors;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    smoothCoincidentNormals(positions, data.normals);
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.material = this.cliffMaterialFor(style);
    this.surfaces.push(mesh);
  }

  createSkirt(cells) {
    if (!cells.length) return;
    const floorKeys = new Set(cells.map(([cx, cz]) => `${cx},${cz}`));
    let min = 0;
    let first = true;
    for (const [cx, cz] of cells) {
      const height = this.heightAtCell(cx, cz);
      if (first || height < min) {
        min = height;
        first = false;
      }
    }
    const bottom = min - SKIRT_DEPTH;
    const half = CELL_SIZE / 2;
    const positions = [];
    const indices = [];
    const uvs = [];

    const wall = (x1, z1, x2, z2) => {
      const alongX = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
      for (let i = 0; i < SURFACE_SUB; i += 1) {
        const t0 = i / SURFACE_SUB;
        const t1 = (i + 1) / SURFACE_SUB;
        const ax = x1 + (x2 - x1) * t0;
        const az = z1 + (z2 - z1) * t0;
        const bx = x1 + (x2 - x1) * t1;
        const bz = z1 + (z2 - z1) * t1;
        const ay = this.heightAt(ax, az);
        const by = this.heightAt(bx, bz);
        const au = (alongX ? ax : az) / WALL_TILE;
        const bu = (alongX ? bx : bz) / WALL_TILE;
        const start = positions.length / 3;
        positions.push(ax, ay, az, bx, by, bz, bx, bottom, bz, ax, bottom, az);
        uvs.push(au, ay / WALL_TILE, bu, by / WALL_TILE, bu, bottom / WALL_TILE, au, bottom / WALL_TILE);
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    };

    for (const [cx, cz] of cells) {
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      const x1 = x0 + CELL_SIZE;
      const z1 = z0 + CELL_SIZE;
      if (!floorKeys.has(`${cx},${cz - 1}`)) wall(x0, z0, x1, z0);
      if (!floorKeys.has(`${cx + 1},${cz}`)) wall(x1, z0, x1, z1);
      if (!floorKeys.has(`${cx},${cz + 1}`)) wall(x1, z1, x0, z1);
      if (!floorKeys.has(`${cx - 1},${cz}`)) wall(x0, z1, x0, z0);
    }

    if (!positions.length) return;
    const mesh = new Mesh('terrainSkirt', this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.uvs = uvs;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.material = this.skirtMaterialFor();
    this.skirtMesh = mesh;
    this.surfaces.push(mesh);
  }

  skirtMaterialFor() {
    if (this.skirtMaterial) return this.skirtMaterial;
    const material = new StandardMaterial('terrainSkirtMat', this.s);
    const texture = new Texture(WALL_TEXTURE, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(0.78, 0.72, 0.62);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = new Color3(0.08, 0.07, 0.06);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    this.skirtMaterial = material;
    return material;
  }

  cliffMaterialFor(style) {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    const key = style === 'dirt' ? 'dirt' : 'stone';
    if (!this.cliffMaterials[key]) {
      this.cliffMaterials[key] = key === 'dirt' ? this.dirtCliffMaterial() : this.stoneCliffMaterial();
    }
    return this.cliffMaterials[key];
  }

  stoneCliffMaterial() {
    const material = new StandardMaterial('terrainCliffStoneMat', this.s);
    const texture = new Texture(CLIFF_TEXTURE, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(1.12, 1.12, 1.1);
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    material.backFaceCulling = false;
    const bump = new Texture(CLIFF_NORMAL, this.s);
    bump.wrapU = Texture.WRAP_ADDRESSMODE;
    bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.gammaSpace = false;
    material.bumpTexture = bump;
    return material;
  }

  dirtCliffMaterial() {
    const material = new StandardMaterial('terrainCliffDirtMat', this.s);
    const texture = new Texture(CLAY_CLIFF_TEXTURE, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(0.88, 0.82, 0.72);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    return material;
  }

  surfaceConfig(key) {
    const def = getDecoration(key);
    if (def && def.surface && def.surface.texture) return def.surface;
    const fallback = getDecoration(DEFAULT_FLOOR);
    return fallback && fallback.surface && fallback.surface.texture ? fallback.surface : null;
  }

  materialFor(key, map, blend = null) {
    const cacheKey = blend ? `${key}|${blend.partner}` : key;
    let material = this.materials.get(cacheKey);
    if (!material) {
      const cfg = this.surfaceConfig(key);
      material = new StandardMaterial(`terrainSurfaceMat_${cacheKey}`, this.s);
      material.diffuseTexture = new Texture(cfg.texture, this.s);
      material.specularColor = new Color3(0.02, 0.02, 0.02);
      material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
      material.useVertexColor = true;
      material.diffuseColor = color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
      this.materials.set(cacheKey, material);
      this.causticPlugins.push(new TerrainCausticPlugin(material));
      this.wetPlugins.push(new TerrainWetPlugin(material, cfg.wet === undefined ? 0.4 : cfg.wet));
      if (blend) {
        this.blendPlugins.set(cacheKey, new TerrainBlendPlugin(material, {
          texture: this.blendTextureFor(blend.partner),
          weights: blend.weights.texture,
          tile: blend.tile,
          color: blend.color,
          origin: blend.weights.origin,
          scale: blend.weights.scale,
        }));
      }
      return material;
    }
    const plugin = this.blendPlugins.get(cacheKey);
    if (plugin && blend) {
      plugin.setBlend(
        this.blendTextureFor(blend.partner),
        blend.tile,
        blend.color,
        blend.weights.texture,
        blend.weights.origin,
        blend.weights.scale,
      );
    }
    return material;
  }

  surfaceColor(key, map) {
    const cfg = this.surfaceConfig(key);
    if (!cfg) return new Color3(1, 1, 1);
    return color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
  }

  blendTextureFor(key) {
    let texture = this.blendTextures.get(key);
    if (!texture) {
      const cfg = this.surfaceConfig(key);
      texture = new Texture(cfg.texture, this.s);
      this.blendTextures.set(key, texture);
    }
    return texture;
  }

  updateCaustics(time, level, dirX, dirZ, color, strength, maxDepth) {
    for (const plugin of this.causticPlugins) {
      plugin.setCaustics(time, level, dirX, dirZ, color, strength, maxDepth);
    }
  }

  updateWetLevel(level) {
    for (const plugin of this.wetPlugins) plugin.setWet(level);
  }

  disposeMaterials() {
    for (const material of this.materials.values()) {
      if (material) material.dispose(false, true);
    }
    this.materials.clear();
    this.blendPlugins.clear();
    this.causticPlugins.length = 0;
    this.wetPlugins.length = 0;
    for (const texture of this.blendTextures.values()) {
      if (texture) texture.dispose();
    }
    this.blendTextures.clear();
    if (this.skirtMaterial) {
      this.skirtMaterial.dispose(false, true);
      this.skirtMaterial = null;
    }
    if (this.cliffMaterials) {
      for (const material of Object.values(this.cliffMaterials)) {
        if (material) material.dispose(false, true);
      }
      this.cliffMaterials = null;
    }
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
      const y1 = this.heightAt(x1, z1) + GRID_LIFT;
      const y2 = this.heightAt(x2, z2) + GRID_LIFT;
      edges.set(id, [new Vector3(x1, y1, z1), new Vector3(x2, y2, z2)]);
    };
    const step = CELL_SIZE / GRID_SUB;
    const half = CELL_SIZE / 2;
    for (const [cx, cz] of cells) {
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (let i = 0; i < GRID_SUB; i += 1) {
        const a = i * step;
        const b = (i + 1) * step;
        add(x0 + a, z0, x0 + b, z0);
        add(x0 + a, z0 + CELL_SIZE, x0 + b, z0 + CELL_SIZE);
        add(x0, z0 + a, x0, z0 + b);
        add(x0 + CELL_SIZE, z0 + a, x0 + CELL_SIZE, z0 + b);
      }
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
