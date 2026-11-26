// Kreslí travnatý porost na buňkách označených v mapě — trsy se houpou ve větru.
// Druh určuje poloha (písek, stromy, skvrny) nebo předvolba vybraná ve štětci.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE, worldToCell } from '../../utils/gridMath.js';
import { warnMissingWiring } from '../../utils/missingWiring.js';
import { cellNoise, patchValue } from '../../utils/decoPlacement.js';
import { valueNoise, smoothstep } from '../../utils/noise.js';
import { createGrassMaterial, tickGrass } from './grassShader.js';
import { GRASS_TYPES, GRASS_MIXES, GRASS_ORDER, GRASS_COVER, GRASS_CLUMP_SIZE, GRASS_EDGE, GRASS_GROUND, grassGroundUrl } from '../../data/catalogs/grass.js';

const GRASS_LIFT = 0.02;
const TREE_CLEARANCE = 0.35;
const CHUNK_CELLS = 8;
const CHUNK_WORLD = CELL_SIZE * CHUNK_CELLS;
const VIEW_MARGIN = 6;
const VIEW_HYSTERESIS = 4;
const SLOT_CAP = 500000;
const COVER_SEGMENTS = 2;
const COVER_BLADES = 4;
const COVER_WIDTH = 0.022;
const AUTO_WEIGHTS = { broadleaf: 3, cushion: 4, fern: 1 };

function isFree(deco, cx, cz) {
  if (deco.isBlocked(cx, cz) && !deco.isTreeCell(cx, cz)) return false;
  if (deco.surfaceKeyAt(cx, cz)) return false;
  return true;
}

function neighbourSurface(deco, cx, cz) {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) continue;
      if (deco.surfaceKeyAt(cx + dx, cz + dz)) return true;
    }
  }
  return false;
}

function neighbourCover(deco, cx, cz) {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) continue;
      if (deco.isTreeCell(cx + dx, cz + dz)) return true;
      if (deco.isBlocked(cx + dx, cz + dz)) return true;
    }
  }
  return false;
}

function coverShape(height) {
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  for (let blade = 0; blade < COVER_BLADES; blade += 1) {
    const angle = (blade / COVER_BLADES) * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const normalX = -dirZ;
    const normalZ = dirX;
    const offset = positions.length / 3;
    for (let s = 0; s <= COVER_SEGMENTS; s += 1) {
      const t = s / COVER_SEGMENTS;
      const half = COVER_WIDTH * 0.5 * (1 - Math.pow(t, 1.6) * 0.9);
      const baseX = dirX * 0.015;
      const baseZ = dirZ * 0.015;
      positions.push(
        baseX - dirX * half, height * t, baseZ - dirZ * half,
        baseX + dirX * half, height * t, baseZ + dirZ * half,
      );
      uvs.push(0, t, 1, t);
      normals.push(normalX, 0, normalZ, normalX, 0, normalZ);
      if (s > 0) {
        const a = offset + (s - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  return { positions, uvs, normals, indices, height };
}

function fitShape(shape, height) {
  const positions = shape.positions;
  const count = positions.length / 3;
  if (!count) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const span = maxY - minY;
  const scale = span > 0.0001 ? height / span : 1;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (positions[i * 3] - centerX) * scale;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - minY) * scale;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - centerZ) * scale;
  }
  return { positions, normals: shape.normals, uvs: shape.uvs, indices: shape.indices, height };
}

function extractShape(template, height) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (const mesh of template.getChildMeshes()) {
    if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
    const data = VertexData.ExtractFromMesh(mesh, true, true);
    if (!data || !data.positions) continue;
    const world = mesh.computeWorldMatrix(true);
    const normalMatrix = Matrix.Transpose(Matrix.Invert(world));
    const offset = positions.length / 3;
    const count = data.positions.length / 3;
    for (let i = 0; i < count; i += 1) {
      const point = Vector3.TransformCoordinates(
        new Vector3(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]),
        world,
      );
      positions.push(point.x, point.y, point.z);
      if (data.normals) {
        const normal = Vector3.TransformNormal(
          new Vector3(data.normals[i * 3], data.normals[i * 3 + 1], data.normals[i * 3 + 2]),
          normalMatrix,
        );
        if (normal.lengthSquared() > 0) normal.normalize();
        normals.push(normal.x, normal.y, normal.z);
      } else {
        normals.push(0, 1, 0);
      }
      uvs.push(data.uvs ? data.uvs[i * 2] : 0, data.uvs ? data.uvs[i * 2 + 1] : 0);
    }
    if (data.indices) {
      for (const index of data.indices) indices.push(index + offset);
    } else {
      for (let i = 0; i < count; i += 1) indices.push(offset + i);
    }
  }
  return fitShape({ positions, normals, uvs, indices }, height);
}

