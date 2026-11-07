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
import { buildBridge, deckHeightAt, bridgeSpan, bridgeCellOf, sampleBank, BRIDGE_BURIAL, BRIDGE_RISE, BRIDGE_CLEARANCE } from '../../utils/bridgeShape.js';
import { createTerrainField } from '../../utils/terrainField.js';
import { getMap } from '../../data/catalogs/maps.js';
import { getDecoration, DEFAULT_FLOOR } from '../../data/catalogs/decorations.js';
import { groundCells, worldCells, planeLevels, levelOfEntry, columnsByCell, layerLiftAt, floorCellAt } from '../../data/maps/areaShape.js';
import { buildColumnRuns } from '../../utils/terrainRuns.js';
import { buildCornerEdges } from '../../utils/terrainCorners.js';
import { buildRunBlocks } from './runBlocks.js';
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
const CLIFF_CORNER_TUCK = CELL_SIZE / SURFACE_SUB;
const CLIFF_TOP_OVERLAP = 0.05;
const CLIFF_SKIRT_SINK = 0.15;
const CORNER_FILL_STEPS = 3;
const BRIDGE_CORNER_MARGIN = 0.6;
const CORNER_DEBUG_LIFT = 0.06;
const CORNER_DEBUG_WIDTH = 0.03;
const CORNER_DEBUG_COLORS = {
  corner: [1, 0.16, 0.08],
  inner: [0.2, 0.5, 1],
  diagonal: [1, 0.85, 0.1],
};
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
const CLIFF_BULGE = [
  [0.00, 0.00],
  [0.05, 0.30],
  [0.20, 0.24],
  [0.45, -0.16],
  [0.62, -0.10],
  [0.80, -0.22],
  [0.94, -0.08],
  [1.00, 0.00],
];
const CLIFF_BULGE_LOW = 0.8;
const CLIFF_BULGE_HIGH = 3.5;
const CLIFF_BULGE_MIN = 0.22;
const CLIFF_BULGE_MAX = 1.5;
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

function cliffTaperIndex(value) {
  const line = Math.round((value - CELL_SIZE / 2) / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
  const steps = Math.round(Math.abs(value - line) / (CELL_SIZE / SURFACE_SUB));
  return Math.min(SURFACE_SUB, Math.max(0, steps));
}

function cliffTaperAtPosition(gx, gz) {
  return cliffCornerTaper(Math.max(cliffTaperIndex(gx), cliffTaperIndex(gz)));
}

function cellIndicesAt(value) {
  const low = Math.ceil((value - CELL_SIZE / 2) / CELL_SIZE - 1e-6);
  const high = Math.floor((value + CELL_SIZE / 2) / CELL_SIZE + 1e-6);
  const list = [];
  for (let index = low; index <= high; index += 1) list.push(index);
  return list;
}

function cliffRimBevel(t) {
  if (t <= 0.72 || t >= 1.0) return 0;
  return smoothstep(0.72, 0.9, t) * (1 - smoothstep(0.96, 1.0, t));
}

function cliffBulge(t) {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < CLIFF_BULGE.length - 1; i += 1) {
    const [t0, w0] = CLIFF_BULGE[i];
    const [t1, w1] = CLIFF_BULGE[i + 1];
    if (clamped > t1) continue;
    const span = Math.max(1e-6, t1 - t0);
    return w0 + (w1 - w0) * smoothstep(0, 1, (clamped - t0) / span);
  }
  return CLIFF_BULGE[CLIFF_BULGE.length - 1][1];
}

