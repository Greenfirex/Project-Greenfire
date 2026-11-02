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
import { buildBridge, deckHeightAt, bridgeSpan, bridgeCellOf, sampleBank, BRIDGE_BURIAL, BRIDGE_RISE, BRIDGE_CLEARANCE } from '../utils/bridgeShape.js';
import { createTerrainField } from '../utils/terrainField.js';
import { getMap } from '../data/catalogs/maps.js';
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { groundCells, worldCells } from '../data/maps/areaShape.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import TerrainBlendPlugin from './terrainBlendPlugin.js';
import TerrainCausticPlugin from './terrainCausticPlugin.js';
import TerrainWetPlugin from './terrainWetPlugin.js';
import CliffSurfacePlugin from './cliffSurfacePlugin.js';

const PICK_LIFT = 0.002;
const GRID_LIFT = 0.02;
const GRID_SUB = 2;
const SURFACE_SUB = 4;
const SKIRT_DEPTH = 2;
const WALL_TILE = 3;
const WALL_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const CLIFF_TEXTURE = `${ASSET_DIRS.textures}Rock050_1K-JPG_Color.jpg`;
const CLIFF_NORMAL = `${ASSET_DIRS.textures}Rock050_1K-JPG_NormalGL.jpg`;
const CLIFF_STRATA_TEXTURE = `${ASSET_DIRS.textures}Rock023_1K-JPG_Color.jpg`;
const CLIFF_MOSS_TEXTURE = `${ASSET_DIRS.textures}Rock063_1K-JPG_Color.jpg`;
const CLAY_CLIFF_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const SURFACE_BLEND_RADIUS = 1.8;
const SURFACE_BLEND_SOFTMIN = 0.35;
const SURFACE_BLEND_COLLAR = 0.25;
const SURFACE_BLEND_TEXEL = CELL_SIZE / 8;
const SURFACE_VERTEX_TINT = [0.72, 0.7, 0.64];
const SURFACE_BLEND_NOISE = CELL_SIZE;
const SURFACE_BLEND_GRAIN = CELL_SIZE / 4;
const SURFACE_BLEND_WARP = CELL_SIZE * 2.2;
const SURFACE_BLEND_TONGUE = CELL_SIZE * 1.1;
const SURFACE_BLEND_SPECK = CELL_SIZE * 0.45;
const SURFACE_BLEND_SPECK_MIN = 10;
const SURFACE_BLEND_SPECK_EDGE = 0.78;
const SURFACE_BLEND_SPECK_MAX = 92;
const SURFACE_BLEND_WALL_FADE = 0.5;
const BLEND_NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const CLIFF_WAVE = 0.16;
const CLIFF_WAVE_SCALE = 0.45;
const CLIFF_RELIEF = 0.30;
const CLIFF_RELIEF_SPAN = 1.6;
const CLIFF_NORMAL_BLEND = 0.35;
const CLIFF_DEPTH_IN = 1.10;
const CLIFF_DEPTH_OUT = 1.00;
const CLIFF_LEDGE_MIN = 2.2;
const CLIFF_LEDGE_RAMP = 0.8;
const CLIFF_LEDGE_STEP = 0.45;
const CLIFF_LEDGE_RATIO = 0.16;
const CLIFF_RIM_BEVEL = 0.05;
const CLIFF_CORNER_GAP = 0.5;
const CLIFF_BEVEL_ROUND = 0.2;
const CLIFF_SKIRT_SINK = 0.08;
const CORNER_FILL_STEPS = 3;
const BRIDGE_CORNER_MARGIN = 0.6;
const CLIFF_INWARD_MAX = 0.85;
const CLIFF_LEDGE_TAPER = 0.6;
const CLIFF_LEDGE_T_MIN = 0.22;
const CLIFF_LEDGE_T_MAX = 0.54;
const CLIFF_LEDGE2_MIN = 7.0;
const CLIFF_LEDGE2_RAMP = 1.5;
const CLIFF_LEDGE2_STEP = 0.38;
const CLIFF_LEDGE2_RATIO = 0.10;
const CLIFF_LEDGE2_T_MIN = 0.66;
const CLIFF_LEDGE2_T_MAX = 0.80;
const CLIFF_PROFILE = [
  [0.00, 0.00],
  [0.05, 0.50],
  [0.11, 0.85],
  [0.18, 1.00],
  [0.58, 1.00],
  [0.62, 1.00],
  [0.82, 1.00],
  [0.88, 0.40],
  [0.94, 0.14],
  [1.00, 0.00],
];
const CLIFF_ROWS = CLIFF_PROFILE.map(([t, w]) => ({ t, w, ledge: 0, pair: 0 }));
const CLIFF_ROWS_LEDGE = [];
for (const row of CLIFF_ROWS) {
  CLIFF_ROWS_LEDGE.push(row);
  if (row.t === 0.18 || row.t === 0.62) {
    const pair = row.t === 0.18 ? 1 : 2;
    CLIFF_ROWS_LEDGE.push({ t: 0, w: 1, ledge: 1, pair });
    CLIFF_ROWS_LEDGE.push({ t: 0, w: 1, ledge: 2, pair });
  }
}
const CLIFF_LEDGE_INDEX = CLIFF_ROWS_LEDGE.findIndex((row) => row.ledge === 1 && row.pair === 1);
const CLIFF_LEDGE2_INDEX = CLIFF_ROWS_LEDGE.findIndex((row) => row.ledge === 1 && row.pair === 2);
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

function cliffRelief(gx, gz, at) {
  const coarse = valueNoise(gx * 0.22 + 3.7, gz * 0.22 - 8.2);
  const middle = valueNoise(gx * 0.62 - 15.1, gz * 0.62 + 6.4);
  const band = valueNoise(gx * 0.14 + at * 1.7 + 51.2, gz * 0.14 - 33.4);
  return (coarse - 0.5) * 0.95 + (middle - 0.5) * 0.45 + (band - 0.5) * 0.60;
}

function cliffDepth(point, t, w) {
  const relief = w * cliffRelief(point.gx, point.gz, t);
  return Math.max(-CLIFF_DEPTH_IN, Math.min(CLIFF_DEPTH_OUT, relief));
}

function cliffLedgeT(point) {
  const noise = valueNoise(point.gx * 0.55 + 27.3, point.gz * 0.55 - 41.7);
  return CLIFF_LEDGE_T_MIN + (CLIFF_LEDGE_T_MAX - CLIFF_LEDGE_T_MIN) * noise;
}

function cliffLedgeMask(point) {
  return smoothstep(0.52, 0.72, valueNoise(point.gx * 0.42 + 61.7, point.gz * 0.42 - 12.9));
}

function cliffLedgeT2(point) {
  const noise = valueNoise(point.gx * 0.61 - 14.6, point.gz * 0.61 + 33.2);
  return CLIFF_LEDGE2_T_MIN + (CLIFF_LEDGE2_T_MAX - CLIFF_LEDGE2_T_MIN) * noise;
}