function templateTexture(template) {
  for (const mesh of template.getChildMeshes()) {
    const material = mesh.material;
    if (!material) continue;
    const texture = material.albedoTexture || material.diffuseTexture || material.baseTexture || null;
    if (texture) return texture;
  }
  return null;
}

export default class FloraSystem {

  constructor(scene) {
    this.s = scene;
    this.deco = null;
    this.density = 'high';
    this.models = null;
    this.assets = new Map();
    this.paintedCells = new Set();
    this.grass = null;
    this.hidden = false;
    this.chunks = [];
    this.grassMeshes = [];
    this.viewProvider = null;
    this.observer = null;
    this.groundTex = null;
    this.shade = [1, 1, 1];
    this.clock = 0;
    this.lastTime = performance.now();
    this.dayness = 1;
    this.sunDirection = new Vector3(0.35, 1, 0.25).normalize();
  }

  create(deco, density = 'high', viewProvider = null, models = null, look = null) {
    this.dispose();
    this.deco = deco;
    this.density = density;
    this.viewProvider = viewProvider;
    this.models = models && models.length ? models : null;
    const shade = look && look.shade ? look.shade : null;
    this.shade = shade && shade.length === 3 ? shade : [1, 1, 1];
    this.build();
  }

  build() {
    if (!this.deco) return;
    this.buildGrass();
  }

  setHidden(hidden) {
    this.hidden = hidden === true;
    if (this.grass && !this.grass.isDisposed()) this.grass.setEnabled(!this.hidden);
  }

  dispose() {
    this.s.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
    this.disposeGrass();
  }

  disposeGrass() {
    if (this.grass && !this.grass.isDisposed()) this.grass.dispose(false, false);
    this.grass = null;
    for (const chunk of this.chunks) {
      for (const part of chunk.parts) {
        if (part.mesh && !part.mesh.isDisposed()) part.mesh.dispose(false, false);
        part.mesh = null;
      }
    }
    this.chunks.length = 0;
    this.grassMeshes.length = 0;
    for (const asset of this.assets.values()) {
      for (const variant of asset.variants) {
        if (variant.material) variant.material.dispose(false, false);
      }
    }
    this.assets.clear();
  }

  setDayness(value) {
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    if (v === this.dayness) return;
    this.dayness = v;
  }

  setSunDirection(direction) {
    if (!direction) return;
    this.sunDirection.copyFrom(direction);
    if (this.sunDirection.lengthSquared() > 0) this.sunDirection.normalize();
  }

  buildGrass() {
    if (!this.deco || this.density === 'off') return [];
    if (this.grassMeshes.length) return this.grassMeshes.slice();
    this.buildAssets();
    if (!this.assets.size) return [];
    const cells = this.patchCells();
    if (!cells.length) return [];
    const slots = this.makeClumps(cells);
    if (!slots.length) return [];
    this.lastTime = performance.now();
    this.grass = new TransformNode('grassPatches', this.s);
    this.grass.setEnabled(!this.hidden);
    this.buildChunks(slots, 'cell');
    this.animate();
    return this.grassMeshes.slice();
  }

