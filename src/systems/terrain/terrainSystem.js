// Terén krajiny — spojitá plocha podle druhu povrchu, bok mapy a neviditelná vrstva pro klikání.
// Výšku bere z výškového modelu, takže mezi buňkami nevznikají štěrbiny.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { createTerrainField } from '../../utils/terrainField.js';
import { getMap } from '../../data/catalogs/maps.js';
import { DEFAULT_FLOOR } from '../../data/catalogs/decorations.js';
import { groundCells, worldCells, planeLevels, levelOfEntry, columnsByCell } from '../../data/maps/areaShape.js';
import { buildColumnRuns } from '../../utils/terrainRuns.js';
import { buildCornerDebugMeshes, buildSolidBlockMesh } from './terrainDebug.js';
import { valueNoise } from '../../utils/noise.js';
import { SURFACE_SUB, SURFACE_CHUNK, WALL_TILE, SURFACE_VERTEX_TINT, pointId } from './terrainSettings.js';
import terrainMaterialsParts from './terrainMaterials.js';
import terrainBridgesParts from './terrainBridges.js';
import terrainCavesParts from './terrainCaves.js';
import terrainMassParts from './terrainMass.js';
import terrainPickingParts from './terrainPicking.js';

const RISE_SAMPLES = 8;
const CLIFF_LOW_GAP = 0.9;
const CLIFF_TOP_GAP = 0.25;
const SURFACE_BLEND_RADIUS = 1.8;
const SURFACE_BLEND_SLOTS = 3;
const SURFACE_BLEND_BLOCK_STEP = 1;
const SURFACE_BLEND_SHARED_MAX = 128;
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

function wallBetween(field, ax, az, bx, bz) {
  const sx = Math.sign(bx - ax);
  const sz = Math.sign(bz - az);
  if (sx && (field.isHardEdge(ax, az, sx, 0) || field.isHardEdge(bx, bz, -sx, 0))) return true;
  if (sz && (field.isHardEdge(ax, az, 0, sz) || field.isHardEdge(bx, bz, 0, -sz))) return true;
  return false;
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
    if (this.urlFlag('corners')) this.surfaces.push(...buildCornerDebugMeshes(this));
    this.createPicker(this.pickCells());
    this.gridLines = this.createGridLines(map, this.realCells);
    this.ready = Promise.resolve(this.surfaces);
    if (this.onRebuilt) this.onRebuilt();
    return this.surfaces;
  }

  cellsSignature(cells) {
    return cells.map(([cx, cz]) => `${cx},${cz}`).sort().join(';');
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
        roof.material = this.materialFor(key, map, blends.get(key), level < 0);
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
      mesh.material = this.materialFor(key, map, blends.get(key), level < 0);
      this.surfaces.push(mesh);
      this.surfaceChunks.push(mesh);
    }

    if (this.bridges.length) this.createBridges(map, blends);
    if (level === 0) this.shelfAnchors = [];
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
}

Object.assign(TerrainSystem.prototype, terrainMaterialsParts, terrainBridgesParts, terrainCavesParts, terrainMassParts, terrainPickingParts);
