// Stavba dekoraci krajiny z dat mapy - dlazdice pudy, cesty, stromy, skaly.
// Drzi jen postavene meshe a blokovane bunky; rozvrzeni si bere z data mapy.
import '@babylonjs/core/Meshes/transformNode';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/mesh';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, worldToCellCoords, cellKey, indexToCellCoords, CELL_SIZE } from '../utils/gridMath.js';
import { getDecoration, decoHeight } from '../data/catalogs/decorations.js';
import { deriveBlocked } from '../data/maps/layoutStore.js';
import { resolveModel, instantiateModel, ownMaterials, whenModelsIdle } from '../utils/assetLoader.js';
import { treeTemplate, treeStumpTemplate, treeLogTemplate, treeFrondTemplate } from '../utils/treeFactory.js';
import { rockTemplate } from '../utils/rockFactory.js';
import { shellTemplate } from '../utils/shellFactory.js';
import { coralTemplate } from '../utils/coralFactory.js';
import { tintTemplate, forgetTints } from '../utils/decoTint.js';
import PathSystem from './pathSystem.js';

const PATH_SURFACE = 0.02;
const FLAT_SINK = 0.015;

function liesFlat(def) {
  return Boolean(def && def.shell);
}

function cellNoise(cx, cz, salt) {
  const n = Math.sin(cx * 127.1 + cz * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function treeJitter(entry) {
  return {
    yaw: (cellNoise(entry.cx, entry.cz, 3) - 0.5) * 0.87,
    x: (cellNoise(entry.cx, entry.cz, 7) - 0.5) * 0.4,
    z: (cellNoise(entry.cx, entry.cz, 11) - 0.5) * 0.4,
    scale: 0.9 + cellNoise(entry.cx, entry.cz, 17) * 0.2,
  };
}

function rockJitter(entry) {
  return {
    yaw: cellNoise(entry.cx, entry.cz, 29) * Math.PI * 2,
    x: 0,
    z: 0,
    scale: 0.85 + cellNoise(entry.cx, entry.cz, 31) * 0.3,
  };
}

function jitterFor(def, entry) {
  if (def.kind === 'tree') return treeJitter(entry);
  if (def.rock || def.shell || def.coral) return rockJitter(entry);
  return null;
}

function cellGap(shape, x, z) {
  if (shape.footprint) {
    const t = shape.turn || 0;
    const edge = CELL_SIZE / 2;
    const along = t % 2 === 0 ? Math.abs(x) : Math.abs(z);
    const across = t % 2 === 0 ? Math.abs(z) : Math.abs(x);
    if (shape.footprint.kind === 'corner') return Math.max(along, across) - edge;
    const depth = edge * shape.footprint.depth;
    return Math.max(Math.max(along, across) - edge, across - (edge - depth));
  }
  const limit = shape.radius || CELL_SIZE / 2;
  return Math.hypot(x, z) - limit;
}

export default class DecoSystem {

  constructor(scene) {
    this.s = scene;
    this.blocked = new Map();
    this.treeCells = new Set();
    this.columnTop = new Map();
    this.surfaceKeys = new Map();
    this.floorLifts = new Map();
    this.onDecoReady = null;
    this.onDecoBroken = null;
    this.colors = null;
    this.groundHeightAt = null;
    this.nodes = [];
    this.anchors = [];
    this.pathNodes = [];
    this.pendingPieces = [];
    this.brokenCount = 0;
    this.pathSystem = new PathSystem(scene);
  }

  create(layout, colors) {
    this.dispose();
    forgetTints();
    this.blocked.clear();
    this.columnTop.clear();
    this.surfaceKeys.clear();
    this.floorLifts.clear();
    this.brokenCount = 0;
    this.colors = colors || null;
    this.applyLayout(layout);
  }

  applyLayout(layout) {
    this.layout = layout;
    this.createAll(layout);
    this.refreshBlocked(layout);
  }

  createAll(layout) {
    for (const entry of layout.floor || []) this.place(entry);
    this.buildPath();
    for (const entry of layout.clearing || []) this.place(entry);
    for (const entry of layout.decorations || []) this.place(entry);
  }

  beginStages(layout, colors) {
    this.dispose();
    forgetTints();
    this.blocked.clear();
    this.columnTop.clear();
    this.surfaceKeys.clear();
    this.floorLifts.clear();
    this.brokenCount = 0;
    this.colors = colors || null;
    this.layout = layout;
  }

  hasModel(key) {
    const def = getDecoration(key);
    return !!def && !!(def.model || def.tree || def.rock || def.shell || def.coral);
  }

  blockCount(entry) {
    const def = getDecoration(entry.key);
    if (!def) return 0;
    return 1;
  }

  placePiece(entry, section) {
    const bucket = section === 'path' ? this.pathNodes : this.nodes;
    return this.place(entry, bucket, section);
  }

  async settle() {
    await whenModelsIdle().catch(() => null);
    for (;;) {
      const rest = this.pendingPieces.filter(Boolean);
      this.pendingPieces.length = 0;
      if (!rest.length) return;
      await Promise.all(rest.map((work) => work.catch(() => null)));
    }
  }

  finishStages() {
    this.buildPath();
    this.refreshBlocked(this.layout || {});
  }

  buildPath() {
    this.pathSystem.buildFromLayout(this.layout, this.groundHeightAt);
    this.claimPathCells();
  }

  claimPathCells() {
    for (const [key, cell] of this.pathSystem.shapes) {
      this.surfaceKeys.set(key, 'path');
      const current = this.columnTop.get(key);
      const surface = cell.y + PATH_SURFACE;
      if (!current) this.columnTop.set(key, { block: 0, surface });
      else current.surface = Math.max(current.surface, surface);
    }
  }

  refreshBlocked(layout) {
    this.blocked.clear();
    this.treeCells.clear();
    const entries = [].concat(
      layout.floor || [],
      layout.path || [],
      layout.clearing || [],
      layout.decorations || [],
    );
    for (const entry of layout.decorations || []) {
      if (!entry) continue;
      const def = getDecoration(entry.key);
      if (def && def.kind === 'tree') this.treeCells.add(cellKey(entry.cx, entry.cz));
    }
    for (const shape of deriveBlocked(entries)) this.addBlockedShape(shape);
    for (const cell of layout.blocked || []) this.addBlockedShape(cell);
  }

  addBlockedShape(cell) {
    const key = cellKey(cell.cx, cell.cz);
    const list = this.blocked.get(key);
    const shape = {
      cx: cell.cx,
      cz: cell.cz,
      radius: cell.radius || 0,
      footprint: cell.footprint || null,
      turn: cell.turn || 0,
      offsetX: cell.offsetX || 0,
      offsetZ: cell.offsetZ || 0,
    };
    if (list) list.push(shape);
    else this.blocked.set(key, [shape]);
  }

  updatePath(layout) {
    this.layout = layout;
    this.buildPath();
    this.refreshBlocked(layout);
  }

  applyEntry(entry, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def) return;

    const top = this.entryHeight(entry) + decoHeight(def);
    const key = cellKey(entry.cx, entry.cz);
    const solid = def.blocks !== false;
    if (section !== 'deco') this.floorLifts.set(key, entry.liftY || 0);
    if (section === 'path') this.surfaceKeys.set(key, entry.key);
    const current = this.columnTop.get(key);
    if (!current) {
      this.columnTop.set(key, solid ? { block: top, surface: 0 } : { block: 0, surface: top });
      return;
    }
    if (solid) current.block = Math.max(current.block, top);
    else current.surface = Math.max(current.surface, top);
  }

  entryHeight(entry, extraX = 0, extraZ = 0) {
    const base = entry.liftY || 0;
    if (!this.groundHeightAt) return base;
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const local = this.groundHeightAt(x + (entry.offsetX || 0) + extraX, z + (entry.offsetZ || 0) + extraZ);
    const center = this.groundHeightAt(x, z);
    return base + (local - center);
  }

  place(entry, bucket = this.nodes, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def) return null;

    this.applyEntry(entry, section);
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const anchor = this.createAnchor(entry, def, x, z, bucket);
    if (!def.model && !def.tree && !def.rock && !def.shell && !def.coral) return anchor;
    const work = this.attachModel(anchor, def, entry, section);
    this.pendingPieces.push(work);
    return work;
  }

  topAt(cx, cz) {
    const cell = this.columnTop.get(cellKey(cx, cz));
    if (cell) return Math.max(cell.block, cell.surface);
    return this.surfaceAt(cx, cz);
  }

  surfaceAt(cx, cz) {
    const key = cellKey(cx, cz);
    const { x, z } = cellToWorldCoords(cx, cz);
    const ground = this.groundHeightAt ? this.groundHeightAt(x, z) : this.floorTopAt(key);
    const cell = this.columnTop.get(key);
    if (cell) return Math.max(cell.surface, ground);
    return ground;
  }

  floorTopAt(key) {
    const lift = this.floorLifts.get(key);
    return lift || 0;
  }

  surfaceKeyAt(cx, cz) {
    return this.surfaceKeys.get(cellKey(cx, cz)) || null;
  }

  nearBlocked(cx, cz, radius) {
    const reach = Math.ceil(radius);
    for (let dx = -reach; dx <= reach; dx += 1) {
      for (let dz = -reach; dz <= reach; dz += 1) {
        if (!this.isBlocked(cx + dx, cz + dz)) continue;
        if (Math.hypot(dx, dz) <= radius) return true;
      }
    }
    return false;
  }

  fieldDistance(cx, cz) {
    const bounds = this.boundsOfCells();
    if (!bounds) return 0;
    return Math.min(cx - bounds.minX, bounds.maxX - cx, cz - bounds.minZ, bounds.maxZ - cz);
  }

  boundsOfCells() {
    if (!this.layout) return null;
    const entries = [].concat(
      this.layout.floor || [],
      this.layout.path || [],
      this.layout.clearing || [],
      this.layout.decorations || [],
    );
    if (!entries.length) return null;
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const entry of entries) {
      box.minX = Math.min(box.minX, entry.cx);
      box.maxX = Math.max(box.maxX, entry.cx);
      box.minZ = Math.min(box.minZ, entry.cz);
      box.maxZ = Math.max(box.maxZ, entry.cz);
    }
    return box;
  }

  createAnchor(entry, def, x, z, bucket = this.nodes) {
    const jitter = jitterFor(def, entry);
    const shiftX = jitter ? jitter.x : 0;
    const shiftZ = jitter ? jitter.z : 0;
    const spotX = x + (entry.offsetX || 0) + shiftX;
    const spotZ = z + (entry.offsetZ || 0) + shiftZ;
    const spotY = this.entryHeight(entry, shiftX, shiftZ);
    const yaw = (Math.PI / 2) * (entry.rotation || 0) + (jitter ? jitter.yaw : 0);
    const anchor = new TransformNode(`deco_${entry.key}_${entry.cx}_${entry.cz}`, this.s);
    anchor.position = new Vector3(spotX, spotY, spotZ);
    anchor.metadata = { key: entry.key, def, bucket, entry, yaw };
    if (liesFlat(def)) this.leanFlat(anchor, def, spotX, spotY, spotZ);
    else anchor.rotation.y = yaw;
    bucket.push(anchor);
    this.anchors.push(anchor);
    return anchor;
  }

  leanFlat(anchor, def, x, y, z) {
    if (!this.groundHeightAt) return;
    const reach = Math.max(0.12, def.radius || 0.2);
    const slopeX = (this.groundHeightAt(x + reach, z) - this.groundHeightAt(x - reach, z)) / (2 * reach);
    const slopeZ = (this.groundHeightAt(x, z + reach) - this.groundHeightAt(x, z - reach)) / (2 * reach);
    const normal = new Vector3(-slopeX, 1, -slopeZ).normalize();
    const tilt = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), normal, tilt);
    anchor.rotationQuaternion = tilt;
    anchor.position.y = y - FLAT_SINK;
  }

  blocksPlaced() {
    let total = this.surfaceKeys.size;
    for (const node of this.nodes) total += 1;
    return total;
  }

  placedCount() {
    let total = 0;
    for (const node of this.anchors) {
      if (node && !node.isDisposed() && node.metadata?.model) total += 1;
    }
    return total;
  }

  dispose() {
    for (const anchor of this.anchors.slice()) this.disposeAnchor(anchor);
    this.anchors.length = 0;
    this.nodes.length = 0;
    this.pathNodes.length = 0;
    this.pendingPieces.length = 0;
  }

  disposeAnchor(node) {
    if (!node || node.isDisposed()) return;
    const bucket = node.metadata?.bucket;
    const index = bucket ? bucket.indexOf(node) : -1;
    if (index >= 0) bucket.splice(index, 1);
    const own = this.anchors.indexOf(node);
    if (own >= 0) this.anchors.splice(own, 1);
    node.dispose(false, false);
  }

  async attachModel(anchor, def, entry, section) {
    try {
      await this.attachModelNow(anchor, def, entry, section);
    } catch (error) {
      console.warn('[deco] Model se nepodaĹ™ilo pĹ™ipojit:', def.model || def.tree, error);
      if (!anchor.isDisposed() && !anchor.metadata?.broken) this.markBroken(anchor, def);
    }
  }

  async attachModelNow(anchor, def, entry, section) {
    let template = null;
    if (def.tree) template = treeTemplate(this.s, def.tree);
    else if (def.rock) template = rockTemplate(this.s, def.rock);
    else if (def.shell) template = shellTemplate(this.s, def.shell);
    else if (def.coral) template = coralTemplate(this.s, def.coral);
    else template = await resolveModel(this.s, def.model);
    if (anchor.isDisposed()) return;
    if (!template) return this.markBroken(anchor, def);

    const node = instantiateModel(this.s, template, `decoModel_${entry.key}_${entry.cx}_${entry.cz}`);
    if (!node) return this.markBroken(anchor, def);
    node.parent = anchor;
    node.position = new Vector3(0, 0, 0);
    const jitter = jitterFor(def, entry);
    const entryScale = Number.isFinite(entry.scale) ? entry.scale : 1;
    const scale = def.scale * entryScale * (jitter ? jitter.scale : 1);
    node.scaling = new Vector3(scale, scale, scale);
    if (liesFlat(def) && anchor.metadata) node.rotation.y = anchor.metadata.yaw || 0;
    if (!def.noTint) ownMaterials(node);
    tintTemplate(node, def, this.colors, section);
    anchor.metadata.model = node;
    if (this.onDecoReady) this.onDecoReady(anchor, node, def, entry);
  }

  readyEntries() {
    const out = [];
    for (const node of this.nodes) {
      if (!node || node.isDisposed() || !node.metadata?.model) continue;
      out.push(node);
    }
    return out;
  }

  entryAt(cx, cz) {
    const anchor = this.nodes.find((node) => {
      if (!node || node.isDisposed() || !node.metadata?.def?.gather) return false;
      return worldToCellCoords(node.position.x, node.position.z).cx === cx
        && worldToCellCoords(node.position.x, node.position.z).cz === cz;
    });
    return anchor ? { anchor, def: anchor.metadata.def, entry: anchor.metadata.entry } : null;
  }

  showStump(anchor, def) {
    if (!anchor || anchor.isDisposed() || !def || !def.tree) return [];
    const model = anchor.metadata?.model;
    if (model && !model.isDisposed()) model.setEnabled(false);
    anchor.rotation.x = 0;
    anchor.rotation.z = 0;
    const old = anchor.metadata?.stump;
    if (old && !old.isDisposed()) return [];
    const template = treeStumpTemplate(this.s, def.tree);
    if (!template) return [];
    const stump = instantiateModel(this.s, template, `stump_${anchor.name}`);
    if (!stump) return [];
    stump.parent = anchor;
    stump.position = new Vector3(0, 0, 0);
    stump.scaling = new Vector3(1, 1, 1);
    anchor.metadata = { ...(anchor.metadata || {}), stump };
    return [stump];
  }

  showLogs(anchor, def, dirX, dirZ) {
    if (!anchor || anchor.isDisposed() || !def || !def.tree) return [];
    const template = treeLogTemplate(this.s, def.tree);
    if (!template) return [];
    const yaw = anchor.rotation.y;
    const cos = Math.cos(-yaw);
    const sin = Math.sin(-yaw);
    const localX = dirX * cos - dirZ * sin;
    const localZ = dirX * sin + dirZ * cos;
    const heading = Math.atan2(localZ, localX);
    const nodes = [];
    for (let i = 0; i < 2; i += 1) {
      const node = instantiateModel(this.s, template, `log_${anchor.name}_${i}`);
      if (!node) continue;
      node.parent = anchor;
      node.scaling = new Vector3(1, 1, 1);
      const spread = i === 0 ? 0.4 : -0.45;
      const reach = 0.95 + i * 0.5;
      node.position = new Vector3(
        localX * reach - localZ * spread,
        0.02,
        localZ * reach + localX * spread,
      );
      node.rotation.y = heading + (i === 0 ? 0.16 : -0.22);
      nodes.push(node);
    }
    return nodes;
  }

  showFronds(anchor, def, dirX, dirZ) {
    if (!anchor || anchor.isDisposed() || !def || !def.tree) return [];
    const template = treeFrondTemplate(this.s, def.tree);
    if (!template) return [];
    const entry = anchor.metadata ? anchor.metadata.entry : null;
    const cx = entry ? entry.cx : 0;
    const cz = entry ? entry.cz : 0;
    const yaw = anchor.rotation.y;
    const cos = Math.cos(-yaw);
    const sin = Math.sin(-yaw);
    const localX = dirX * cos - dirZ * sin;
    const localZ = dirX * sin + dirZ * cos;
    const baseAngle = Math.atan2(localZ, localX);
    const count = 3 + Math.floor(cellNoise(cx, cz, 23) * 3);
    const nodes = [];
    for (let i = 0; i < count; i += 1) {
      const node = instantiateModel(this.s, template, `frond_${anchor.name}_${i}`);
      if (!node) continue;
      node.parent = anchor;
      const phi = baseAngle + (cellNoise(cx, cz, 31 + i) - 0.5) * 2.2;
      const reach = 0.45 + cellNoise(cx, cz, 41 + i) * 1.25;
      node.position = new Vector3(Math.cos(phi) * reach, 0.03, Math.sin(phi) * reach);
      node.rotation.y = -phi + (cellNoise(cx, cz, 51 + i) - 0.5) * 0.7;
      const scale = 1.6 + cellNoise(cx, cz, 61 + i) * 0.8;
      node.scaling = new Vector3(scale, scale, scale);
      nodes.push(node);
    }
    return nodes;
  }
  isBroken(node) {
    return !!(node && node.metadata && node.metadata.broken);
  }

  markBroken(anchor, def) {
    if (anchor) anchor.metadata = { ...(anchor.metadata || {}), broken: true };
    this.brokenCount += 1;
    console.warn(`[deco] Model se nepodaĹ™ilo postavit: ${def.displayName || def.model || def.tree}`);
  }

  isBlocked(cx, cz) {
    return this.blocked.has(cellKey(cx, cz));
  }

  isTreeCell(cx, cz) {
    return this.treeCells.has(cellKey(cx, cz));
  }

  releaseCell(cx, cz) {
    const key = cellKey(cx, cz);
    this.blocked.delete(key);
    this.treeCells.delete(key);
    this.columnTop.delete(key);
    this.floorLifts.delete(key);
  }

  overlaps(x, z, bodyRadius) {
    const { cx, cz } = indexToCellCoords(x, z);
    for (let ix = cx - 2; ix <= cx + 2; ix++) {
      for (let iz = cz - 2; iz <= cz + 2; iz++) {
        const shapes = this.blocked.get(cellKey(ix, iz));
        if (!shapes) continue;
        for (const shape of shapes) {
          const dx = x - shape.cx * CELL_SIZE - shape.offsetX;
          const dz = z - shape.cz * CELL_SIZE - shape.offsetZ;
          if (cellGap(shape, dx, dz) < bodyRadius) return true;
        }
      }
    }
    return false;
  }

  nearestContact(x, z, bodyRadius, reachOut) {
    const { cx, cz } = indexToCellCoords(x, z);
    let best = null;
    for (let ix = cx - 2; ix <= cx + 2; ix++) {
      for (let iz = cz - 2; iz <= cz + 2; iz++) {
        const shapes = this.blocked.get(cellKey(ix, iz));
        if (!shapes) continue;
        for (const shape of shapes) {
          const dx = x - shape.cx * CELL_SIZE - shape.offsetX;
          const dz = z - shape.cz * CELL_SIZE - shape.offsetZ;
          const gap = cellGap(shape, dx, dz) - bodyRadius;
          if (gap > reachOut) continue;
          if (best && gap >= best.gap) continue;
          const dist = Math.hypot(dx, dz);
          best = { nx: dx / (dist || 1), nz: dz / (dist || 1), gap };
        }
      }
    }
    return best;
  }
}