  buildAssets() {
    this.buildCover();
    if (!this.models) return;
    for (const entry of this.models) {
      const type = GRASS_TYPES[entry.species];
      if (!type || !entry.template) continue;
      const texture = templateTexture(entry.template);
      if (!texture) continue;
      const shape = extractShape(entry.template, type.height);
      if (!shape) continue;
      const material = createGrassMaterial(this.s, {
        name: `grassMat_${entry.species}`,
        height: shape.height,
        tint: this.scaledTint(type.tint, type.gain || 1),
        texture,
        lightDir: this.sunDirection,
      });
      let asset = this.assets.get(entry.species);
      if (!asset) {
        asset = { variants: [] };
        this.assets.set(entry.species, asset);
      }
      asset.variants.push({ shape, material });
    }
  }

  buildCover() {
    if (!GRASS_COVER.perCell[this.density]) return;
    const material = createGrassMaterial(this.s, {
      name: 'grassMatCover',
      height: GRASS_COVER.height,
      tint: this.scaledTint(GRASS_COVER.tint.map((value) => value * GRASS_GROUND.shade)),
      texture: this.groundTexture(),
      lightDir: this.sunDirection,
      groundTile: GRASS_GROUND.tile,
    });
    this.assets.set('cover', { variants: [{ shape: coverShape(GRASS_COVER.height), material }] });
  }

  groundTexture() {
    if (!this.groundTex) this.groundTex = new Texture(grassGroundUrl(), this.s);
    return this.groundTex;
  }

  scaledTint(base, gain = 1) {
    const tint = base || [1, 1, 1];
    const shade = this.shade || [1, 1, 1];
    const scale = GRASS_GROUND.gain * gain;
    return [tint[0] * shade[0] * scale, tint[1] * shade[1] * scale, tint[2] * shade[2] * scale];
  }

  patchCells() {
    const layout = this.deco.layout;
    if (!layout) return [];
    const cells = [];
    for (const entry of layout.grass || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      cells.push({ cx: entry.cx, cz: entry.cz, mix: entry.mix || 'auto', layer: entry.layer || 'both' });
    }
    return cells;
  }

  pickWeighted(weights, cx, cz) {
    const keys = Object.keys(weights);
    let total = 0;
    for (const key of keys) total += weights[key];
    if (!total) return keys[0] || null;
    const value = patchValue(cx, cz) * total;
    let sum = 0;
    for (const key of keys) {
      sum += weights[key];
      if (value <= sum) return key;
    }
    return keys[keys.length - 1];
  }

  resolveSpecies(name) {
    if (this.assets.has(name)) return name;
    for (const key of GRASS_ORDER) {
      if (this.assets.has(key)) return key;
    }
    return null;
  }

  speciesAt(cell) {
    const mix = GRASS_MIXES[cell.mix] ? cell.mix : 'auto';
    const weights = GRASS_MIXES[mix].weights;
    if (weights) return this.resolveSpecies(this.pickWeighted(weights, cell.cx, cell.cz));
    if (neighbourSurface(this.deco, cell.cx, cell.cz)) return this.resolveSpecies('coastal');
    if (neighbourCover(this.deco, cell.cx, cell.cz)) return this.resolveSpecies('fern');
    return this.resolveSpecies(this.pickWeighted(AUTO_WEIGHTS, cell.cx, cell.cz));
  }

