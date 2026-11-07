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
import { CELL_SIZE } from '../../utils/gridMath.js';
import { buildBridge, deckHeightAt, bridgeSpan, bridgeCellOf, BRIDGE_BURIAL, BRIDGE_RISE } from '../../utils/bridgeShape.js';
import { createTerrainField } from '../../utils/terrainField.js';
import { getMap } from '../../data/catalogs/maps.js';
import { getDecoration, DEFAULT_FLOOR } from '../../data/catalogs/decorations.js';
import { groundCells, worldCells, planeLevels, levelOfEntry, columnsByCell, layerLiftAt, floorCellAt } from '../../data/maps/areaShape.js';
import { buildColumnRuns } from '../../utils/terrainRuns.js';
import { buildCornerDebugMeshes, buildSolidBlockMesh } from './terrainDebug.js';
import { buildRunVolumeBuckets } from './runVolume.js';
import { ASSET_DIRS } from '../../data/catalogs/assetPaths.js';
import TerrainBlendPlugin from './terrainBlendPlugin.js';
import TerrainReliefPlugin from './terrainReliefPlugin.js';
import TerrainGrassPlugin from './terrainGrassPlugin.js';
import TerrainCausticPlugin from './terrainCausticPlugin.js';
import TerrainWetPlugin from './terrainWetPlugin.js';
import CliffSurfacePlugin from './cliffSurfacePlugin.js';
import { GRASS_GROUND, grassGroundUrls } from '../../data/catalogs/grass.js';

const PICK_LIFT = 0.002;
const GRID_LIFT = 0.02;
const GRID_SUB = 2;
const SURFACE_SUB = 4;
const SURFACE_CHUNK = 4;
const CAVE_OPEN_STEP = 0.6;
const RISE_SAMPLES = 8;
const CLIFF_LOW_GAP = 0.9;
const CLIFF_TOP_GAP = 0.25;
const EDGE_ANCHOR_DEPTH = 0.4;
const WALL_TILE = 3;
const SURFACE_DEPTH = 1;
const CLIFF_TEXTURE = `${ASSET_DIRS.textures}Rock050_1K-JPG_Color.jpg`;
const CLIFF_NORMAL = `${ASSET_DIRS.textures}Rock050_1K-JPG_NormalGL.jpg`;
const CLIFF_STRATA_TEXTURE = `${ASSET_DIRS.textures}Rock023_1K-JPG_Color.jpg`;
const CLIFF_MOSS_TEXTURE = `${ASSET_DIRS.textures}Rock063_1K-JPG_Color.jpg`;
const CLAY_CLIFF_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const CLAY_CLIFF_NORMAL = `${ASSET_DIRS.textures}Ground071_1K-JPG_NormalGL.jpg`;
const SURFACE_BLEND_RADIUS = 1.8;
const SURFACE_BLEND_SLOTS = 3;
const SURFACE_BLEND_BLOCK_STEP = 1;
const SURFACE_BLEND_SHARED_MAX = 128;
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

function planeView(field, level) {
  if (!field || !level) return field;
  return {
    heightAt: (x, z) => field.heightAt(x, z, level),
    heightAtCell: (cx, cz) => field.heightAtCell(cx, cz, level),
    heightAtSide: (x, z, cx, cz) => field.heightAtSide(x, z, cx, cz, level),
    isHardEdge: (cx, cz, dx, dz) => field.isHardEdge(cx, cz, dx, dz, level),
    cliffStyleAt: (cx, cz) => field.cliffStyleAt(cx, cz, level),
    isHole: (cx, cz) => field.isHole(cx, cz, level),
  };
}