function cliffBulgeScale(height) {
  const ramp = smoothstep(CLIFF_BULGE_LOW, CLIFF_BULGE_HIGH, height);
  return CLIFF_BULGE_MIN + (CLIFF_BULGE_MAX - CLIFF_BULGE_MIN) * ramp;
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
    this.cliffSkin = false;
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
    this.bridgeWallColumns = new Map();
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
    this.bridgeWallColumns = new Map();
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
    this.cliffSkin = this.urlFlag('cliffs');
    this.resetSurfaces();
    if (this.solidDebugEnabled()) {
      const blocks = buildRunBlocks(world, { cellSize: CELL_SIZE, tile: WALL_TILE });
      if (blocks) this.surfaces.push(this.blockMesh(blocks));
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
    if (this.urlFlag('corners')) this.createCornerDebug();
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

  cliffCornerInfo(gx, gz, field = this.field) {
    const half = CELL_SIZE / 2;
    const cells = [];
    for (const sx of [-half, half]) {
      for (const sz of [-half, half]) {
        const ax = Math.round((gx + sx) / CELL_SIZE);
        const az = Math.round((gz + sz) / CELL_SIZE);
        cells.push({ cx: ax, cz: az, h: field.heightAtCell(ax, az) });
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

  cliffCornerPost(pushes, point, edge, field = this.field) {
    if (cliffDirection(pushes, point).corner <= 0.3) return false;
    if (this.bridgeCornerAt(point.gx, point.gz)) return false;
    const info = this.cliffCornerInfo(point.gx, point.gz, field);
    if (!info || !info.convex) return false;
    const here = field.heightAtCell(edge.cx, edge.cz);
    const there = field.heightAtCell(edge.nx, edge.nz);
    const highCell = here >= there ? `${edge.cx},${edge.cz}` : `${edge.nx},${edge.nz}`;
    return info.pull.has(highCell);
  }

  createSurface(map, cells, level = 0) {
    const suffix = level === 0 ? '' : `_L${level}`;
    const shelfAnchors = [];
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
    const cliffSkin = this.cliffSkin;
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
    const wallEdges = [];
    const cliffCells = cliffSkin ? cells : [];
    for (const [cx, cz] of cliffCells) {
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

    const cornerPeaks = new Map();
    for (const edge of wallEdges) {
      for (const point of [edge.points[0], edge.points[SURFACE_SUB]]) {
        const id = pointId(point.gx, point.gz);
        let entry = cornerPeaks.get(id);
        if (!entry) {
          const info = this.cliffCornerInfo(point.gx, point.gz);
          entry = { peak: info && info.convex ? [...info.pull][0] : null, count: 0 };
          cornerPeaks.set(id, entry);
        }
        if (!entry.peak) continue;
        if (Math.abs(heightOf(point, edge.cx, edge.cz) - heightOf(point, edge.nx, edge.nz)) <= 0.02) continue;
        const here = field.heightAtCell(edge.cx, edge.cz);
        const there = field.heightAtCell(edge.nx, edge.nz);
        const highCell = here >= there ? `${edge.cx},${edge.cz}` : `${edge.nx},${edge.nz}`;
        if (highCell === entry.peak) entry.count += 1;
      }
    }
    const bevelPeaks = new Map();
    for (const [id, entry] of cornerPeaks) {
      if (entry.peak && entry.count === 2) bevelPeaks.set(id, entry.peak);
    }
    const tuckSquares = new Map();
    for (const edge of wallEdges) {
      const highCell = field.heightAtCell(edge.cx, edge.cz) >= field.heightAtCell(edge.nx, edge.nz)
        ? [edge.cx, edge.cz] : [edge.nx, edge.nz];
      const highKey = `${highCell[0]},${highCell[1]}`;
      const height = field.heightAtCell(highCell[0], highCell[1]);
      for (const [point, nearPoint] of [[edge.points[0], edge.points[1]], [edge.points[SURFACE_SUB], edge.points[SURFACE_SUB - 1]]]) {
        const peak = bevelPeaks.get(pointId(point.gx, point.gz));
        if (peak === undefined || peak === highKey) continue;
        const alongX = point.gx !== nearPoint.gx;
        const stepX = alongX ? Math.sign(point.gx - nearPoint.gx) : 0;
        const stepZ = alongX ? 0 : Math.sign(point.gz - nearPoint.gz);
        const inwardX = alongX ? 0 : Math.sign(highCell[0] * CELL_SIZE - point.gx);
        const inwardZ = alongX ? Math.sign(highCell[1] * CELL_SIZE - point.gz) : 0;
        const squareX = point.gx + Math.min(0, (stepX || inwardX) * step);
        const squareZ = point.gz + Math.min(0, (stepZ || inwardZ) * step);
        const squareKey = `${squareX},${squareZ}`;
        const seen = tuckSquares.get(squareKey);
        if (seen && seen.height >= height) continue;
        tuckSquares.set(squareKey, {
          cx: highCell[0],
          cz: highCell[1],
          cornerX: point.gx,
          cornerZ: point.gz,
          stepX,
          stepZ,
          inwardX,
          inwardZ,
          height,
        });
      }
    }
    const cornerTucks = [...tuckSquares.values()];

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
      const group = groupFor(keyAt(ownerCell[0], ownerCell[1]) || DEFAULT_FLOOR, ownerCell[0], ownerCell[1]);
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

    for (const tuck of cornerTucks) {
      const key = keyAt(tuck.cx, tuck.cz);
      if (!this.surfaceConfig(key)) continue;
      const group = groupFor(key, tuck.cx, tuck.cz);
      const weldOwner = `${tuck.cx},${tuck.cz}`;
      const freeOwner = `tuck:${tuck.cx},${tuck.cz}:${tuck.cornerX},${tuck.cornerZ}`;
      const spanX = (tuck.stepX || tuck.inwardX) * step;
      const spanZ = (tuck.stepZ || tuck.inwardZ) * step;
      const xMin = Math.min(tuck.cornerX, tuck.cornerX + spanX);
      const xMax = Math.max(tuck.cornerX, tuck.cornerX + spanX);
      const zMin = Math.min(tuck.cornerZ, tuck.cornerZ + spanZ);
      const zMax = Math.max(tuck.cornerZ, tuck.cornerZ + spanZ);
      const grid = [];
      for (let i = 0; i <= 1; i += 1) {
        const x = i === 0 ? xMin : xMax;
        const row = [];
        for (let j = 0; j <= 1; j += 1) {
          const z = j === 0 ? zMin : zMax;
          const weld = tuck.stepX !== 0 ? x === tuck.cornerX : z === tuck.cornerZ;
          const y = field.heightAtSide(x, z, tuck.cx, tuck.cz);
          row.push(slot(group, x, z, x, z, y, weld ? weldOwner : freeOwner));
        }
        grid.push(row);
      }
      group.indices.push(grid[0][0], grid[1][0], grid[1][1], grid[0][0], grid[1][1], grid[0][1]);
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

    if (wallEdges.length) {
      const shelves = new Map();
      this.createCliffMesh(wallEdges, positionOf, heightOf, weldedAt, bevelPeaks, (edge) => {
        const lower = field.heightAtCell(edge.cx, edge.cz);
        const higher = field.heightAtCell(edge.nx, edge.nz);
        const key = higher >= lower ? keyAt(edge.nx, edge.nz) : keyAt(edge.cx, edge.cz);
        const color = this.surfaceColor(key, map);
        return { key, color: [color.r * 0.50, color.g * 0.66, color.b * 0.40] };
      }, shelves, field, suffix, shelfAnchors);
      this.createShelfMeshes(shelves, map, blends, suffix);
    }
    if (this.bridges.length) this.createBridges(map, blends);
    if (level === 0) this.shelfAnchors = shelfAnchors;
  }

  mouthAt(edge) {
    const mouths = this.mouths;
    if (!mouths || !mouths.size) return null;
    const dx = Math.sign(edge.nx - edge.cx);
    const dz = Math.sign(edge.nz - edge.cz);
    return mouths.get(`${edge.cx},${edge.cz}|${dx},${dz}`) || mouths.get(`${edge.nx},${edge.nz}|${-dx},${-dz}`) || null;
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

  createCornerDebug() {
    const edges = buildCornerEdges(this.layout || {}, {
      runs: this.solidRuns(),
      hardEdge: (cx, cz, dx, dz) => this.hardEdgeAt(cx, cz, dx, dz),
    });
    const groups = new Map();
    for (const edge of edges) {
      if (edge.kind === 'seam') continue;
      let group = groups.get(edge.kind);
      if (!group) {
        group = { positions: [], indices: [] };
        groups.set(edge.kind, group);
      }
      const px = edge.gx + edge.outX * CORNER_DEBUG_LIFT;
      const pz = edge.gz + edge.outZ * CORNER_DEBUG_LIFT;
      this.appendCornerRibbon(group, px, pz, edge.y0, edge.y1);
    }
    for (const [kind, group] of groups) {
      if (!group.positions.length) continue;
      const mesh = new Mesh(`terrainCornerDebug_${kind}`, this.s);
      const data = new VertexData();
      data.positions = group.positions;
      data.indices = group.indices;
      data.normals = [];
      VertexData.ComputeNormals(group.positions, group.indices, data.normals);
      data.applyToMesh(mesh);
      mesh.material = this.cornerDebugMaterial(kind);
      mesh.isPickable = false;
      mesh.receiveShadows = false;
      mesh.metadata = { cornerDebug: true, kind };
      this.surfaces.push(mesh);
    }
  }

  appendCornerRibbon(group, px, pz, y0, y1) {
    const width = CORNER_DEBUG_WIDTH;
    const start = group.positions.length / 3;
    group.positions.push(
      px, y0, pz - width, px, y1, pz - width, px, y1, pz + width, px, y0, pz + width,
      px - width, y0, pz, px + width, y0, pz, px + width, y1, pz, px - width, y1, pz,
    );
    group.indices.push(
      start, start + 1, start + 2, start, start + 2, start + 3,
      start + 4, start + 5, start + 6, start + 4, start + 6, start + 7,
    );
  }

  cornerDebugMaterial(kind) {
    const cacheKey = `cornerDebug|${kind}`;
    const cached = this.materials.get(cacheKey);
    if (cached) return cached;
    const rgb = CORNER_DEBUG_COLORS[kind] || [1, 1, 1];
    const material = new StandardMaterial(`terrainCornerDebugMat_${kind}`, this.s);
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.diffuseColor = new Color3(rgb[0], rgb[1], rgb[2]);
    material.emissiveColor = new Color3(rgb[0], rgb[1], rgb[2]);
    this.materials.set(cacheKey, material);
    return material;
  }

  blockMesh(blocks) {
    const mesh = new Mesh('terrainRunBlocks', this.s);
    const data = new VertexData();
    data.positions = blocks.positions;
    data.indices = blocks.indices;
    data.uvs = blocks.uvs;
    data.colors = blocks.colors;
    data.normals = [];
    VertexData.ComputeNormals(blocks.positions, blocks.indices, data.normals);
    data.applyToMesh(mesh);
    mesh.setVerticesData('mossMask', new Float32Array(blocks.positions.length / 3), false, 1);
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.material = this.cliffMaterialFor('stone');
    return mesh;
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

  createCliffMesh(edges, positionOf, heightOf, weldedAt, bevelPeaks, rimColorOf, shelves, field = this.field, suffix = '', shelfAnchors = this.shelfAnchors) {
    const groups = new Map();
    for (const edge of edges) {
      const style = this.cliffStyleOf(edge, field);
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
    for (const [style, list] of groups) this.buildCliffFaces(list, positionOf, heightOf, weldedAt, style, rimColorOf, pushes, shelves, cornerPosts, bevelPeaks, field, suffix, shelfAnchors);
    this.buildCornerBevels(cornerPosts, suffix);
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
  createShelfMeshes(shelves, map, blends, suffix = '') {
    for (const [key, group] of shelves) {
      if (!group.positions.length) continue;
      const mesh = new Mesh(`terrainShelf_${key}${suffix}`, this.s);
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

  cliffStyleOf(edge, field = this.field) {
    if (!field || !field.cliffStyleAt) return 'dirt';
    return field.cliffStyleAt(edge.cx, edge.cz) || field.cliffStyleAt(edge.nx, edge.nz) || 'dirt';
  }

  buildCornerBevels(cornerPosts, suffix = '') {
    const byStyle = new Map();
    for (const posts of cornerPosts.values()) {
      if (posts.length < 2) continue;
      const style = posts[0].style || 'dirt';
      if (!byStyle.has(style)) byStyle.set(style, []);
      const sorted = [...posts].sort((a, b) => Math.atan2(a.outZ, a.outX) - Math.atan2(b.outZ, b.outX));
      const pairs = [];
      const sameHeight = (a, b) => Math.abs(a.top - b.top) <= 0.2;
      for (let i = 0; i < sorted.length - 1; i += 1) {
        if (sameHeight(sorted[i], sorted[i + 1])) pairs.push([sorted[i], sorted[i + 1]]);
      }
      if (sorted.length > 2 && sameHeight(sorted[sorted.length - 1], sorted[0])) {
        pairs.push([sorted[sorted.length - 1], sorted[0]]);
      }
      byStyle.get(style).push(...pairs);
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
      const mesh = new Mesh(`terrainCliffs_corner${suffix}`, this.s);
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

  buildCliffFaces(edges, positionOf, heightOf, weldedAt, style, rimColorOf, pushes, shelves, cornerPosts, bevelPeaks, field = this.field, suffix = '', shelfAnchors = this.shelfAnchors) {
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
    const profiles = new Map();
    const profileFor = (point, offsetX, offsetZ, tone, rim, edge) => {
      const id = pointId(point.gx, point.gz);
      const h1 = heightOf(point, edge.cx, edge.cz);
      const h2 = heightOf(point, edge.nx, edge.nz);
      const w1 = weldedAt(id, edge.cx, edge.cz);
      const w2 = weldedAt(id, edge.nx, edge.nz);
      const top = Math.max(w1 === null ? h1 : w1, w2 === null ? h2 : w2) + CLIFF_TOP_OVERLAP;
      let crest = Math.max(w1 === null ? h1 : w1, w2 === null ? h2 : w2);
      let foot = Math.min(h1, h2);
      for (const cx of cellIndicesAt(point.gx)) {
        for (const cz of cellIndicesAt(point.gz)) {
          const weldedValue = weldedAt(id, cx, cz);
          if (weldedValue === null) continue;
          if (weldedValue > crest) crest = weldedValue;
          const raw = heightOf(point, cx, cz);
          if (raw < foot) foot = raw;
        }
      }
      const mouth = this.mouthAt(edge);
      const bottom = foot - CLIFF_SKIRT_SINK;
      const cut = mouth && mouth.top > bottom && mouth.top < crest ? mouth.top : null;
      const shapeSpan = crest + CLIFF_TOP_OVERLAP - bottom;
      const key = `${id}|${Math.round(offsetX * 1000)},${Math.round(offsetZ * 1000)}|${top.toFixed(3)},${bottom.toFixed(3)}|${cut === null ? '' : cut.toFixed(3)}`;
      const cached = profiles.get(key);
      if (cached) return cached;
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
      const pos = positionOf(point);
      const span = top - bottom;
      const dir = cliffDirection(pushes, point);
      const reliefSpan = Math.min(1, shapeSpan / CLIFF_RELIEF_SPAN);
      const bulgeScale = cliffBulgeScale(shapeSpan);
      const ledgeFactor = Math.min(1, Math.max(0, (shapeSpan - CLIFF_LEDGE_MIN) / CLIFF_LEDGE_RAMP));
      const ledgeStep = Math.min(CLIFF_LEDGE_STEP, shapeSpan * CLIFF_LEDGE_RATIO) * ledgeFactor;
      const ledge2Factor = Math.min(1, Math.max(0, (shapeSpan - CLIFF_LEDGE2_MIN) / CLIFF_LEDGE2_RAMP));
      const ledge2Step = Math.min(CLIFF_LEDGE2_STEP, shapeSpan * CLIFF_LEDGE2_RATIO) * ledge2Factor;
      const ledgeT = cliffLedgeT(point);
      const mask = cliffLedgeMask(point);
      const ledgeT2 = cliffLedgeT2(point);
      const mask2 = cliffLedgeMask2(point);
      const taper = 1 - dir.corner * (1 - cliffTaperAtPosition(point.gx, point.gz));
      const profile = {
        gx: point.gx,
        gz: point.gz,
        top,
        bottom,
        outX: -dir.x,
        outZ: -dir.z,
        rows: [],
      };
      for (let r = 0; r < CLIFF_ROWS_LEDGE.length; r += 1) {
        const row = CLIFF_ROWS_LEDGE[r];
        const t = row.ledge ? (row.pair === 2 ? ledgeT2 : ledgeT) : row.t;
        const y = bottom + span * t;
        const clear = this.bridgeClearAt(point.gx, point.gz, y);
        const step = (r <= CLIFF_LEDGE_INDEX ? ledgeStep * mask : 0) + (r <= CLIFF_LEDGE2_INDEX ? ledge2Step * mask2 : 0);
        const protrude = step * Math.min(1, row.w / CLIFF_LEDGE_TAPER) * clear;
        const depth = cliffDepth(point, t, row.w);
        const bend = reliefSpan * CLIFF_RELIEF * depth + protrude + bulgeScale * cliffBulge(t) * clear;
        const shift = taper * Math.max(-CLIFF_INWARD_MAX, bend - CLIFF_RIM_BEVEL * cliffRimBevel(t));
        profile.rows.push({
          x: pos.px + offsetX + dir.x * shift,
          y,
          z: pos.pz + offsetZ + dir.z * shift,
          protrude,
          tint: shadeAt(y, top, bottom, point.gx, point.gz, tone, depth, rim),
        });
      }
      if (offsetX || offsetZ) profile.rows[profile.rows.length - 1].y -= CLIFF_CORNER_TUCK;
      if (cut !== null) {
        let upper = profile.rows.length - 1;
        for (let r = 0; r < profile.rows.length; r += 1) {
          if (profile.rows[r].y >= cut) {
            upper = r;
            break;
          }
        }
        if (upper > 0) {
          const under = profile.rows[upper - 1];
          const over = profile.rows[upper];
          const gap = over.y - under.y;
          const t = gap < 1e-6 ? 0 : Math.min(1, Math.max(0, (cut - under.y) / gap));
          const edgeX = under.x + (over.x - under.x) * t;
          const edgeZ = under.z + (over.z - under.z) * t;
          const edgeTint = {
            r: under.tint.r + (over.tint.r - under.tint.r) * t,
            g: under.tint.g + (over.tint.g - under.tint.g) * t,
            b: under.tint.b + (over.tint.b - under.tint.b) * t,
            moss: under.tint.moss + (over.tint.moss - under.tint.moss) * t,
          };
          for (let r = 0; r < upper; r += 1) {
            const row = profile.rows[r];
            row.x = edgeX;
            row.z = edgeZ;
            row.y = cut;
            row.tint = edgeTint;
            row.protrude = 0;
          }
        }
        profile.bottom = cut;
      }
      profiles.set(key, profile);
      return profile;
    };
    for (const edge of edges) {
      const points = edge.points;
      const rimInfo = rimColorOf(edge);
      const rim = rimInfo.color;
      const shelfKey = rimInfo.key;
      const tone = 0.9 + (Math.abs(edge.cx * 7 + edge.cz * 13) % 5) * 0.02;
      const here = field.heightAtCell(edge.cx, edge.cz);
      const there = field.heightAtCell(edge.nx, edge.nz);
      const edgeHigh = here >= there ? `${edge.cx},${edge.cz}` : `${edge.nx},${edge.nz}`;
      const startPeak = bevelPeaks.get(pointId(points[0].gx, points[0].gz));
      const endPeak = bevelPeaks.get(pointId(points[SURFACE_SUB].gx, points[SURFACE_SUB].gz));
      const startTuck = startPeak !== undefined && startPeak !== edgeHigh;
      const endTuck = endPeak !== undefined && endPeak !== edgeHigh;
      const tuckStartX = Math.sign(points[0].gx - points[1].gx);
      const tuckStartZ = Math.sign(points[0].gz - points[1].gz);
      const tuckEndX = Math.sign(points[SURFACE_SUB].gx - points[SURFACE_SUB - 1].gx);
      const tuckEndZ = Math.sign(points[SURFACE_SUB].gz - points[SURFACE_SUB - 1].gz);
      const startCorner = this.cliffCornerPost(pushes, points[0], edge, field);
      const endCorner = this.cliffCornerPost(pushes, points[SURFACE_SUB], edge, field);
      for (let i = 0; i < SURFACE_SUB; i += 1) {
        if ((i === 0 && startCorner) || (i === SURFACE_SUB - 1 && endCorner)) continue;
        const a = points[i];
        const b = points[i + 1];
        const a1 = heightOf(a, edge.cx, edge.cz);
        const a2 = heightOf(a, edge.nx, edge.nz);
        const b1 = heightOf(b, edge.cx, edge.cz);
        const b2 = heightOf(b, edge.nx, edge.nz);
        if (Math.abs(a1 - a2) < 0.02 && Math.abs(b1 - b2) < 0.02) continue;
        const aTuck = startTuck && i === 0;
        const bTuck = endTuck && i === SURFACE_SUB - 1;
        const profileA = profileFor(a, aTuck ? tuckStartX * CLIFF_CORNER_TUCK : 0, aTuck ? tuckStartZ * CLIFF_CORNER_TUCK : 0, tone, rim, edge);
        const profileB = profileFor(b, bTuck ? tuckEndX * CLIFF_CORNER_TUCK : 0, bTuck ? tuckEndZ * CLIFF_CORNER_TUCK : 0, tone, rim, edge);
        if (!profileA || !profileB) continue;
        const postKey = startCorner && i === 1 ? pointId(points[0].gx, points[0].gz)
          : endCorner && i === SURFACE_SUB - 2 ? pointId(points[SURFACE_SUB].gx, points[SURFACE_SUB].gz) : null;
        const postUsesA = startCorner && i === 1;
        const rise = (a1 - a2) || (b1 - b2);
        const windX = rise > 0 ? edge.nx - edge.cx : edge.cx - edge.nx;
        const windZ = rise > 0 ? edge.nz - edge.cz : edge.cz - edge.nz;
        const rows = CLIFF_ROWS_LEDGE;
        const dx = b.gx - a.gx;
        const dz = b.gz - a.gz;
        const flip = -dz * windX + dx * windZ < 0;
        if (postKey) {
          const postProfile = postUsesA ? profileA : profileB;
          const cornerPost = {
            rows: postProfile.rows,
            outX: postProfile.outX,
            outZ: postProfile.outZ,
            top: postProfile.top,
            bottom: postProfile.bottom,
            cornerX: postUsesA ? points[0].gx : points[SURFACE_SUB].gx,
            cornerZ: postUsesA ? points[0].gz : points[SURFACE_SUB].gz,
            tone,
            rim,
            style,
          };
          const list = cornerPosts.get(postKey);
          if (list) {
            if (!list.some((post) => post.rows === cornerPost.rows)) list.push(cornerPost);
          } else {
            cornerPosts.set(postKey, [cornerPost]);
          }
        }
        for (let r = 0; r < rows.length - 1; r += 1) {
          const upper = rows[r];
          const lower = rows[r + 1];
          const a0 = profileA.rows[r];
          const a1r = profileA.rows[r + 1];
          const b0 = profileB.rows[r];
          const b1r = profileB.rows[r + 1];
          const ax0 = a0.x;
          const ay0 = a0.y;
          const az0 = a0.z;
          const ax1 = a1r.x;
          const ay1 = a1r.y;
          const az1 = a1r.z;
          const bx0 = b0.x;
          const by0 = b0.y;
          const bz0 = b0.z;
          const bx1 = b1r.x;
          const by1 = b1r.y;
          const bz1 = b1r.z;
          this.recordBridgeWall(a, ay0, ax0, az0, r);
          this.recordBridgeWall(a, ay1, ax1, az1, r + 1);
          this.recordBridgeWall(b, by0, bx0, bz0, r);
          this.recordBridgeWall(b, by1, bx1, bz1, r + 1);
          if (upper.ledge && lower.ledge && a0.protrude + b0.protrude > 0.008) {
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
              shelfAnchors.push({
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
          const aHigh = a0.tint;
          const aLow = a1r.tint;
          const bHigh = b0.tint;
          const bLow = b1r.tint;
          colors.push(
            aHigh.r, aHigh.g, aHigh.b, 1,
            aLow.r, aLow.g, aLow.b, 1,
            bHigh.r, bHigh.g, bHigh.b, 1,
            bLow.r, bLow.g, bLow.b, 1,
          );
          masks.push(aHigh.moss, aLow.moss, bHigh.moss, bLow.moss);
          const aU = (a.gx + a.gz) / WALL_TILE;
          const bU = (b.gx + b.gz) / WALL_TILE;
          uvs.push(
            aU, ay0 / WALL_TILE,
            aU, ay1 / WALL_TILE,
            bU, by0 / WALL_TILE,
            bU, by1 / WALL_TILE,
          );
          if (flip) indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
          else indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
        }
      }
    }
    if (!positions.length) return;
    const mesh = new Mesh(`terrainCliffs_${style}${suffix}`, this.s);
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