  makeClumps(cells) {
    const slots = [];
    const cover = this.assets.get('cover');
    this.paintedCells = new Set(cells.map((cell) => `${cell.cx},${cell.cz}`));
    for (const cell of cells) {
      if (slots.length >= SLOT_CAP) break;
      if (!isFree(this.deco, cell.cx, cell.cz)) continue;
      if (cover && cell.layer !== 'plants') this.addCoverSlots(slots, cell);
      if (cell.layer === 'cover') continue;
      const species = this.speciesAt(cell);
      if (!species) continue;
      const type = GRASS_TYPES[species];
      const count = type.perCell[this.density] || type.perCell.high || 1;
      const variants = this.assets.get(species).variants.length;
      const side = Math.max(1, Math.ceil(Math.sqrt(count)));
      const step = CELL_SIZE / side;
      for (let index = 0; index < count; index += 1) {
        if (slots.length >= SLOT_CAP) break;
        const slot = this.makeSlot(cell, index, side, step, species, variants);
        if (slot) slots.push(slot);
      }
      this.addSpill(slots, cell, Math.round(count * GRASS_EDGE.spill), (x, z, index) => this.slotAt(
        x,
        z,
        species,
        Math.min(variants - 1, Math.floor(cellNoise(cell.cx, cell.cz * 13 + index, 97) * variants)),
        0.45 + cellNoise(cell.cx + index, cell.cz, 101) * 0.3,
        cellNoise(cell.cx, cell.cz + index, 103) * Math.PI * 2,
        cellNoise(cell.cx + index, cell.cz + index, 107),
      ));
    }
    return slots;
  }

  painted(cx, cz) {
    return this.paintedCells.has(`${cx},${cz}`);
  }

  openSides(cell) {
    if (!cell.open) {
      const open = (dx, dz) => !this.painted(cell.cx + dx, cell.cz + dz);
      cell.open = {
        left: open(-1, 0), right: open(1, 0), near: open(0, -1), far: open(0, 1),
        leftNear: open(-1, -1), rightNear: open(1, -1), leftFar: open(-1, 1), rightFar: open(1, 1),
      };
      cell.open.any = Object.values(cell.open).some(Boolean);
    }
    return cell.open;
  }

  edgeShare(x, z, cell) {
    const open = this.openSides(cell);
    if (!open.any) return 1;
    const half = CELL_SIZE * 0.5;
    const left = x - (cell.cx * CELL_SIZE - half);
    const right = cell.cx * CELL_SIZE + half - x;
    const near = z - (cell.cz * CELL_SIZE - half);
    const far = cell.cz * CELL_SIZE + half - z;
    let gap = Infinity;
    if (open.left) gap = Math.min(gap, left);
    if (open.right) gap = Math.min(gap, right);
    if (open.near) gap = Math.min(gap, near);
    if (open.far) gap = Math.min(gap, far);
    if (open.leftNear) gap = Math.min(gap, Math.hypot(left, near));
    if (open.rightNear) gap = Math.min(gap, Math.hypot(right, near));
    if (open.leftFar) gap = Math.min(gap, Math.hypot(left, far));
    if (open.rightFar) gap = Math.min(gap, Math.hypot(right, far));
    const band = GRASS_EDGE.band * (0.35 + 1.1 * valueNoise(x / GRASS_EDGE.bandNoise, z / GRASS_EDGE.bandNoise));
    return smoothstep(0, band, gap);
  }

  edgeSlot(x, z, cell, salt, make) {
    const share = this.edgeShare(x, z, cell);
    if (cellNoise(Math.round(x * 50), Math.round(z * 50), salt) > share) return null;
    return make(0.55 + 0.45 * share);
  }

