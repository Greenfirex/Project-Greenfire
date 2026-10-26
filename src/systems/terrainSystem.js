// Terén krajiny — spojitá plocha podle druhu povrchu, bok mapy a neviditelná vrstva pro klikání.
// Výšku bere z výškového modelu, takže mezi buňkami nevznikají štěrbiny.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE } from '../utils/gridMath.js';
import { createTerrainField } from '../utils/terrainField.js';
import { getMap } from '../data/catalogs/maps.js';
import { getDecoration, DEFAULT_FLOOR } from '../data/catalogs/decorations.js';
import { groundCells, worldCells, floorCellAt } from '../data/maps/areaShape.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const PICK_LIFT = 0.002;
const GRID_LIFT = 0.02;
const GRID_SUB = 2;
const SURFACE_SUB = 4;
const SKIRT_DEPTH = 2;
const WALL_TILE = 3;
const WALL_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const SURFACE_WAVE = 0.28;
const SURFACE_WAVE_LONG = 1.1;
const SURFACE_WAVE_SHORT = 2.7;
const SURFACE_SIDES = [
  { dx: -1, dz: 0 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
  { dx: 0, dz: 1 },
];

function hash01(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function wavePhase(line) {
  return hash01(Math.round(line * 2), 7) * Math.PI * 2;
}

function waveOffset(t, line) {
  const phase = wavePhase(line);
  return (
    Math.sin(t * SURFACE_WAVE_LONG + phase) * 0.65
    + Math.sin(t * SURFACE_WAVE_SHORT + phase * 1.7) * 0.35
  ) * SURFACE_WAVE;
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
    this.skirtMaterial = null;
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

    const tint = new Color3(0.72, 0.7, 0.64);
    const step = CELL_SIZE / SURFACE_SUB;
    const half = CELL_SIZE / 2;
    const groups = new Map();
    const keys = new Map();
    for (const [cx, cz] of cells) {
      const floor = floorCellAt(this.layout, cx, cz);
      keys.set(`${cx},${cz}`, floor && floor.key ? floor.key : DEFAULT_FLOOR);
    }
    const keyAt = (cx, cz) => keys.get(`${cx},${cz}`) || null;
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
    const slot = (group, x, z, px = x, pz = z) => {
      const id = `${x},${z}`;
      const found = group.vertices.get(id);
      if (found !== undefined) return found;
      const index = group.positions.length / 3;
      group.vertices.set(id, index);
      group.positions.push(px, this.heightAt(px, pz), pz);
      group.uvs.push(px / group.tile, pz / group.tile);
      group.colors.push(tint.r, tint.g, tint.b, 1);
      return index;
    };

    const waves = new Map();
    const waveAt = (gx, gz) => {
      const id = `${Math.round(gx * 2)},${Math.round(gz * 2)}`;
      let entry = waves.get(id);
      if (!entry) {
        entry = { x: 0, z: 0 };
        waves.set(id, entry);
      }
      return entry;
    };
    for (const [cx, cz] of cells) {
      const key = keyAt(cx, cz);
      if (!this.surfaceConfig(key)) continue;
      const x0 = cx * CELL_SIZE - half;
      const z0 = cz * CELL_SIZE - half;
      for (const side of SURFACE_SIDES) {
        const otherKey = keyAt(cx + side.dx, cz + side.dz);
        if (!otherKey || otherKey === key) continue;
        if (side.dx !== 0) {
          const edgeX = cx * CELL_SIZE + side.dx * half;
          for (let j = 0; j <= SURFACE_SUB; j += 1) {
            const gz = z0 + j * step;
            waveAt(edgeX, gz).x = waveOffset(gz, edgeX);
          }
        } else {
          const edgeZ = cz * CELL_SIZE + side.dz * half;
          for (let i = 0; i <= SURFACE_SUB; i += 1) {
            const gx = x0 + i * step;
            waveAt(gx, edgeZ).z = waveOffset(gx, edgeZ);
          }
        }
      }
    }

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
          const wave = waves.get(`${Math.round(gx * 2)},${Math.round(gz * 2)}`);
          row.push(slot(group, gx, gz, gx + (wave ? wave.x : 0), gz + (wave ? wave.z : 0)));
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

    for (const [key, group] of groups) {
      if (!group.positions.length) continue;
      const mesh = new Mesh(key === DEFAULT_FLOOR ? 'terrainSurface' : `terrainSurface_${key}`, this.s);
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
      mesh.material = this.materialFor(key, map);
      this.surfaces.push(mesh);
    }
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

  surfaceConfig(key) {
    const def = getDecoration(key);
    if (def && def.surface && def.surface.texture) return def.surface;
    const fallback = getDecoration(DEFAULT_FLOOR);
    return fallback && fallback.surface && fallback.surface.texture ? fallback.surface : null;
  }

  materialFor(key, map) {
    const cached = this.materials.get(key);
    if (cached) return cached;
    const cfg = this.surfaceConfig(key);
    const material = new StandardMaterial(`terrainSurfaceMat_${key}`, this.s);
    material.diffuseTexture = new Texture(cfg.texture, this.s);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
    material.useVertexColor = true;
    material.diffuseColor = color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
    this.materials.set(key, material);
    return material;
  }

  disposeMaterials() {
    for (const material of this.materials.values()) {
      if (material) material.dispose(false, true);
    }
    this.materials.clear();
    if (this.skirtMaterial) {
      this.skirtMaterial.dispose(false, true);
      this.skirtMaterial = null;
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