function cliffOffset(x, z) {
  return (valueNoise(x * CLIFF_WAVE_SCALE + 11.3, z * CLIFF_WAVE_SCALE - 7.1) - 0.5) * 2 * CLIFF_WAVE;
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

function wallTint(x, y, z, t) {
  const grain = valueNoise(x * 0.37 + 4.1, z * 0.37 - 2.3);
  const stripe = 0.5 + 0.5 * Math.sin(y * 0.95 + grain * 3.1);
  const base = 0.66 + 0.34 * Math.pow(t, 0.62);
  const moss = smoothstep(0.70, 0.97, t + (grain - 0.5) * 0.18) * (0.35 + 0.65 * grain);
  const contact = 0.58 + 0.42 * smoothstep(0.02, 0.26, t);
  const shade = base * (0.86 + 0.16 * grain) * (0.90 + 0.14 * stripe) * contact;
  return {
    r: shade * (1 - 0.12 * moss),
    g: shade * (1 + 0.03 * moss),
    b: shade * (1 - 0.20 * moss),
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
    this.reliefPlugins = new Map();
    this.reliefTextures = new Map();
    this.blendTextures = new Map();
    this.groundPatch = { patch: 1 };
    this.grassGroundTex = null;
    this.weightTextures = [];
    this.causticPlugins = [];
    this.wetPlugins = [];
    this.cliffMaterials = null;
    this.cliffBlendTextures = [];
    this.gridLines = null;
    this.gridVisible = false;

    this.field = null;
    this.floorKeys = new Map();
    this.mapKey = null;
    this.bridges = [];
    this.mouths = new Map();
    this.surfaceEdge = new Map();
    this.ready = Promise.resolve(null);
  }

  whenReady() {
    return this.ready || Promise.resolve();
  }

  heightAt(x, z, level = 0) {
    return this.field ? this.field.heightAt(x, z, level) : 0;
  }

  heightAtCell(cx, cz, level = 0) {
    return this.field ? this.field.heightAtCell(cx, cz, level) : 0;
  }

  solidRunsAt(cx, cz) {
    return this.solidRuns().get(`${cx},${cz}`) || [];
  }

  solidRuns() {
    if (!this.columnRuns) this.columnRuns = buildColumnRuns(this.layout || {});
    return this.columnRuns;
  }

  hardEdgeAt(cx, cz, dx, dz) {
    return this.field && this.field.isHardEdge ? this.field.isHardEdge(cx, cz, dx, dz) : false;
  }

  urlFlag(name) {
    if (typeof location === 'undefined' || !location.search) return false;
    try {
      return new URLSearchParams(location.search).has(name);
    } catch {
      return false;
    }
  }

  solidDebugEnabled() {
    return this.urlFlag('solid');
  }

  surfaceShiftAt(gx, gz) {
    const shifts = this.surfaceShift;
    if (!shifts) return null;
    return shifts.get(pointId(gx, gz)) || null;
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
    this.gridLines = null;
    this.field = null;
    this.floorKeys.clear();
    this.bridges = [];
    this.groundCells = [];
    this.realCells = [];
  }

  resetSurfaces() {
    for (const mesh of this.surfaces) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.surfaces = [];
    this.surfaceChunks = [];
    this.roofMeshes = [];
    this.caveRimMesh = null;
    this.caveRoofCells = new Set();
    for (const texture of this.weightTextures) texture.dispose();
    this.weightTextures = [];
    this.shelfAnchors = [];
    this.bridges = [];
    this.surfaceEdge.clear();
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
    this.columnRuns = null;
    const vents = this.connectorInfo();
    this.mouths = vents.mouths;
    this.resetSurfaces();
    if (this.solidDebugEnabled()) {
      const blocks = buildSolidBlockMesh(this, world, WALL_TILE);
      if (blocks) this.surfaces.push(blocks);
      this.createPicker(this.pickCells());
      this.ready = Promise.resolve(this.surfaces);
      if (this.onRebuilt) this.onRebuilt();
      return this.surfaces;
    }
    for (const level of planeLevels(world)) {
      this.createSurface(map, groundCells(world, level), level);
    }
    this.createVolumeMass(map);
    this.createEdgeAnchors();
    this.createCaveReveal(map);
    if (this.urlFlag('corners')) this.surfaces.push(...buildCornerDebugMeshes(this));
    this.createPicker(this.pickCells());
    this.gridLines = this.createGridLines(map, this.realCells);
    this.ready = Promise.resolve(this.surfaces);
    if (this.onRebuilt) this.onRebuilt();
    return this.surfaces;
  }

  caveMeshes() {
    const list = [];
    for (const mesh of this.surfaces) {
      if (!mesh || mesh.isDisposed()) continue;
      const name = mesh.name || '';
      if (name.startsWith('terrainCaveWall') || name.startsWith('terrainCeiling') || name.includes('_L-')) {
        list.push(mesh);
      }
    }
    return list;
  }

  createCaveReveal(map) {
    const columns = columnsByCell(this.layout || {});
    const roofs = new Map();
    for (const [id, planes] of columns) {
      let top = null;
      let ceil = null;
      for (const plane of planes) {
        if (plane.level === 0 && top === null) top = plane.lift;
        if (plane.level < 0 && Number.isFinite(plane.ceil)) ceil = plane.ceil;
      }
      if (top === null || ceil === null || top <= ceil) continue;
      roofs.set(id, { top, ceil });
    }
    this.caveRoofCells = new Set(roofs.keys());
    if (!roofs.size) return;
    const half = CELL_SIZE / 2;
    const positions = [];
    const indices = [];
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => {
      const start = positions.length / 3;
      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    for (const [id, info] of roofs) {
      const [cx, cz] = id.split(',').map(Number);
      const x0 = cx * CELL_SIZE - half;
      const x1 = x0 + CELL_SIZE;
      const z0 = cz * CELL_SIZE - half;
      const z1 = z0 + CELL_SIZE;
      const b = info.ceil;
      const t = info.top;
      if (!roofs.has(`${cx + 1},${cz}`)) quad(x1, b, z0, x1, b, z1, x1, t, z1, x1, t, z0);
      if (!roofs.has(`${cx - 1},${cz}`)) quad(x0, b, z0, x0, b, z1, x0, t, z1, x0, t, z0);
      if (!roofs.has(`${cx},${cz + 1}`)) quad(x0, b, z1, x1, b, z1, x1, t, z1, x0, t, z1);
      if (!roofs.has(`${cx},${cz - 1}`)) quad(x0, b, z0, x1, b, z0, x1, t, z0, x0, t, z0);
    }
    if (!positions.length) return;
    const normals = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new Mesh('terrainCaveRim', this.s);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    let material = this.materials.get('caveRim');
    if (!material) {
      material = new StandardMaterial('terrainCaveRimMat', this.s);
      material.diffuseColor = new Color3(0.34, 0.31, 0.28);
      material.specularColor = new Color3(0, 0, 0);
      material.ambientColor = new Color3(0.1, 0.1, 0.1);
      material.backFaceCulling = false;
      this.materials.set('caveRim', material);
    }
    mesh.material = material;
    mesh.metadata = { caveRim: true };
    mesh.setEnabled(false);
    this.surfaces.push(mesh);
    this.caveRimMesh = mesh;
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

  createSurface(map, cells, level = 0) {
    const suffix = level === 0 ? '' : `_L${level}`;
    const tint = new Color3(...SURFACE_VERTEX_TINT);
    const step = CELL_SIZE / SURFACE_SUB;
    const half = CELL_SIZE / 2;
    const groups = new Map();
    const keys = new Map();
    const floorKeys = new Map();
    for (const entry of (this.layout || {}).floor || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      if (levelOfEntry(entry) !== level) continue;
      if (entry.key) floorKeys.set(`${entry.cx},${entry.cz}`, entry.key);
    }
    for (const [cx, cz] of cells) {
      keys.set(`${cx},${cz}`, floorKeys.get(`${cx},${cz}`) || DEFAULT_FLOOR);
    }
    if (level === 0) this.floorKeys = keys;
    const keyAt = (cx, cz) => keys.get(`${cx},${cz}`) || null;
    const field = planeView(this.field, level);
    const caveColumns = columnsByCell(this.layout || {});
    const overCaveAt = (cx, cz) => {
      const planes = caveColumns.get(`${cx},${cz}`) || [];
      for (const plane of planes) {
        if (plane.level < level && Number.isFinite(plane.ceil)) return true;
      }
      return false;
    };
    const mouthFloor = new Map();
    for (const [id, mouth] of this.mouths || []) {
      if (!mouth || !Number.isFinite(mouth.bottom)) continue;
      const [cell, dir] = id.split('|');
      const [mCx, mCz] = cell.split(',').map(Number);
      const [dirX, dirZ] = dir.split(',').map(Number);
      const key = `${mCx + dirX},${mCz + dirZ}|${-dirX},${-dirZ}`;
      const prev = mouthFloor.get(key);
      if (prev === undefined || mouth.bottom < prev) mouthFloor.set(key, mouth.bottom);
    }
    const spreads = (key) => {
      const cfg = this.surfaceConfig(key);
      return Boolean(cfg && cfg.spreads);
    };
    const partnerFor = (key) => {
      if (spreads(key)) return [];
      const counts = new Map();
      for (const [cx, cz] of cells) {
        if (keyAt(cx, cz) !== key) continue;
        for (const [dx, dz] of BLEND_NEIGHBORS) {
          const other = keyAt(cx + dx, cz + dz);
          if (!other || other === key) continue;
          counts.set(other, (counts.get(other) || 0) + 1);
        }
      }
      const ranked = [...counts.entries()].sort((a, b) => {
        const spreadA = spreads(a[0]) ? 1 : 0;
        const spreadB = spreads(b[0]) ? 1 : 0;
        if (spreadA !== spreadB) return spreadB - spreadA;
        return b[1] - a[1];
      });
      return ranked.slice(0, SURFACE_BLEND_SLOTS).map(([other]) => other);
    };
    const weightCache = new Map();
    const weightsFor = (key, partner) => {
      const cacheId = `${key}|${partner}`;
      const cached = weightCache.get(cacheId);
      if (cached) return cached;
      const ownConfig = this.surfaceConfig(key);
      const blendRadius = ownConfig && Number.isFinite(ownConfig.blendRadius)
        ? ownConfig.blendRadius
        : SURFACE_BLEND_RADIUS;
      const maxWeight = spreads(partner) ? 255 : SURFACE_BLEND_SHARED_MAX;
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
      const stepBetween = (cx, cz, nx, nz) => Math.abs(field.heightAtCell(cx, cz) - field.heightAtCell(nx, nz));
      const blockedFrom = (cx, cz, nx, nz) => {
        const dx = nx - cx;
        const dz = nz - cz;
        if (dx && dz) {
          const blockedA = stepBetween(cx, cz, cx + dx, cz) > SURFACE_BLEND_BLOCK_STEP
            || stepBetween(cx + dx, cz, nx, nz) > SURFACE_BLEND_BLOCK_STEP;
          const blockedB = stepBetween(cx, cz, cx, cz + dz) > SURFACE_BLEND_BLOCK_STEP
            || stepBetween(cx, cz + dz, nx, nz) > SURFACE_BLEND_BLOCK_STEP;
          return blockedA && blockedB;
        }
        return stepBetween(cx, cz, nx, nz) > SURFACE_BLEND_BLOCK_STEP;
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
          if (isPartner) {
            let weight = maxWeight;
            if (isDry(cx, cz)) {
              const toWall = wallReach(cx, cz, x, z);
              if (Number.isFinite(toWall)) weight = Math.round(maxWeight * Math.min(1, toWall / SURFACE_BLEND_WALL_FADE));
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
          const band = blendRadius
            * (0.65 + 0.7 * coarse)
            * (0.9 + 0.2 * fine)
            * (0.55 + 0.9 * tongue);
          const fade = Math.min(1, Math.max(0, (soft - SURFACE_BLEND_COLLAR) / band));
          let weight = Math.round((1 - smooth(fade)) * maxWeight);
          if (weight < SURFACE_BLEND_SPECK_MIN) {
            const speck = valueNoise(x / SURFACE_BLEND_SPECK + 71.1, z / SURFACE_BLEND_SPECK - 29.3);
            if (speck > SURFACE_BLEND_SPECK_EDGE) {
              const amount = (speck - SURFACE_BLEND_SPECK_EDGE) / (1 - SURFACE_BLEND_SPECK_EDGE);
              weight = Math.round(amount * SURFACE_BLEND_SPECK_MAX * (maxWeight / 255));
            }
          }
          data[j * width + i] = weight;
        }
      }
      const texture = new RawTexture(data, width, height, Constants.TEXTUREFORMAT_R, this.s, false, false, Texture.BILINEAR_SAMPLINGMODE);
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      this.weightTextures.push(texture);
      const result = { texture, origin: new Vector2(x0, z0), scale: new Vector2(1 / spanX, 1 / spanZ) };
      weightCache.set(cacheId, result);
      return result;
    };
    const groupFor = (key, cx, cz, roof = false) => {
      const chunkX = Math.floor(cx / SURFACE_CHUNK);
      const chunkZ = Math.floor(cz / SURFACE_CHUNK);
      const id = roof ? `${key}|roof` : `${key}|${chunkX}|${chunkZ}`;
      let group = groups.get(id);
      if (!group) {
        const cfg = this.surfaceConfig(key);
        group = {
          key,
          roof: Boolean(roof),
          chunkX: roof ? 0 : chunkX,
          chunkZ: roof ? 0 : chunkZ,
          positions: [],
          indices: [],
          uvs: [],
          colors: [],
          vertices: new Map(),
          tile: (cfg && cfg.tile) || 1,
        };
        groups.set(id, group);
      }
      return group;
    };
    const slot = (group, x, z, px = x, pz = z, py = null, owner = null) => {
      const id = owner ? `${x},${z}|${owner}` : `${x},${z}`;
      const found = group.vertices.get(id);
      if (found !== undefined) return found;
      const index = group.positions.length / 3;
      group.vertices.set(id, index);
      const y = py === null ? field.heightAt(px, pz) : py;
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
    if (level === 0) this.surfaceShift = cliffShifts;

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

    this.surfaceEdge.set(level, { weldedAt, cliffPoints, heightOf });

    if (level === 0) this.bridges = this.bridgePlansFor(map, keyAt, positionOf, weldedAt);

    for (const [cx, cz] of cells) {
      const key = keyAt(cx, cz);
      if (!this.surfaceConfig(key)) continue;
      const roof = overCaveAt(cx, cz);
      const group = groupFor(key, cx, cz, roof);
      if (roof) group.overCave = true;
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
          let py = weldedValue !== null
            ? weldedValue
            : (!split && edge ? field.heightAt(pos.px, pos.pz) : heightOf(point, cx, cz));
          let mouthFlat = null;
          if (edge && mouthFloor.size) {
            const sx = i === 0 ? -1 : i === SURFACE_SUB ? 1 : 0;
            const sz = j === 0 ? -1 : j === SURFACE_SUB ? 1 : 0;
            const take = (dx, dz) => {
              const value = mouthFloor.get(`${cx},${cz}|${dx},${dz}`);
              if (value !== undefined) mouthFlat = mouthFlat === null ? value : Math.min(mouthFlat, value);
            };
            if (sx !== 0) take(sx, 0);
            if (sz !== 0) take(0, sz);
            if (mouthFlat !== null) py = mouthFlat;
          }
          let px = pos.px;
          let pz = pos.pz;
          if (mouthFlat !== null) {
            px = gx;
            pz = gz;
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

    const blends = new Map();
    if (level === 0) {
      const floorKeys = new Set();
      for (const group of groups.values()) floorKeys.add(group.key);
      for (const key of floorKeys) {
        const partners = [];
        for (const partner of partnerFor(key)) {
          const cfg = this.surfaceConfig(partner);
          if (!cfg || !cfg.texture) continue;
          partners.push({
            key: partner,
            tile: cfg.tile || 1,
            color: this.surfaceColor(partner, map),
            weights: weightsFor(key, partner),
          });
        }
        blends.set(key, partners.length ? { partners } : null);
      }
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

    for (const group of groups.values()) {
      if (!group.positions.length) continue;
      const key = group.key;
      const base = key === DEFAULT_FLOOR ? 'terrainSurface' : `terrainSurface_${key}`;
      if (group.roof) {
        const roof = new Mesh(`${base}_roof${suffix}`, this.s);
        const roofData = new VertexData();
        roofData.positions = group.positions;
        roofData.indices = group.indices;
        roofData.uvs = group.uvs;
        roofData.colors = group.colors;
        roofData.normals = group.normals;
        roofData.applyToMesh(roof);
        roof.isPickable = false;
        roof.receiveShadows = true;
        roof.metadata = { level, roof: true };
        roof.material = this.materialFor(key, map, blends.get(key));
        this.surfaces.push(roof);
        this.roofMeshes.push(roof);
        continue;
      }
      const mesh = new Mesh(`${base}_c${group.chunkX}_${group.chunkZ}${suffix}`, this.s);
      const data = new VertexData();
      data.positions = group.positions;
      data.indices = group.indices;
      data.uvs = group.uvs;
      data.colors = group.colors;
      data.normals = group.normals;
      data.applyToMesh(mesh);
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.metadata = {
        level,
        overCave: Boolean(group.overCave),
        chunkX: group.chunkX,
        chunkZ: group.chunkZ,
        minCx: group.chunkX * SURFACE_CHUNK,
        maxCx: (group.chunkX + 1) * SURFACE_CHUNK - 1,
        minCz: group.chunkZ * SURFACE_CHUNK,
        maxCz: (group.chunkZ + 1) * SURFACE_CHUNK - 1,
      };
      mesh.material = this.materialFor(key, map, blends.get(key));
      this.surfaces.push(mesh);
      this.surfaceChunks.push(mesh);
    }

    if (this.bridges.length) this.createBridges(map, blends);
    if (level === 0) this.shelfAnchors = [];
  }

  connectorInfo() {
    const layout = this.layout || {};
    const mouths = new Map();
    const levelOf = (end) => (end && Number.isFinite(end.level) ? end.level : 0);
    const mouthFor = (end, dx, dz) => {
      const entry = floorCellAt(layout, end.cx, end.cz, levelOf(end));
      if (!entry || !Number.isFinite(entry.ceilY)) return;
      const bottom = entry.liftY || 0;
      if (entry.ceilY <= bottom) return;
      mouths.set(`${end.cx},${end.cz}|${dx},${dz}`, { bottom, top: entry.ceilY });
    };
    const liftAt = (end, loose) => {
      const lift = layerLiftAt(layout, end.cx, end.cz, levelOf(end));
      if (lift !== null) return lift;
      if (!loose || !this.field) return null;
      const height = this.field.heightAt(end.cx * CELL_SIZE, end.cz * CELL_SIZE, levelOf(end));
      return Number.isFinite(height) ? height : null;
    };
    const records = this.effectiveConnectors();
    this.movementConnectors = records;
    for (const record of records) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const vertical = from.cx === to.cx && from.cz === to.cz;
      const fromLift = liftAt(from, vertical);
      const toLift = liftAt(to, vertical);
      if (fromLift === null || toLift === null) continue;
      if (vertical) continue;
      const dx = Math.sign(to.cx - from.cx);
      const dz = Math.sign(to.cz - from.cz);
      mouthFor(from, dx, dz);
      mouthFor(to, -dx, -dz);
    }
    return { mouths };
  }

  effectiveConnectors() {
    const explicit = (this.layout && this.layout.connectors) || [];
    const records = explicit
      .filter((record) => record && record.from && record.to)
      .map((record) => ({ from: { ...record.from }, to: { ...record.to }, kind: record.kind }));
    const columns = columnsByCell(this.layout || {});
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [id, planes] of columns) {
      const [cx, cz] = id.split(',').map(Number);
      for (const plane of planes) {
        if (plane.level >= 0 || !Number.isFinite(plane.ceil)) continue;
        const caveLevel = plane.level;
        const caveFloor = plane.lift;
        for (const [dx, dz] of dirs) {
          const nplanes = columns.get(`${cx + dx},${cz + dz}`);
          if (!nplanes) continue;
          let nGround = null;
          let nHasCave = false;
          for (const np of nplanes) {
            if (np.level === 0) nGround = np.lift;
            if (np.level === caveLevel) nHasCave = true;
          }
          if (nHasCave || nGround === null) continue;
          if (Math.abs(caveFloor - nGround) > CAVE_OPEN_STEP) continue;
          const exists = records.some((record) => {
            const fl = Number.isFinite(record.from.level) ? record.from.level : 0;
            const tl = Number.isFinite(record.to.level) ? record.to.level : 0;
            const fro = record.from;
            const too = record.to;
            return (too.cx === cx && too.cz === cz && tl === caveLevel && fro.cx === cx + dx && fro.cz === cz + dz)
              || (fro.cx === cx && fro.cz === cz && fl === caveLevel && too.cx === cx + dx && too.cz === cz + dz);
          });
          if (exists) continue;
          records.push({ from: { cx: cx + dx, cz: cz + dz, level: 0 }, to: { cx, cz, level: caveLevel }, kind: 'opening' });
        }
      }
    }
    return records;
  }

  createVolumeMass(map) {
    const shade = { cave: 0.62, ceiling: 0.42 };
    const buckets = buildRunVolumeBuckets(this.layout || {}, {
      chunkSize: SURFACE_CHUNK,
      cellSize: CELL_SIZE,
      tileOf: (kind, name) => {
        if (kind === 'cliff') return WALL_TILE;
        const cfg = this.surfaceConfig(name);
        return (cfg && cfg.tile) || 1;
      },
      subdivisions: SURFACE_SUB,
      depth: SURFACE_DEPTH,
      styleOf: (cx, cz) => (this.field && this.field.cliffStyleAt ? this.field.cliffStyleAt(cx, cz) : null),
      surface: (gx, gz, cx, cz, dx, dz, fallback) => this.edgeHeightAt(gx, gz, cx, cz, dx, dz, fallback),
      hardEdge: (cx, cz, dx, dz) => (this.field && this.field.isHardEdge ? this.field.isHardEdge(cx, cz, dx, dz) : false),
      shiftAt: (gx, gz) => this.surfaceShiftAt(gx, gz),
    });
    for (const group of buckets) {
      if (!group.positions.length) continue;
      const total = group.positions.length / 3;
      const factor = Number.isFinite(shade[group.kind]) ? shade[group.kind] : 1;
      const colors = new Array(total * 4);
      const mosses = group.kind === 'cliff' ? new Array(total) : null;
      for (let i = 0; i < total; i += 1) {
        const px = group.positions[i * 3];
        const pz = group.positions[i * 3 + 2];
        const grain = 0.94 + 0.12 * valueNoise(px * 0.55 + 7.3, pz * 0.55 - 3.9);
        if (mosses) {
          const tint = wallTint(px, group.positions[i * 3 + 1], pz, group.shades[i] || 0);
          colors[i * 4] = tint.r * grain;
          colors[i * 4 + 1] = tint.g * grain;
          colors[i * 4 + 2] = tint.b * grain;
          colors[i * 4 + 3] = 1;
          mosses[i] = tint.moss;
        } else {
          colors[i * 4] = SURFACE_VERTEX_TINT[0] * factor * grain;
          colors[i * 4 + 1] = SURFACE_VERTEX_TINT[1] * factor * grain;
          colors[i * 4 + 2] = SURFACE_VERTEX_TINT[2] * factor * grain;
          colors[i * 4 + 3] = 1;
        }
      }
      const mesh = new Mesh(this.volumeMeshName(group), this.s);
      const data = new VertexData();
      data.positions = group.positions;
      data.indices = group.indices;
      data.uvs = group.uvs;
      data.colors = colors;
      data.normals = [];
      VertexData.ComputeNormals(group.positions, group.indices, data.normals);
      data.applyToMesh(mesh);
      if (group.kind === 'cliff') {
        const style = group.name === 'dirt' ? 'dirt' : 'stone';
        if (style === 'stone') mesh.setVerticesData('mossMask', new Float32Array(mosses), false, 1);
        mesh.material = this.cliffMaterialFor(style);
      } else if (group.kind === 'ceiling') {
        mesh.material = this.ceilingMaterialFor(group.name, map);
      } else if (group.kind === 'soil') {
        mesh.material = this.bandMaterialFor(group.name, map);
      } else {
        mesh.material = this.materialFor(group.name, map);
      }
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.metadata = {
        volume: true,
        kind: group.kind,
        key: group.name,
        chunkX: group.chunkX,
        chunkZ: group.chunkZ,
      };
      this.surfaces.push(mesh);
    }
  }

  createEdgeAnchors() {
    const field = this.field;
    if (!field || !field.heightAtCell || !this.shelfAnchors) return;
    const seen = new Set();
    const half = CELL_SIZE / 2;
    for (const [cx, cz] of this.realCells || []) {
      if (!this.floorKeyAt(cx, cz)) continue;
      const here = field.heightAtCell(cx, cz);
      if (!Number.isFinite(here)) continue;
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.hardEdgeAt(cx, cz, dx, dz)) continue;
        if (field.heightAtCell(cx + dx, cz + dz) >= here - 0.001) continue;
        if (!this.floorKeyAt(cx + dx, cz + dz)) continue;
        const edgeId = `${Math.round((cx + dx * 0.5) * 4)},${Math.round((cz + dz * 0.5) * 4)}`;
        if (seen.has(edgeId)) continue;
        seen.add(edgeId);
        for (const step of [1, 3]) {
          const t = step / 4;
          const gx = dx !== 0 ? x0 + (dx > 0 ? CELL_SIZE : 0) : x0 + CELL_SIZE * t;
          const gz = dz !== 0 ? z0 + (dz > 0 ? CELL_SIZE : 0) : z0 + CELL_SIZE * t;
          const shift = this.surfaceShiftAt(gx, gz);
          const y = this.edgeHeightAt(gx, gz, cx, cz, dx, dz, here);
          if (!Number.isFinite(y)) continue;
          this.shelfAnchors.push({
            x: gx + (shift ? shift.x : 0),
            y,
            z: gz + (shift ? shift.z : 0),
            dirX: dx,
            dirZ: dz,
            depth: EDGE_ANCHOR_DEPTH,
          });
        }
      }
    }
  }

  edgeHeightAt(gx, gz, cx, cz, dx, dz, fallback) {
    const field = this.field;
    if (!field || !field.heightAtSide) return fallback;
    const source = this.surfaceEdge.get(0);
    let height;
    if (source) {
      const id = pointId(gx, gz);
      const welded = source.weldedAt(id, cx, cz);
      if (welded !== null) height = welded;
      else if (source.cliffPoints.has(id)) height = source.heightOf({ gx, gz }, cx, cz);
      else height = field.heightAt(gx, gz);
    } else {
      height = field.heightAt(gx, gz);
    }
    return Number.isFinite(height) ? height : fallback;
  }

  volumeMeshName(group) {
    const suffix = `c${group.chunkX}_${group.chunkZ}`;
    if (group.kind === 'ceiling') return `terrainCeiling_vol_${suffix}_${group.name}`;
    if (group.kind === 'cave') return `terrainCaveWall_vol_${suffix}_${group.name}`;
    if (group.kind === 'soil') return `terrainSoil_vol_${suffix}_${group.name}`;
    return `terrainVolume_${suffix}_${group.name}`;
  }

  ceilingMaterialFor(key, map) {
    const cacheKey = `ceiling|${key}`;
    const cached = this.materials.get(cacheKey);
    if (cached) return cached;
    const cfg = this.surfaceConfig(key) || {};
    const material = new StandardMaterial(`terrainCeilingMat_${key}`, this.s);
    if (cfg.texture) material.diffuseTexture = new Texture(cfg.texture, this.s);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
    material.useVertexColor = true;
    material.backFaceCulling = true;
    material.diffuseColor = color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
    this.materials.set(cacheKey, material);
    return material;
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
    return plan;
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

  walkHeightAt(x, z, level = 0) {
    const deck = level === 0 ? this.bridgeDeckAt(x, z) : null;
    return deck === null ? this.heightAt(x, z, level) : deck;
  }

  riseNear(x, z, radius, level = 0) {
    const base = this.walkHeightAt(x, z, level);
    let rise = 0;
    for (let index = 0; index < RISE_SAMPLES; index += 1) {
      const angle = (index / RISE_SAMPLES) * Math.PI * 2;
      const height = this.walkHeightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, level);
      rise = Math.max(rise, height - base);
    }
    return rise;
  }

  cliffOverlap(x, z, level = 0) {
    const field = this.field;
    if (!field) return -Infinity;
    if (level === 0 && this.bridgeDeckAt(x, z) !== null) return -Infinity;
    const cx = Math.round(x / CELL_SIZE);
    const cz = Math.round(z / CELL_SIZE);
    const half = CELL_SIZE / 2;
    const here = field.heightAtCell(cx, cz, level);
    let overlap = -Infinity;
    for (const side of SURFACE_SIDES) {
      if (!field.isHardEdge(cx, cz, side.dx, side.dz, level)) continue;
      const below = here < field.heightAtCell(cx + side.dx, cz + side.dz, level);
      const margin = below ? CLIFF_LOW_GAP : CLIFF_TOP_GAP;
      const distance = side.dx !== 0
        ? (side.dx > 0 ? cx * CELL_SIZE + half - x : x - (cx * CELL_SIZE - half))
        : (side.dz > 0 ? cz * CELL_SIZE + half - z : z - (cz * CELL_SIZE - half));
      overlap = Math.max(overlap, margin - distance);
    }
    return overlap;
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
    const bump = new Texture(CLAY_CLIFF_NORMAL, this.s);
    bump.wrapU = Texture.WRAP_ADDRESSMODE;
    bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.gammaSpace = false;
    bump.anisotropicFilteringLevel = 4;
    bump.level = 1.2;
    material.bumpTexture = bump;
    this.addCliffWaterPlugins(material, 0.55);
    return material;
  }

  surfaceConfig(key) {
    const def = getDecoration(key);
    if (def && def.surface && def.surface.texture) return def.surface;
    const fallback = getDecoration(DEFAULT_FLOOR);
    return fallback && fallback.surface && fallback.surface.texture ? fallback.surface : null;
  }

  blendSetupFor(blend) {
    const blends = blend.partners.map((partner) => {
      const cfg = this.surfaceConfig(partner.key);
      const patch = Boolean(cfg && cfg.patch);
      return {
        texture: this.blendTextureFor(partner.key),
        patch,
        weights: partner.weights.texture,
        tile: partner.tile,
        color: partner.color,
        origin: partner.weights.origin,
        scale: partner.weights.scale,
      };
    });
    const needsPatch = blends.some((slot) => slot.patch);
    const patch = needsPatch ? {
      textures: this.groundGrassTextures(),
      tiles: GRASS_GROUND.tiles,
      state: this.groundPatch,
    } : null;
    return { blends, patch };
  }

  bandMaterialFor(key, map) {
    const cacheKey = 'band|' + key;
    const cached = this.materials.get(cacheKey);
    if (cached) return cached;
    const cfg = this.surfaceConfig(key) || {};
    const material = new StandardMaterial('terrainBandMat_' + key, this.s);
    const colorTexture = new Texture(CLAY_CLIFF_TEXTURE, this.s);
    colorTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    colorTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    colorTexture.anisotropicFilteringLevel = 4;
    material.diffuseTexture = colorTexture;
    const bumpTexture = new Texture(CLAY_CLIFF_NORMAL, this.s);
    bumpTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    bumpTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    bumpTexture.gammaSpace = false;
    bumpTexture.anisotropicFilteringLevel = 4;
    material.bumpTexture = bumpTexture;
    material.diffuseColor = color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
    material.useVertexColor = true;
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    this.materials.set(cacheKey, material);
    return material;
  }
  materialFor(key, map, blend = null) {
    const cacheKey = blend ? `${key}|${blend.partners.map((partner) => partner.key).join('+')}` : key;
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
      const relief = this.reliefSetupFor(key, blend);
      if (relief) this.reliefPlugins.set(cacheKey, new TerrainReliefPlugin(material, relief));
      this.causticPlugins.push(new TerrainCausticPlugin(material));
      this.wetPlugins.push(new TerrainWetPlugin(material, cfg.wet === undefined ? 0.4 : cfg.wet));
      if (cfg.patch) {
        new TerrainGrassPlugin(material, {
          textures: this.groundGrassTextures(),
          tiles: GRASS_GROUND.tiles,
          state: this.groundPatch,
        });
      }
      if (blend) {
        this.blendPlugins.set(cacheKey, new TerrainBlendPlugin(material, this.blendSetupFor(blend)));
      }
      return material;
    }
    const plugin = this.blendPlugins.get(cacheKey);
    if (plugin && blend) plugin.setBlendSetup(this.blendSetupFor(blend));
    const reliefPlugin = this.reliefPlugins.get(cacheKey);
    if (reliefPlugin) reliefPlugin.setNeighbour(this.reliefNeighbourFor(blend));
    return material;
  }

  reliefSetupFor(key, blend) {
    const cfg = this.surfaceConfig(key);
    if (!cfg || !cfg.relief || !cfg.relief.map) return null;
    const relief = cfg.relief;
    return {
      primary: this.reliefMapFor(relief.map),
      detail: relief.detail ? this.reliefMapFor(relief.detail) : null,
      strength: relief.strength === undefined ? 1 : relief.strength,
      maskTile: relief.maskTile || 7,
      macro: relief.macro || 0,
      macroTile: relief.macroTile || 19,
      neighbour: this.reliefNeighbourFor(blend),
    };
  }

  reliefMapFor(map) {
    return {
      texture: this.reliefTexture(map.texture),
      tile: map.tile || 1,
      angle: map.angle || 0,
      mix: map.mix === undefined ? 1 : map.mix,
    };
  }

  reliefNeighbourFor(blend) {
    if (!blend || !blend.partners.length) return null;
    const cfg = this.surfaceConfig(blend.partners[0].key);
    if (!cfg || !cfg.relief || !cfg.relief.map) return null;
    const map = cfg.relief.map;
    return {
      texture: this.reliefTexture(map.texture),
      tile: map.tile || 1,
      angle: map.angle || 0,
      strength: cfg.relief.strength === undefined ? 1 : cfg.relief.strength,
    };
  }

  reliefTexture(url) {
    let texture = this.reliefTextures.get(url);
    if (!texture) {
      texture = new Texture(url, this.s);
      texture.wrapU = Texture.WRAP_ADDRESSMODE;
      texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.gammaSpace = false;
      texture.anisotropicFilteringLevel = 8;
      this.reliefTextures.set(url, texture);
    }
    return texture;
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

  groundGrassTextures() {
    if (this.grassGroundTex) return this.grassGroundTex;
    this.grassGroundTex = grassGroundUrls().map((url) => new Texture(url, this.s));
    return this.grassGroundTex;
  }

  grassShade(map) {
    const tone = (map && map.colors && map.colors.surfaceTint) || [0.5, 0.62, 0.45];
    return [
      tone[0] * 2 * SURFACE_VERTEX_TINT[0],
      tone[1] * 2 * SURFACE_VERTEX_TINT[1],
      tone[2] * 2 * SURFACE_VERTEX_TINT[2],
    ];
  }

  setGroundBlend(enabled) {
    this.groundPatch.patch = enabled ? 1 : 0;
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
    this.reliefPlugins.clear();
    this.causticPlugins.length = 0;
    this.wetPlugins.length = 0;
    for (const texture of this.reliefTextures.values()) {
      if (texture) texture.dispose();
    }
    this.reliefTextures.clear();
    for (const texture of this.blendTextures.values()) {
      if (texture) texture.dispose();
    }
    this.blendTextures.clear();
    if (this.grassGroundTex) {
      for (const texture of this.grassGroundTex) texture.dispose();
      this.grassGroundTex = null;
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
    lines.setEnabled(this.gridVisible);
    return lines;
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    if (this.gridLines && !this.gridLines.isDisposed()) this.gridLines.setEnabled(this.gridVisible);
    return this.gridVisible;
  }
}