  addSpill(slots, cell, count, make) {
    const open = this.openSides(cell);
    const sides = [[-1, 0, open.left], [1, 0, open.right], [0, -1, open.near], [0, 1, open.far]].filter((side) => side[2]);
    if (!sides.length || count <= 0) return;
    for (let index = 0; index < count; index += 1) {
      if (slots.length >= SLOT_CAP) return;
      const [dx, dz] = sides[Math.floor(cellNoise(cell.cx * 7 + index, cell.cz, 109) * sides.length)];
      const along = (cellNoise(cell.cx, cell.cz * 11 + index, 113) - 0.5) * CELL_SIZE;
      const depth = Math.pow(cellNoise(cell.cx + index * 3, cell.cz, 127), 2) * GRASS_EDGE.spillDepth;
      const edge = CELL_SIZE * 0.5 + depth;
      const x = cell.cx * CELL_SIZE + (dx ? dx * edge : along);
      const z = cell.cz * CELL_SIZE + (dz ? dz * edge : along);
      if (valueNoise(x / GRASS_EDGE.bandNoise + 5.3, z / GRASS_EDGE.bandNoise - 2.1) < 0.45) continue;
      const slot = make(x, z, index);
      if (slot) slots.push(slot);
    }
  }

  addCoverSlots(slots, cell) {
    const count = GRASS_COVER.perCell[this.density] || 0;
    const side = Math.max(1, Math.ceil(Math.sqrt(count)));
    const step = CELL_SIZE / side;
    for (let index = 0; index < count; index += 1) {
      if (slots.length >= SLOT_CAP) return;
      const column = index % side;
      const row = Math.floor(index / side);
      const jitterX = (cellNoise(cell.cx * 131 + index, cell.cz, 11) - 0.5) * step * 0.95;
      const jitterZ = (cellNoise(cell.cx, cell.cz * 137 + index, 13) - 0.5) * step * 0.95;
      const x = cell.cx * CELL_SIZE - CELL_SIZE * 0.5 + (column + 0.5) * step + jitterX;
      const z = cell.cz * CELL_SIZE - CELL_SIZE * 0.5 + (row + 0.5) * step + jitterZ;
      const slot = this.edgeSlot(x, z, cell, 137, (shrink) => this.slotAt(
        x,
        z,
        'cover',
        0,
        (0.8 + cellNoise(cell.cx + index, cell.cz * 7 + index, 79) * 0.5) * shrink,
        cellNoise(cell.cx * 3 + index, cell.cz, 83) * Math.PI * 2,
        cellNoise(cell.cx, cell.cz + index * 5, 89),
      ));
      if (slot) slots.push(slot);
    }
    this.addSpill(slots, cell, Math.round(count * GRASS_EDGE.spill), (x, z, index) => this.slotAt(
      x,
      z,
      'cover',
      0,
      0.5 + cellNoise(cell.cx + index, cell.cz * 7, 139) * 0.3,
      cellNoise(cell.cx * 3 + index, cell.cz, 149) * Math.PI * 2,
      cellNoise(cell.cx, cell.cz + index * 5, 151),
    ));
  }

  makeSlot(cell, index, side, step, species, variants) {
    const column = index % side;
    const row = Math.floor(index / side);
    const jitterX = (cellNoise(cell.cx * 31 + index, cell.cz, 3) - 0.5) * step * 0.9;
    const jitterZ = (cellNoise(cell.cx, cell.cz * 37 + index, 7) - 0.5) * step * 0.9;
    const x = cell.cx * CELL_SIZE - CELL_SIZE * 0.5 + (column + 0.5) * step + jitterX;
    const z = cell.cz * CELL_SIZE - CELL_SIZE * 0.5 + (row + 0.5) * step + jitterZ;
    const variant = Math.min(variants - 1, Math.floor(cellNoise(cell.cx, cell.cz * 13 + index, 61) * variants));
    return this.slotAt(
      x,
      z,
      species,
      variant,
      GRASS_CLUMP_SIZE.min + (GRASS_CLUMP_SIZE.max - GRASS_CLUMP_SIZE.min) * Math.pow(cellNoise(cell.cx + index, cell.cz, 67), GRASS_CLUMP_SIZE.skew),
      cellNoise(cell.cx, cell.cz + index, 71) * Math.PI * 2,
      cellNoise(cell.cx + index, cell.cz + index, 73),
    );
  }