function cliffLedgeMask2(point) {
  return smoothstep(0.60, 0.78, valueNoise(point.gx * 0.37 - 44.3, point.gz * 0.37 + 8.8));
}

function cliffCornerTaper(k) {
  return Math.min(1, Math.min(k, SURFACE_SUB - k) / (SURFACE_SUB / 2));
}

function cliffRimBevel(t) {
  if (t <= 0.72 || t >= 1.0) return 0;
  return smoothstep(0.72, 0.9, t) * (1 - smoothstep(0.96, 1.0, t));
}

function cliffDirection(pushes, point) {
  const entry = pushes.get(pointId(point.gx, point.gz));
  if (!entry) return { x: 0, z: 0, corner: 0 };
  const length = Math.hypot(entry.x, entry.z);
  if (length < 1e-6) return { x: 0, z: 0, corner: 0 };
  const count = entry.count || 1;
  return {
    x: entry.x / length,
    z: entry.z / length,
    corner: count > 1 ? Math.min(1, Math.max(0, (count - length) / 0.6)) : 0,
  };
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function cliffTint(gx, gz, y, t, tone, push, rim) {
  const grain = valueNoise(gx * 0.37 + 4.1, gz * 0.37 - 2.3);
  const stripe = 0.5 + 0.5 * Math.sin(y * 0.95 + grain * 3.1);
  const base = 0.70 + (tone - 0.70) * Math.pow(t, 0.62);
  const moss = smoothstep(0.68, 0.95, t + (grain - 0.5) * 0.18) * (0.35 + 0.65 * grain);
  const contact = 0.62 + 0.38 * smoothstep(0.02, 0.26, t);
  const relief = 1 - 0.50 * Math.max(0, -push) + 0.14 * Math.max(0, push);
  const shade = base * (0.88 + 0.14 * grain) * (0.88 + 0.16 * stripe) * contact * relief;
  const lip = smoothstep(0.88, 1, t + (grain - 0.5) * 0.04) * 0.80;
  const r = shade * (1 - 0.10 * moss);
  const g = shade * (1 + 0.02 * moss);
  const b = shade * (1 - 0.16 * moss);
  return {
    r: r + (rim[0] - r) * lip,
    g: g + (rim[1] - g) * lip,
    b: b + (rim[2] - b) * lip,
    moss,
  };
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
    this.cliffBlendTextures = [];
    this.skirtMesh = null;
    this.gridLines = null;
    this.field = null;
    this.floorKeys = new Map();
    this.mapKey = null;
    this.bridges = [];
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

  floorKeyAt(cx, cz) {
    return this.floorKeys ? this.floorKeys.get(String(cx) + ',' + String(cz)) || null : null;
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
    this.floorKeys.clear();
    this.bridges = [];
    this.bridgeWallColumns = new Map();
    this.groundCells = [];
    this.realCells = [];
  }

  create(mapKey, world = null) {
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

  cliffCornerInfo(gx, gz) {
    const half = CELL_SIZE / 2;
    const cells = [];
    for (const sx of [-half, half]) {
      for (const sz of [-half, half]) {
        const ax = Math.round((gx + sx) / CELL_SIZE);
        const az = Math.round((gz + sz) / CELL_SIZE);
        cells.push({ cx: ax, cz: az, h: this.field.heightAtCell(ax, az) });
      }
    }
    const sorted = [...cells].sort((a, b) => b.h - a.h);
    let split = -1;
    let gap = 0;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const step = sorted[i].h - sorted[i + 1].h;
      if (step > gap) {
        gap = step;
        split = i;
      }
    }
    if (gap < CLIFF_CORNER_GAP) return null;
    const high = sorted.slice(0, split + 1);
    const low = sorted.slice(split + 1);
    if (low.length === 1) {
      const pull = new Set();
      for (const c of high) pull.add(`${c.cx},${c.cz}`);
      return { pull, convex: false };
    }
    if (high.length === 1) {
      const hi = high[0];
      return { pull: new Set([`${hi.cx},${hi.cz}`]), convex: true };
    }
    return null;
  }

  cliffCornerPost(pushes, point) {
    if (cliffDirection(pushes, point).corner <= 0.3) return false;
    if (this.bridgeCornerAt(point.gx, point.gz)) return false;
    const info = this.cliffCornerInfo(point.gx, point.gz);
    return Boolean(info && info.convex);
  }

  createSurface(map, cells) {
    for (const mesh of this.surfaces) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.surfaces = [];
    for (const texture of this.weightTextures) texture.dispose();
    this.weightTextures = [];
    this.shelfAnchors = [];
    this.bridges = [];
    this.bridgeWallColumns = new Map();

    const tint = new Color3(...SURFACE_VERTEX_TINT);
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
    this.floorKeys = keys;
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
      const wallSides = (cx, cz) => {
        const id = `${cx},${cz}`;
        if (wallCache.has(id)) return wallCache.get(id);
        const sides = [
          wallBetween(field, cx, cz, cx - 1, cz),
          wallBetween(field, cx, cz, cx + 1, cz),
          wallBetween(field, cx, cz, cx, cz - 1),
          wallBetween(field, cx, cz, cx, cz + 1),
        ];
        wallCache.set(id, sides);
        return sides;
      };
      const wallReach = (cx, cz, x, z) => {
        const sides = wallSides(cx, cz);
        const x0 = cx * CELL_SIZE - half;
        const x1 = cx * CELL_SIZE + half;
        const z0 = cz * CELL_SIZE - half;
        const z1 = cz * CELL_SIZE + half;
        let best = Infinity;
        if (sides[0]) best = Math.min(best, x - x0);
        if (sides[1]) best = Math.min(best, x1 - x);
        if (sides[2]) best = Math.min(best, z - z0);
        if (sides[3]) best = Math.min(best, z1 - z);
        return best;
      };
      for (let j = 0; j < height; j += 1) {
        const z = z0 + (j + 0.5) * (spanZ / height);
        for (let i = 0; i < width; i += 1) {
          const x = x0 + (i + 0.5) * (spanX / width);
          const cx = Math.floor((x + half) / CELL_SIZE);
          const cz = Math.floor((z + half) / CELL_SIZE);
          const isPartner = keyAt(cx, cz) === partner;
          if (field.isSharp(cx, cz) && !isPartner) continue;
          if (isPartner) {
            let weight = 255;
            if (isDry(cx, cz)) {
              const toWall = wallReach(cx, cz, x, z);
              if (Number.isFinite(toWall)) weight = Math.round(255 * Math.min(1, toWall / SURFACE_BLEND_WALL_FADE));
            }
            data[j * width + i] = weight;
            continue;
          }
          let reach = 0;
          for (const [dx, dz] of BLEND_NEIGHBORS) {
            const nx = cx + dx;
            const nz = cz + dz;
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

    const cliffCornerSet = new Set();
    const cliffPushMap = new Map();
    for (const edge of wallEdges) {
      let riseSum = 0;
      for (const point of edge.points) riseSum += heightOf(point, edge.cx, edge.cz) - heightOf(point, edge.nx, edge.nz);
      const dirX = riseSum > 0 ? edge.nx - edge.cx : edge.cx - edge.nx;
      const dirZ = riseSum > 0 ? edge.nz - edge.cz : edge.cz - edge.nz;
      for (const point of edge.points) {
        const id = pointId(point.gx, point.gz);
        const entry = cliffPushMap.get(id) || { x: 0, z: 0, count: 0 };
        entry.x += dirX;
        entry.z += dirZ;
        entry.count += 1;
        cliffPushMap.set(id, entry);
      }
    }
    for (const [id, entry] of cliffPushMap) {
      if (entry.count <= 1) continue;
      const length = Math.hypot(entry.x, entry.z);
      if (length > 1e-6 && (entry.count - length) / 0.6 > 0.3) cliffCornerSet.add(id);
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

    this.bridges = this.bridgePlansFor(map, keyAt, positionOf, weldedAt);

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
          const edge = i === 0 || i === SURFACE_SUB || j === 0 || j === SURFACE_SUB;
          const py = weldedValue !== null
            ? weldedValue
            : (!split && edge ? field.heightAt(pos.px, pos.pz) : heightOf(point, cx, cz));
          let px = pos.px;
          let pz = pos.pz;
          const nearGI = i * 2 < SURFACE_SUB ? 0 : SURFACE_SUB;
          const nearGJ = j * 2 < SURFACE_SUB ? 0 : SURFACE_SUB;
          if (i === nearGI && j === nearGJ) {
            const cornerGx = x0 + nearGI * step;
            const cornerGz = z0 + nearGJ * step;
            const info = cliffCornerSet.has(pointId(cornerGx, cornerGz)) ? this.cliffCornerInfo(cornerGx, cornerGz) : null;
            if (info && info.convex && info.pull.has(`${cx},${cz}`) && !this.bridgeCornerAt(cornerGx, cornerGz)) {
              const innerA = positionOf({ gx: cornerGx + (nearGI === 0 ? step : -step), gz: cornerGz });
              const innerB = positionOf({ gx: cornerGx, gz: cornerGz + (nearGJ === 0 ? step : -step) });
              const chordMidX = (innerA.px + innerB.px) * 0.5;
              const chordMidZ = (innerA.pz + innerB.pz) * 0.5;
              px = chordMidX + (px - chordMidX) * CLIFF_BEVEL_ROUND;
              pz = chordMidZ + (pz - chordMidZ) * CLIFF_BEVEL_ROUND;
            }
          }
          row.push(slot(group, gx, gz, px, pz, py, split ? `${cx},${cz}` : null));
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

    const cornerStep = CELL_SIZE / SURFACE_SUB;
    const distanceToCell = (x, z, cx, cz) => {
      const dx = Math.max(0, Math.abs(x - cx * CELL_SIZE) - CELL_SIZE / 2);
      const dz = Math.max(0, Math.abs(z - cz * CELL_SIZE) - CELL_SIZE / 2);
      return Math.hypot(dx, dz);
    };
    const lowGroundAt = (x, z, lowCells) => {
      let sum = 0;
      let weight = 0;
      for (const cell of lowCells) {
        const reach = distanceToCell(x, z, cell[0], cell[1]) + 0.05;
        const w = 1 / (reach * reach);
        sum += field.heightAtSide(x, z, cell[0], cell[1]) * w;
        weight += w;
      }
      return weight > 0 ? sum / weight : 0;
    };
    for (const cornerId of cliffCornerSet) {
      const [cornerX, cornerZ] = cornerId.split(',').map((value) => Number(value) / 2);
      const info = this.cliffCornerInfo(cornerX, cornerZ);
      if (!info || !info.convex || info.pull.size !== 1) continue;
      const [highX, highZ] = [...info.pull][0].split(',').map(Number);
      const highHeight = field.heightAtCell(highX, highZ);
      const dirX = Math.sign(highX * CELL_SIZE - cornerX) || 1;
      const dirZ = Math.sign(highZ * CELL_SIZE - cornerZ) || 1;
      const sideX = [highX - dirX, highZ];
      const sideZ = [highX, highZ - dirZ];
      const lowCells = [];
      for (const cell of [sideX, sideZ, [highX - dirX, highZ - dirZ]]) {
        if (field.heightAtCell(cell[0], cell[1]) > highHeight - 0.001) continue;
        lowCells.push(cell);
      }
      if (!lowCells.length) continue;
      const centerX = cornerX + dirX * CORNER_FILL_STEPS * cornerStep * 0.5;
      const centerZ = cornerZ + dirZ * CORNER_FILL_STEPS * cornerStep * 0.5;
      let ownerCell = lowCells[0];
      let ownerDist = Infinity;
      for (const cell of lowCells) {
        const dist = distanceToCell(centerX, centerZ, cell[0], cell[1]);
        if (dist < ownerDist) {
          ownerDist = dist;
          ownerCell = cell;
        }
      }
      const group = groupFor(keyAt(ownerCell[0], ownerCell[1]) || DEFAULT_FLOOR);
      const fillOwner = `fill:${highX},${highZ}`;
      const reach = CORNER_FILL_STEPS * cornerStep;
      const xMin = Math.min(cornerX, cornerX + dirX * reach);
      const xMax = Math.max(cornerX, cornerX + dirX * reach);
      const zMin = Math.min(cornerZ, cornerZ + dirZ * reach);
      const zMax = Math.max(cornerZ, cornerZ + dirZ * reach);
      const fillGrid = [];
      for (let i = 0; i <= CORNER_FILL_STEPS; i += 1) {
        const x = xMin + i * cornerStep;
        const row = [];
        for (let j = 0; j <= CORNER_FILL_STEPS; j += 1) {
          const z = zMin + j * cornerStep;
          const onX = Math.abs(x - cornerX) < 1e-6;
          const onZ = Math.abs(z - cornerZ) < 1e-6;
          let owner = fillOwner;
          if (onX) owner = `${sideX[0]},${sideX[1]}`;
          else if (onZ) owner = `${sideZ[0]},${sideZ[1]}`;
          const y = lowGroundAt(x, z, lowCells);
          row.push(slot(group, x, z, x, z, y, owner));
        }
        fillGrid.push(row);
      }
      for (let i = 0; i < CORNER_FILL_STEPS; i += 1) {
        for (let j = 0; j < CORNER_FILL_STEPS; j += 1) {
          const a = fillGrid[i][j];
          const b = fillGrid[i + 1][j];
          const c = fillGrid[i + 1][j + 1];
          const d = fillGrid[i][j + 1];
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

    if (wallEdges.length) {
      const shelves = new Map();
      this.createCliffMesh(wallEdges, positionOf, heightOf, weldedAt, (edge) => {
        const lower = this.heightAtCell(edge.cx, edge.cz);
        const higher = this.heightAtCell(edge.nx, edge.nz);
        const key = higher >= lower ? keyAt(edge.nx, edge.nz) : keyAt(edge.cx, edge.cz);
        const color = this.surfaceColor(key, map);
        return { key, color: [color.r * 0.50, color.g * 0.66, color.b * 0.40] };
      }, shelves);
      this.createShelfMeshes(shelves, map, blends);
    }
    if (this.bridges.length) this.createBridges(map, blends);
  }

  createCliffMesh(edges, positionOf, heightOf, weldedAt, rimColorOf, shelves) {
    const groups = new Map();
    for (const edge of edges) {
      const style = this.cliffStyleOf(edge);
      if (!groups.has(style)) groups.set(style, []);
      groups.get(style).push(edge);
    }
    const pushes = new Map();
    for (const edge of edges) {
      let riseSum = 0;
      for (const point of edge.points) riseSum += heightOf(point, edge.cx, edge.cz) - heightOf(point, edge.nx, edge.nz);
      const dirX = riseSum > 0 ? edge.nx - edge.cx : edge.cx - edge.nx;
      const dirZ = riseSum > 0 ? edge.nz - edge.cz : edge.cz - edge.nz;
      for (const point of edge.points) {
        const id = pointId(point.gx, point.gz);
        const entry = pushes.get(id) || { x: 0, z: 0, count: 0 };
        entry.x += dirX;
        entry.z += dirZ;
        entry.count += 1;
        pushes.set(id, entry);
      }
    }
    const cornerPosts = new Map();
    for (const [style, list] of groups) this.buildCliffFaces(list, positionOf, heightOf, weldedAt, style, rimColorOf, pushes, shelves, cornerPosts);
    this.buildCornerBevels(cornerPosts);
  }

  bridgePlansFor(map, keyAt, positionOf, weldedAt) {
    const records = this.layout && Array.isArray(this.layout.bridges) ? this.layout.bridges : [];
    const plans = [];
    for (const record of records) {
      const plan = this.bridgePlanFor(map, record, keyAt, positionOf, weldedAt);
      if (plan) plans.push(plan);
    }
    return plans;
  }

  bridgePlanFor(map, record, keyAt, positionOf, weldedAt) {
    const span = bridgeSpan(record);
    if (!span) return null;
    const { axis, from, to, center, vFrom, vTo } = span;
    const alongX = axis === 'x';
    const cellOf = (bankCell, vCell) => bridgeCellOf(span, bankCell, vCell);
    const samplesFor = (bankCell, uPlane) => {
      const samples = [];
      for (let vCell = vFrom; vCell <= vTo; vCell += 1) {
        const [cx, cz] = cellOf(bankCell, vCell);
        if (!keyAt(cx, cz)) return null;
        for (let i = 0; i <= SURFACE_SUB; i += 1) {
          const v = vCell * CELL_SIZE - CELL_SIZE / 2 + (CELL_SIZE * i) / SURFACE_SUB;
          const point = alongX ? { gx: uPlane, gz: v } : { gx: v, gz: uPlane };
          const pos = positionOf(point);
          const weldedValue = weldedAt(pointId(point.gx, point.gz), cx, cz);
          const y = weldedValue === null ? this.field.heightAtSide(pos.px, pos.pz, cx, cz) : weldedValue;
          samples.push({ u: alongX ? pos.px : pos.pz, v: alongX ? pos.pz : pos.px, y });
        }
      }
      return samples;
    };
    for (let vCell = vFrom; vCell <= vTo; vCell += 1) {
      for (let bankCell = from + 1; bankCell <= to - 1; bankCell += 1) {
        const [cx, cz] = cellOf(bankCell, vCell);
        if (!keyAt(cx, cz)) return null;
      }
    }
    const u0 = from * CELL_SIZE + CELL_SIZE / 2;
    const u1 = to * CELL_SIZE - CELL_SIZE / 2;
    const v0 = vFrom * CELL_SIZE - CELL_SIZE / 2;
    const v1 = vTo * CELL_SIZE + CELL_SIZE / 2;
    const bankA = samplesFor(from, u0);
    const bankB = samplesFor(to, u1);
    if (!bankA || !bankB) return null;
    let uMin = Infinity;
    let uMax = -Infinity;
    for (const sample of bankA) {
      if (sample.u < uMin) uMin = sample.u;
      if (sample.u > uMax) uMax = sample.u;
    }
    for (const sample of bankB) {
      if (sample.u < uMin) uMin = sample.u;
      if (sample.u > uMax) uMax = sample.u;
    }
    const mid = Math.floor((bankA.length - 1) / 2);
    let low = Infinity;
    for (const sample of bankA) low = Math.min(low, sample.y);
    for (const sample of bankB) low = Math.min(low, sample.y);
    const centerU = (u0 + u1) / 2;
    const centerV = (v0 + v1) / 2;
    const gapX = alongX ? centerU : centerV;
    const gapZ = alongX ? centerV : centerU;
    const gapGround = this.heightAt(gapX, gapZ);
    const waterLevel = this.layout && Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
    let springing = gapGround + 0.45;
    if (waterLevel !== null && gapGround < waterLevel) springing = waterLevel + 0.35;
    const deckMid = (bankA[mid].y + bankB[mid].y) / 2 + BRIDGE_RISE;
    springing = Math.min(springing, deckMid - 1.6);
    springing = Math.min(springing, low - 0.4);
    const opening = Math.max(0.9, deckMid - springing);
    const thickness = Math.min(4.2, Math.max(1.1, opening * 0.3));
    const crown = Math.max(springing + 0.2, low - thickness);
    const [bankAX, bankAZ] = cellOf(from, center);
    const [bankBX, bankBZ] = cellOf(to, center);
    const key = keyAt(bankAX, bankAZ) || DEFAULT_FLOOR;
    const cfg = this.surfaceConfig(key);
    const rimSource = this.surfaceColor(key, map);
    const plan = {
      axis,
      u0,
      u1,
      v0,
      v1,
      bankA,
      bankB,
      springing,
      crown,
      burial: BRIDGE_BURIAL,
      tile: (cfg && cfg.tile) || 1,
      wallTile: WALL_TILE,
      key,
      style: record.style === 'dirt' || record.style === 'stone'
        ? record.style
        : (this.field.cliffStyleAt(bankAX, bankAZ) === 'stone' || this.field.cliffStyleAt(bankBX, bankBZ) === 'stone' ? 'stone' : 'dirt'),
      rim: [rimSource.r * 0.5, rimSource.g * 0.66, rimSource.b * 0.4],
      groundAt: (x, z) => this.heightAt(x, z),
      rect: alongX
        ? { x0: uMin, x1: uMax, z0: v0, z1: v1 }
        : { x0: v0, x1: v1, z0: uMin, z1: uMax },
    };
    plan.deckAt = (x, z) => deckHeightAt(plan, alongX ? x : z, alongX ? z : x);
    plan.columnAt = (side, v) => {
      const uPlane = side === 'low' ? u0 : u1;
      const snapped = Math.round(v * 2) / 2;
      const point = alongX ? { gx: uPlane, gz: snapped } : { gx: snapped, gz: uPlane };
      return this.bridgeWallColumn(point.gx, point.gz);
    };
    return plan;
  }

  bridgeClearAt(gx, gz, y) {
    let factor = 1;
    for (const plan of this.bridges) {
      const alongX = plan.axis === 'x';
      const u = alongX ? gx : gz;
      const v = alongX ? gz : gx;
      const sideLow = Math.abs(u - plan.u0) <= 0.01;
      const sideHigh = Math.abs(u - plan.u1) <= 0.01;
      const endLow = Math.abs(v - plan.v0) <= 0.01;
      const endHigh = Math.abs(v - plan.v1) <= 0.01;
      let near = 1;
      let deckTop = 0;
      if (sideLow || sideHigh) {
        let distance = 0;
        if (v < plan.v0) distance = plan.v0 - v;
        else if (v > plan.v1) distance = v - plan.v1;
        near = smoothstep(0, BRIDGE_CLEARANCE, distance);
        deckTop = sampleBank(sideLow ? plan.bankA : plan.bankB, v);
      } else if (endLow || endHigh) {
        let distance = 0;
        if (u < plan.u0) distance = plan.u0 - u;
        else if (u > plan.u1) distance = u - plan.u1;
        near = smoothstep(0, BRIDGE_CLEARANCE, distance);
        deckTop = sampleBank(u < (plan.u0 + plan.u1) / 2 ? plan.bankA : plan.bankB, v);
      } else {
        continue;
      }
      if (near >= 1) continue;
      const below = 1 - smoothstep(deckTop - 0.25, deckTop + 0.35, y);
      const clear = 1 - (1 - near) * below;
      if (clear < factor) factor = clear;
    }
    return factor;
  }

  bridgeWallSide(gx, gz) {
    for (const plan of this.bridges) {
      const u = plan.axis === 'x' ? gx : gz;
      const v = plan.axis === 'x' ? gz : gx;
      const onSide = Math.abs(u - plan.u0) <= 0.01 || Math.abs(u - plan.u1) <= 0.01;
      if (!onSide) continue;
      if (v < plan.v0 - 0.01 || v > plan.v1 + 0.01) continue;
      return true;
    }
    return false;
  }

  bridgeCornerAt(gx, gz) {
    for (const plan of this.bridges) {
      const u = plan.axis === 'x' ? gx : gz;
      const v = plan.axis === 'x' ? gz : gx;
      if (Math.abs(u - plan.u0) > BRIDGE_CORNER_MARGIN && Math.abs(u - plan.u1) > BRIDGE_CORNER_MARGIN) continue;
      if (v < plan.v0 - BRIDGE_CORNER_MARGIN || v > plan.v1 + BRIDGE_CORNER_MARGIN) continue;
      return true;
    }
    return false;
  }

  recordBridgeWall(point, y, x, z, row) {
    if (!this.bridgeWallSide(point.gx, point.gz)) return;
    const id = pointId(point.gx, point.gz);
    let rows = this.bridgeWallColumns.get(id);
    if (!rows) {
      rows = new Map();
      this.bridgeWallColumns.set(id, rows);
    }
    rows.set(row, { y, x, z });
  }

  bridgeWallColumn(gx, gz) {
    const rows = this.bridgeWallColumns.get(pointId(gx, gz));
    return rows ? [...rows.values()].sort((a, b) => a.y - b.y) : null;
  }

  createBridges(map, blends) {
    for (let index = 0; index < this.bridges.length; index += 1) {
      const plan = this.bridges[index];
      const built = buildBridge({
        ...plan,
        tint: SURFACE_VERTEX_TINT,
        shade: (x, y, z, t) => cliffTint(x, z, y, t, 0.9, 0, plan.rim),
      });
      if (built.deck.positions.length) {
        const mesh = new Mesh(`terrainBridgeDeck_${index}`, this.s);
        const data = new VertexData();
        data.positions = built.deck.positions;
        data.indices = built.deck.indices;
        data.uvs = built.deck.uvs;
        data.colors = built.deck.colors;
        data.normals = [];
        VertexData.ComputeNormals(data.positions, data.indices, data.normals);
        data.applyToMesh(mesh);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.material = this.materialFor(plan.key, map, blends.get(plan.key));
        this.surfaces.push(mesh);
      }
      if (built.rock.positions.length) {
        const mesh = new Mesh(`terrainBridgeRock_${index}`, this.s);
        const data = new VertexData();
        data.positions = built.rock.positions;
        data.indices = built.rock.indices;
        data.uvs = built.rock.uvs;
        data.colors = built.rock.colors;
        data.normals = [];
        VertexData.ComputeNormals(data.positions, data.indices, data.normals);
        data.applyToMesh(mesh);
        mesh.setVerticesData('mossMask', new Float32Array(built.rock.moss), false, 1);
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        mesh.metadata = { shadowAlways: true };
        mesh.material = this.cliffMaterialFor(plan.style);
        this.surfaces.push(mesh);
      }
    }
  }

  bridgeDeckAt(x, z) {
    for (const plan of this.bridges) {
      const rect = plan.rect;
      if (x < rect.x0 || x > rect.x1 || z < rect.z0 || z > rect.z1) continue;
      return plan.deckAt(x, z);
    }
    return null;
  }

  walkHeightAt(x, z) {
    const deck = this.bridgeDeckAt(x, z);
    return deck === null ? this.heightAt(x, z) : deck;
  }
  createShelfMeshes(shelves, map, blends) {
    for (const [key, group] of shelves) {
      if (!group.positions.length) continue;
      const mesh = new Mesh(`terrainShelf_${key}`, this.s);
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
      mesh.material = this.materialFor(key, map, blends.get(key));
      this.surfaces.push(mesh);
    }
  }

  cliffStyleOf(edge) {
    const field = this.field;
    if (!field || !field.cliffStyleAt) return 'dirt';
    return field.cliffStyleAt(edge.cx, edge.cz) || field.cliffStyleAt(edge.nx, edge.nz) || 'dirt';
  }

  buildCornerBevels(cornerPosts) {
    const byStyle = new Map();
    for (const posts of cornerPosts.values()) {
      if (posts.length !== 2) continue;
      const style = posts[0].style || 'dirt';
      if (!byStyle.has(style)) byStyle.set(style, []);
      byStyle.get(style).push(posts);
    }
    for (const [style, list] of byStyle) {
      const positions = [];
      const indices = [];
      const uvs = [];
      const colors = [];
      const masks = [];
      for (const [pa, pb] of list) {
        const n = Math.min(pa.rows.length, pb.rows.length);
        if (n < 2) continue;
        const start = positions.length / 3;
        for (let r = 0; r < n; r += 1) {
          const a = pa.rows[r];
          const b = pb.rows[r];
          const chordMX = (a.x + b.x) * 0.5;
          const chordMZ = (a.z + b.z) * 0.5;
          const midX = chordMX + (pa.cornerX - chordMX) * CLIFF_BEVEL_ROUND;
          const midZ = chordMZ + (pa.cornerZ - chordMZ) * CLIFF_BEVEL_ROUND;
          const midY = (a.y + b.y) * 0.5;
          const tA = Math.min(1, Math.max(0, (a.y - pa.bottom) / Math.max(0.001, pa.top - pa.bottom)));
          const tB = Math.min(1, Math.max(0, (b.y - pb.bottom) / Math.max(0.001, pb.top - pb.bottom)));
          const tM = (tA + tB) * 0.5;
          const tintA = cliffTint(a.x, a.z, a.y, tA, pa.tone, 0, pa.rim);
          const tintM = cliffTint(midX, midZ, midY, tM, pa.tone, 0, pa.rim);
          const tintB = cliffTint(b.x, b.z, b.y, tB, pb.tone, 0, pb.rim);
          positions.push(a.x, a.y, a.z, midX, midY, midZ, b.x, b.y, b.z);
          uvs.push(a.x / WALL_TILE, a.y / WALL_TILE, midX / WALL_TILE, midY / WALL_TILE, b.x / WALL_TILE, b.y / WALL_TILE);
          colors.push(tintA.r, tintA.g, tintA.b, 1, tintM.r, tintM.g, tintM.b, 1, tintB.r, tintB.g, tintB.b, 1);
          masks.push(tintA.moss, tintM.moss, tintB.moss);
        }
        const outwardX = pa.outX + pb.outX;
        const outwardZ = pa.outZ + pb.outZ;
        const p0 = start * 3;
        const p1 = (start + 1) * 3;
        const p2 = (start + 3) * 3;
        const ux = positions[p1] - positions[p0];
        const uy = positions[p1 + 1] - positions[p0 + 1];
        const uz = positions[p1 + 2] - positions[p0 + 2];
        const vx = positions[p2] - positions[p0];
        const vy = positions[p2 + 1] - positions[p0 + 1];
        const vz = positions[p2 + 2] - positions[p0 + 2];
        const crossX = uy * vz - uz * vy;
        const crossZ = ux * vy - uy * vx;
        const flip = crossX * outwardX + crossZ * outwardZ < 0;
        for (let r = 0; r < n - 1; r += 1) {
          const i0 = start + r * 3;
          const i1 = i0 + 3;
          if (flip) {
            indices.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
            indices.push(i0 + 1, i1 + 1, i0 + 2, i0 + 2, i1 + 1, i1 + 2);
          } else {
            indices.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
            indices.push(i0 + 1, i0 + 2, i1 + 1, i0 + 2, i1 + 2, i1 + 1);
          }
        }
      }
      if (!positions.length) continue;
      const mesh = new Mesh('terrainCliffs_corner', this.s);
      const data = new VertexData();
      data.positions = positions;
      data.indices = indices;
      data.uvs = uvs;
      data.colors = colors;
      data.normals = [];
      VertexData.ComputeNormals(positions, indices, data.normals);
      data.applyToMesh(mesh);
      mesh.setVerticesData('mossMask', new Float32Array(masks), false, 1);
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.metadata = { shadowAlways: true };
      mesh.material = this.cliffMaterialFor(style);
      this.surfaces.push(mesh);
    }
  }

  buildCliffFaces(edges, positionOf, heightOf, weldedAt, style, rimColorOf, pushes, shelves, cornerPosts) {
    const positions = [];
    const indices = [];
    const uvs = [];
    const colors = [];
    const masks = [];
    const shelfGroup = (key) => {
      let group = shelves.get(key);
      if (!group) {
        const cfg = this.surfaceConfig(key);
        group = { tile: (cfg && cfg.tile) || 1, positions: [], indices: [], uvs: [], colors: [] };
        shelves.set(key, group);
      }
      return group;
    };
    const shadeAt = (y, top, bottom, gx, gz, tone, push, rim) => {
      const span = Math.max(0.001, top - bottom);
      const t = Math.min(1, Math.max(0, (y - bottom) / span));
      return cliffTint(gx, gz, y, t, tone, push, rim);
    };
    for (const edge of edges) {
      const points = edge.points;
      const alongZ = edge.cx !== edge.nx;
      const rimInfo = rimColorOf(edge);
      const rim = rimInfo.color;
      const shelfKey = rimInfo.key;
      const tone = 0.9 + (Math.abs(edge.cx * 7 + edge.cz * 13) % 5) * 0.02;
      const startCorner = this.cliffCornerPost(pushes, points[0]);
      const endCorner = this.cliffCornerPost(pushes, points[SURFACE_SUB]);
      for (let i = 0; i < SURFACE_SUB; i += 1) {
        if ((i === 0 && startCorner) || (i === SURFACE_SUB - 1 && endCorner)) continue;
        const a = points[i];
        const b = points[i + 1];
        const a1 = heightOf(a, edge.cx, edge.cz);
        const a2 = heightOf(a, edge.nx, edge.nz);
        const b1 = heightOf(b, edge.cx, edge.cz);
        const b2 = heightOf(b, edge.nx, edge.nz);
        if (Math.abs(a1 - a2) < 0.02 && Math.abs(b1 - b2) < 0.02) continue;
        const apos = positionOf(a);
        const bpos = positionOf(b);
        const postKey = startCorner && i === 1 ? pointId(points[0].gx, points[0].gz)
          : endCorner && i === SURFACE_SUB - 2 ? pointId(points[SURFACE_SUB].gx, points[SURFACE_SUB].gz) : null;
        const postUsesA = startCorner && i === 1;
        const aWelded1 = weldedAt(pointId(a.gx, a.gz), edge.cx, edge.cz);
        const aWelded2 = weldedAt(pointId(a.gx, a.gz), edge.nx, edge.nz);
        const bWelded1 = weldedAt(pointId(b.gx, b.gz), edge.cx, edge.cz);
        const bWelded2 = weldedAt(pointId(b.gx, b.gz), edge.nx, edge.nz);
        const aTop = Math.max(aWelded1 === null ? a1 : aWelded1, aWelded2 === null ? a2 : aWelded2) + 0.015;
        const aBottom = Math.min(a1, a2) - CLIFF_SKIRT_SINK;
        const bTop = Math.max(bWelded1 === null ? b1 : bWelded1, bWelded2 === null ? b2 : bWelded2) + 0.015;
        const bBottom = Math.min(b1, b2) - CLIFF_SKIRT_SINK;
        const aDir = cliffDirection(pushes, a);
        const bDir = cliffDirection(pushes, b);
        const aSpan = Math.min(1, (aTop - aBottom) / CLIFF_RELIEF_SPAN);
        const bSpan = Math.min(1, (bTop - bBottom) / CLIFF_RELIEF_SPAN);
        const rise = (a1 - a2) || (b1 - b2);
        const windX = rise > 0 ? edge.nx - edge.cx : edge.cx - edge.nx;
        const windZ = rise > 0 ? edge.nz - edge.cz : edge.cz - edge.nz;
        const ledgeSpan = Math.min(aTop - aBottom, bTop - bBottom);
        const ledgeFactor = Math.min(1, Math.max(0, (ledgeSpan - CLIFF_LEDGE_MIN) / CLIFF_LEDGE_RAMP));
        const ledgeStep = Math.min(CLIFF_LEDGE_STEP, ledgeSpan * CLIFF_LEDGE_RATIO) * ledgeFactor;
        const rows = CLIFF_ROWS_LEDGE;
        const ledgeRow = CLIFF_LEDGE_INDEX;
        const aLedgeT = cliffLedgeT(a);
        const bLedgeT = cliffLedgeT(b);
        const aMask = cliffLedgeMask(a);
        const bMask = cliffLedgeMask(b);
        const ledge2Factor = Math.min(1, Math.max(0, (ledgeSpan - CLIFF_LEDGE2_MIN) / CLIFF_LEDGE2_RAMP));
        const ledge2Step = Math.min(CLIFF_LEDGE2_STEP, ledgeSpan * CLIFF_LEDGE2_RATIO) * ledge2Factor;
        const ledgeRow2 = CLIFF_LEDGE2_INDEX;
        const aLedgeT2 = cliffLedgeT2(a);
        const bLedgeT2 = cliffLedgeT2(b);
        const aMask2 = cliffLedgeMask2(a);
        const bMask2 = cliffLedgeMask2(b);
        let cornerPost = null;
        if (postKey) {
          cornerPost = {
            rows: [],
            outX: postUsesA ? -aDir.x : -bDir.x,
            outZ: postUsesA ? -aDir.z : -bDir.z,
            top: postUsesA ? aTop : bTop,
            bottom: postUsesA ? aBottom : bBottom,
            cornerX: postUsesA ? points[0].gx : points[SURFACE_SUB].gx,
            cornerZ: postUsesA ? points[0].gz : points[SURFACE_SUB].gz,
            tone,
            rim,
            style,
          };
          const list = cornerPosts.get(postKey);
          if (list) list.push(cornerPost);
          else cornerPosts.set(postKey, [cornerPost]);
        }
        for (let r = 0; r < rows.length - 1; r += 1) {
          const upper = rows[r];
          const lower = rows[r + 1];
          const aT0 = upper.ledge ? (upper.pair === 2 ? aLedgeT2 : aLedgeT) : upper.t;
          const aT1 = lower.ledge ? (lower.pair === 2 ? aLedgeT2 : aLedgeT) : lower.t;
          const bT0 = upper.ledge ? (upper.pair === 2 ? bLedgeT2 : bLedgeT) : upper.t;
          const bT1 = lower.ledge ? (lower.pair === 2 ? bLedgeT2 : bLedgeT) : lower.t;
          const aStep0 = (r <= ledgeRow ? ledgeStep * aMask : 0) + (r <= ledgeRow2 ? ledge2Step * aMask2 : 0);
          const aStep1 = (r + 1 <= ledgeRow ? ledgeStep * aMask : 0) + (r + 1 <= ledgeRow2 ? ledge2Step * aMask2 : 0);
          const bStep0 = (r <= ledgeRow ? ledgeStep * bMask : 0) + (r <= ledgeRow2 ? ledge2Step * bMask2 : 0);
          const bStep1 = (r + 1 <= ledgeRow ? ledgeStep * bMask : 0) + (r + 1 <= ledgeRow2 ? ledge2Step * bMask2 : 0);
          const ay0 = aBottom + (aTop - aBottom) * aT0;
          const ay1 = aBottom + (aTop - aBottom) * aT1;
          const by0 = bBottom + (bTop - bBottom) * bT0;
          const by1 = bBottom + (bTop - bBottom) * bT1;
          const aClear0 = this.bridgeClearAt(a.gx, a.gz, ay0);
          const aClear1 = this.bridgeClearAt(a.gx, a.gz, ay1);
          const bClear0 = this.bridgeClearAt(b.gx, b.gz, by0);
          const bClear1 = this.bridgeClearAt(b.gx, b.gz, by1);
          const aProtrude0 = aStep0 * Math.min(1, upper.w / CLIFF_LEDGE_TAPER) * aClear0;
          const aProtrude1 = aStep1 * Math.min(1, lower.w / CLIFF_LEDGE_TAPER) * aClear1;
          const bProtrude0 = bStep0 * Math.min(1, upper.w / CLIFF_LEDGE_TAPER) * bClear0;
          const bProtrude1 = bStep1 * Math.min(1, lower.w / CLIFF_LEDGE_TAPER) * bClear1;
          const aDepth0 = cliffDepth(a, aT0, upper.w);
          const aDepth1 = cliffDepth(a, aT1, lower.w);
          const bDepth0 = cliffDepth(b, bT0, upper.w);
          const bDepth1 = cliffDepth(b, bT1, lower.w);
          const aTaper = cliffCornerTaper(i);
          const bTaper = cliffCornerTaper(i + 1);
          const aShift0 = aTaper * Math.max(-CLIFF_INWARD_MAX, aSpan * CLIFF_RELIEF * aDepth0 + aProtrude0 - CLIFF_RIM_BEVEL * cliffRimBevel(aT0));
          const aShift1 = aTaper * Math.max(-CLIFF_INWARD_MAX, aSpan * CLIFF_RELIEF * aDepth1 + aProtrude1 - CLIFF_RIM_BEVEL * cliffRimBevel(aT1));
          const bShift0 = bTaper * Math.max(-CLIFF_INWARD_MAX, bSpan * CLIFF_RELIEF * bDepth0 + bProtrude0 - CLIFF_RIM_BEVEL * cliffRimBevel(bT0));
          const bShift1 = bTaper * Math.max(-CLIFF_INWARD_MAX, bSpan * CLIFF_RELIEF * bDepth1 + bProtrude1 - CLIFF_RIM_BEVEL * cliffRimBevel(bT1));
          const ax0 = apos.px + aDir.x * aShift0;
          const az0 = apos.pz + aDir.z * aShift0;
          const ax1 = apos.px + aDir.x * aShift1;
          const az1 = apos.pz + aDir.z * aShift1;
          const bx0 = bpos.px + bDir.x * bShift0;
          const bz0 = bpos.pz + bDir.z * bShift0;
          const bx1 = bpos.px + bDir.x * bShift1;
          const bz1 = bpos.pz + bDir.z * bShift1;
          if (cornerPost) {
            const px0 = postUsesA ? ax0 : bx0;
            const pz0 = postUsesA ? az0 : bz0;
            const py0 = postUsesA ? ay0 : by0;
            const px1 = postUsesA ? ax1 : bx1;
            const pz1 = postUsesA ? az1 : bz1;
            const py1 = postUsesA ? ay1 : by1;
            cornerPost.rows[r] = { x: px0, y: py0, z: pz0 };
            if (r === rows.length - 2) cornerPost.rows[r + 1] = { x: px1, y: py1, z: pz1 };
          }
          this.recordBridgeWall(a, ay0, ax0, az0, r);
          this.recordBridgeWall(a, ay1, ax1, az1, r + 1);
          this.recordBridgeWall(b, by0, bx0, bz0, r);
          this.recordBridgeWall(b, by1, bx1, bz1, r + 1);
          if (upper.ledge && lower.ledge && aProtrude0 + bProtrude0 > 0.008) {
            const group = shelfGroup(shelfKey);
            const tile = group.tile;
            const start = group.positions.length / 3;
            group.positions.push(
              ax0, ay0, az0,
              ax1, ay1, az1,
              bx0, by0, bz0,
              bx1, by1, bz1,
            );
            group.uvs.push(
              ax0 / tile, az0 / tile,
              ax1 / tile, az1 / tile,
              bx0 / tile, bz0 / tile,
              bx1 / tile, bz1 / tile,
            );
            group.colors.push(
              SURFACE_VERTEX_TINT[0], SURFACE_VERTEX_TINT[1], SURFACE_VERTEX_TINT[2], 1,
              SURFACE_VERTEX_TINT[0], SURFACE_VERTEX_TINT[1], SURFACE_VERTEX_TINT[2], 1,
              SURFACE_VERTEX_TINT[0], SURFACE_VERTEX_TINT[1], SURFACE_VERTEX_TINT[2], 1,
              SURFACE_VERTEX_TINT[0], SURFACE_VERTEX_TINT[1], SURFACE_VERTEX_TINT[2], 1,
            );
            const hangX = ax0 - ax1;
            const hangZ = az0 - az1;
            const hangLength = Math.hypot(hangX, hangZ);
            if (hangLength > 0.01) {
              this.shelfAnchors.push({
                x: (ax0 + bx0) * 0.5,
                y: ay0,
                z: (az0 + bz0) * 0.5,
                dirX: hangX / hangLength,
                dirZ: hangZ / hangLength,
                depth: hangLength,
              });
            }
            const up = (bz0 - az0) * (ax1 - ax0) - (bx0 - ax0) * (az1 - az0);
            if (up > 0) group.indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
            else group.indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
            continue;
          }
          const start = positions.length / 3;
          positions.push(
            ax0, ay0, az0,
            ax1, ay1, az1,
            bx0, by0, bz0,
            bx1, by1, bz1,
          );
          const aHigh = shadeAt(ay0, aTop, aBottom, a.gx, a.gz, tone, aDepth0, rim);
          const aLow = shadeAt(ay1, aTop, aBottom, a.gx, a.gz, tone, aDepth1, rim);
          const bHigh = shadeAt(by0, bTop, bBottom, b.gx, b.gz, tone, bDepth0, rim);
          const bLow = shadeAt(by1, bTop, bBottom, b.gx, b.gz, tone, bDepth1, rim);
          colors.push(
            aHigh.r, aHigh.g, aHigh.b, 1,
            aLow.r, aLow.g, aLow.b, 1,
            bHigh.r, bHigh.g, bHigh.b, 1,
            bLow.r, bLow.g, bLow.b, 1,
          );
          masks.push(aHigh.moss, aLow.moss, bHigh.moss, bLow.moss);
          const aU = (alongZ ? a.gz : a.gx) / WALL_TILE;
          const bU = (alongZ ? b.gz : b.gx) / WALL_TILE;
          uvs.push(
            aU, ay0 / WALL_TILE,
            aU, ay1 / WALL_TILE,
            bU, by0 / WALL_TILE,
            bU, by1 / WALL_TILE,
          );
          const dx = b.gx - a.gx;
          const dz = b.gz - a.gz;
          if (-dz * windX + dx * windZ < 0) indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
          else indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
        }
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
    const flatNormals = data.normals.slice();
    smoothCoincidentNormals(positions, data.normals);
    for (let i = 0; i < data.normals.length; i += 3) {
      const nx = flatNormals[i] + (data.normals[i] - flatNormals[i]) * CLIFF_NORMAL_BLEND;
      const ny = flatNormals[i + 1] + (data.normals[i + 1] - flatNormals[i + 1]) * CLIFF_NORMAL_BLEND;
      const nz = flatNormals[i + 2] + (data.normals[i + 2] - flatNormals[i + 2]) * CLIFF_NORMAL_BLEND;
      const length = Math.hypot(nx, ny, nz) || 1;
      data.normals[i] = nx / length;
      data.normals[i + 1] = ny / length;
      data.normals[i + 2] = nz / length;
    }
    data.applyToMesh(mesh);
    mesh.setVerticesData('mossMask', new Float32Array(masks), false, 1);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.metadata = { shadowAlways: true };
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

    const wall = (x1, z1, x2, z2, cx, cz) => {
      const insideX = cx * CELL_SIZE;
      const insideZ = cz * CELL_SIZE;
      const sampleY = (x, z) => this.heightAt(
        x + (insideX - x) * 0.08,
        z + (insideZ - z) * 0.08,
      );
      const alongX = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
      for (let i = 0; i < SURFACE_SUB; i += 1) {
        const t0 = i / SURFACE_SUB;
        const t1 = (i + 1) / SURFACE_SUB;
        const ax = x1 + (x2 - x1) * t0;
        const az = z1 + (z2 - z1) * t0;
        const bx = x1 + (x2 - x1) * t1;
        const bz = z1 + (z2 - z1) * t1;
        const ay = sampleY(ax, az);
        const by = sampleY(bx, bz);
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
      if (!floorKeys.has(`${cx},${cz - 1}`)) wall(x0, z0, x1, z0, cx, cz);
      if (!floorKeys.has(`${cx + 1},${cz}`)) wall(x1, z0, x1, z1, cx, cz);
      if (!floorKeys.has(`${cx},${cz + 1}`)) wall(x1, z1, x0, z1, cx, cz);
      if (!floorKeys.has(`${cx - 1},${cz}`)) wall(x0, z1, x0, z0, cx, cz);
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
    material.diffuseColor = new Color3(1.02, 1.01, 0.98);
    material.specularColor = new Color3(0.05, 0.05, 0.05);
    material.backFaceCulling = false;
    const bump = new Texture(CLIFF_NORMAL, this.s);
    bump.wrapU = Texture.WRAP_ADDRESSMODE;
    bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.gammaSpace = false;
    material.twoSidedLighting = true;
    bump.level = 1.4;
    material.bumpTexture = bump;
    const strata = this.cliffBlendTexture(CLIFF_STRATA_TEXTURE);
    const moss = this.cliffBlendTexture(CLIFF_MOSS_TEXTURE);
    new CliffSurfacePlugin(material, { strata, moss });
    this.addCliffWaterPlugins(material, 0.5);
    return material;
  }

  cliffBlendTexture(url) {
    const texture = new Texture(url, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    this.cliffBlendTextures.push(texture);
    return texture;
  }


  addCliffWaterPlugins(material, wet) {
    this.causticPlugins.push(new TerrainCausticPlugin(material));
    this.wetPlugins.push(new TerrainWetPlugin(material, wet));
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
    this.addCliffWaterPlugins(material, 0.55);
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
      material.backFaceCulling = false;
      material.twoSidedLighting = true;
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
    for (const texture of this.cliffBlendTextures) {
      if (texture) texture.dispose();
    }
    this.cliffBlendTextures.length = 0;
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