  slotAt(x, z, species, variant, size, yaw, lean) {
    const gx = worldToCell(x);
    const gz = worldToCell(z);
    if (!isFree(this.deco, gx, gz)) return null;
    if (this.deco.isTreeCell(gx, gz)) {
      const dx = x - gx * CELL_SIZE;
      const dz = z - gz * CELL_SIZE;
      if (dx * dx + dz * dz < TREE_CLEARANCE * TREE_CLEARANCE) return null;
    }
    const ground = this.groundUnder(x, z, gx, gz);
    return { x, z, y: ground + GRASS_LIFT, species, variant, size, yaw, lean };
  }

  groundUnder(x, z, cx, cz) {
    if (this.deco.groundHeightAt) return this.deco.groundHeightAt(x, z);
    warnMissingWiring('tráva: výška země');
    return this.deco.topAt(cx, cz);
  }

  buildChunks(slots, prefix) {
    const chunks = new Map();
    for (const slot of slots) {
      const gx = Math.floor(slot.x / CHUNK_WORLD);
      const gz = Math.floor(slot.z / CHUNK_WORLD);
      const chunkKey = `${prefix}_${gx},${gz}`;
      let chunk = chunks.get(chunkKey);
      if (!chunk) {
        chunk = {
          key: chunkKey,
          minX: gx * CHUNK_WORLD,
          minZ: gz * CHUNK_WORLD,
          parts: [],
          partMap: new Map(),
          enabled: false,
        };
        chunks.set(chunkKey, chunk);
      }
      const partKey = `${slot.species}_${slot.variant}`;
      let part = chunk.partMap.get(partKey);
      if (!part) {
        part = { species: slot.species, variant: slot.variant, slots: [], mesh: null };
        chunk.partMap.set(partKey, part);
        chunk.parts.push(part);
      }
      part.slots.push(slot);
    }
    for (const chunk of chunks.values()) {
      chunk.partMap = null;
      for (const part of chunk.parts) this.createPartMesh(chunk, part);
      this.chunks.push(chunk);
    }
  }

  createPartMesh(chunk, part) {
    const asset = this.assets.get(part.species);
    if (!asset) return;
    const variant = asset.variants[part.variant] || asset.variants[0];
    const mesh = new Mesh(`wildGrass_${chunk.key}_${part.species}_${part.variant}`, this.s);
    const data = new VertexData();
    data.positions = variant.shape.positions;
    data.uvs = variant.shape.uvs;
    data.normals = variant.shape.normals;
    data.indices = variant.shape.indices;
    data.applyToMesh(mesh);
    mesh.material = variant.material;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    mesh.parent = this.grass;
    part.mesh = mesh;
    this.writePart(part);
    this.grassMeshes.push(mesh);
  }

  writePart(part) {
    if (!part.mesh) return;
    const total = part.slots.length;
    const matrices = new Float32Array(total * 16);
    for (let i = 0; i < total; i += 1) this.clumpMatrix(part.slots[i]).copyToArray(matrices, i * 16);
    part.mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
  }

  updateView(view) {
    if (!view || !this.chunks.length) return;
    const inner = view.radius + VIEW_MARGIN;
    const outer = inner + VIEW_HYSTERESIS;
    for (const chunk of this.chunks) {
      const dx = Math.max(chunk.minX - view.x, 0, view.x - (chunk.minX + CHUNK_WORLD));
      const dz = Math.max(chunk.minZ - view.z, 0, view.z - (chunk.minZ + CHUNK_WORLD));
      const distance = Math.hypot(dx, dz);
      if (chunk.enabled) {
        if (distance <= outer) continue;
        chunk.enabled = false;
        for (const part of chunk.parts) if (part.mesh) part.mesh.setEnabled(false);
        continue;
      }
      if (distance > inner) continue;
      chunk.enabled = true;
      for (const part of chunk.parts) if (part.mesh) part.mesh.setEnabled(true);
    }
  }

  reseatHeights() {
    if (!this.deco || !this.chunks.length) return;
    for (const chunk of this.chunks) {
      for (const part of chunk.parts) {
        for (const slot of part.slots) {
          const ground = this.groundUnder(slot.x, slot.z, worldToCell(slot.x), worldToCell(slot.z));
          slot.y = ground + GRASS_LIFT;
        }
        this.writePart(part);
      }
    }
  }

  clumpMatrix(slot) {
    const size = slot.size || 1;
    const yaw = slot.yaw || 0;
    const lean = (slot.lean || 0) * 0.22;
    const tilt = Quaternion.RotationAxis(new Vector3(Math.cos(yaw), 0, Math.sin(yaw)), lean);
    const turn = Quaternion.RotationAxis(Vector3.Up(), yaw);
    return Matrix.Compose(
      new Vector3(size, size, size),
      tilt.multiply(turn),
      new Vector3(slot.x, slot.y ?? GRASS_LIFT, slot.z),
    );
  }

  addGrassSpots(spots) {
    if (!this.deco || !this.assets.size || !this.grass || !spots || !spots.length) return;
    const slots = [];
    for (const spot of spots) {
      const species = this.resolveSpecies(spot.species);
      if (!species) continue;
      const variants = this.assets.get(species).variants.length;
      slots.push({
        x: spot.x,
        z: spot.z,
        y: spot.y + GRASS_LIFT,
        species,
        variant: Math.min(variants - 1, Math.floor(cellNoise(spot.x, spot.z, 31) * variants)),
        size: spot.size,
        yaw: spot.yaw ?? cellNoise(spot.x, spot.z, 51) * Math.PI * 2,
        lean: spot.lean ?? 0,
      });
    }
    if (slots.length) this.buildChunks(slots, 'spots');
  }

  addShelfGrass(anchors) {
    if (!this.deco || !this.assets.size || !this.grass || !anchors || !anchors.length) return;
    const species = this.assets.has('cushion') ? 'cushion' : this.resolveSpecies('fern');
    if (!species) return;
    const variants = this.assets.get(species).variants.length;
    const slots = [];
    for (const anchor of anchors) {
      if (!anchor || (anchor.depth || 0) < 0.12) continue;
      if (cellNoise(anchor.x, anchor.z, 3.7) > 0.45) continue;
      const count = 2 + Math.floor(cellNoise(anchor.x, anchor.z, 5.1) * 3);
      for (let index = 0; index < count; index += 1) {
        const spread = (cellNoise(anchor.x, anchor.z, index + 11) - 0.5) * 0.9;
        const inset = cellNoise(anchor.x, anchor.z, index + 21) * anchor.depth * 0.8;
        const x = anchor.x - anchor.dirX * inset - anchor.dirZ * spread;
        const z = anchor.z - anchor.dirZ * inset + anchor.dirX * spread;
        slots.push({
          x,
          z,
          y: anchor.y + GRASS_LIFT,
          species,
          variant: Math.min(variants - 1, Math.floor(cellNoise(anchor.x, anchor.z, index + 31) * variants)),
          size: 0.8 + cellNoise(anchor.x, anchor.z, index + 41) * 0.4,
          yaw: cellNoise(anchor.x, anchor.z, index + 51) * Math.PI * 2,
          lean: (cellNoise(anchor.x, anchor.z, index + 61) - 0.5) * 0.6,
        });
      }
    }
    if (slots.length) this.buildChunks(slots, 'shelf');
  }

  animate() {
    if (this.observer) return;
    this.observer = this.s.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      this.clock += Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      if (this.viewProvider) this.updateView(this.viewProvider());
      for (const asset of this.assets.values()) {
        for (const variant of asset.variants) {
          const material = variant.material;
          if (!material) continue;
          tickGrass(material, this.clock);
          material.setFloat('dayness', this.dayness);
          material.setVector3('lightDir', this.sunDirection);
        }
      }
    });
  }
}
