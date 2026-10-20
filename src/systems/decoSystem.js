// Stavba dekoraci krajiny z dat mapy - dlazdice pudy, cesty, stromy, skaly.
// Drzi jen postavene meshe a blokovane bunky; rozvrzeni si bere z data mapy.
import '@babylonjs/core/Meshes/transformNode';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, cellKey, indexToCellCoords, CELL_SIZE } from '../utils/gridMath.js';
import { getDecoration, decoHeight } from '../data/catalogs/decorations.js';
import { deriveBlocked } from '../data/maps/layoutStore.js';
import { loadModel, instantiateModel } from '../utils/assetLoader.js';
import { tintTemplate, forgetTints } from '../utils/decoTint.js';

const PATH_LIFT = 0.002;
const WATER_LIFT = 0.003;

function withLift(entry, lift) {
  const base = entry.liftY || 0;
  return base > lift ? entry : { ...entry, liftY: lift };
}

const SKIRT_KEYS = new Set([
  'cliff_large', 'cliff_half', 'cliff_top', 'cliff_cornerLarge', 'cliff_cornerTop', 'cliff_halfCorner',
]);

function isSkirt(key) {
  return SKIRT_KEYS.has(key);
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
    this.columnTop = new Map();
    this.surfaceKeys = new Map();
    this.onDecoReady = null;
    this.onPlaced = null;
    this.colors = null;
    this.nodes = [];
    this.pathNodes = [];
    this.waterNodes = [];
  }

  create(layout, colors) {
    this.dispose();
    forgetTints();
    this.blocked.clear();
    this.columnTop.clear();
    this.surfaceKeys.clear();
    this.colors = colors || null;
    this.applyLayout(layout);
  }

  applyLayout(layout) {
    this.layout = layout;
    for (const entry of layout.floor || []) this.place(entry);
    this.buildPath();
    this.buildWater();
    for (const entry of layout.clearing || []) this.place(entry);
    for (const entry of layout.decorations || []) this.place(entry);
    this.refreshBlocked(layout);
  }

  beginStages(layout, colors) {
    this.dispose();
    forgetTints();
    this.blocked.clear();
    this.columnTop.clear();
    this.surfaceKeys.clear();
    this.colors = colors || null;
    this.layout = layout;
  }

  buildStage(stage) {
    const layout = this.layout || {};
    if (stage === 'floor') for (const entry of layout.floor || []) this.place(entry);
    if (stage === 'path') this.buildPath();
    if (stage === 'water') this.buildWater();
    if (stage === 'ground') for (const entry of layout.clearing || []) this.place(entry);
    if (stage === 'deco') for (const entry of layout.decorations || []) this.place(entry);
  }

  finishStages() {
    this.refreshBlocked(this.layout || {});
  }

  buildPath() {
    for (const entry of this.layout?.path || []) this.place(withLift(entry, PATH_LIFT), this.pathNodes, 'path');
    for (const entry of this.layout?.manual || []) this.placePathManual(entry);
  }

  buildWater() {
    for (const entry of this.layout?.water || []) this.place(withLift(entry, WATER_LIFT), this.waterNodes, 'water');
  }

  placePathManual(entry) {
    if (!getDecoration(entry.key)) return;
    this.place(withLift(entry, PATH_LIFT), this.pathNodes, 'path');
  }

  refreshBlocked(layout) {
    this.blocked.clear();
    const entries = [].concat(
      layout.floor || [],
      layout.path || [],
      layout.water || [],
      layout.clearing || [],
      layout.decorations || [],
    );
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
    for (const node of this.pathNodes) if (node && !node.isDisposed()) node.dispose(false, false);
    this.pathNodes.length = 0;
    this.buildPath();
    this.refreshBlocked(layout);
  }

  updateWater(layout) {
    this.layout = layout;
    for (const node of this.waterNodes) if (node && !node.isDisposed()) node.dispose(false, false);
    this.waterNodes.length = 0;
    this.buildWater();
  }

  canUpdatePath(editorLayout) {
    if (!this.snapshot) return false;
    return shapeSignature(editorLayout) === this.snapshot;
  }

  rememberLayout(editorLayout) {
    this.snapshot = shapeSignature(editorLayout);
  }

  applyEntry(entry, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def) return;

    const lift = entry.liftY || 0;
    const top = lift + decoHeight(def);
    const key = cellKey(entry.cx, entry.cz);
    const solid = def.blocks !== false;
    if (isSkirt(entry.key)) return;
    if (section === 'path') this.surfaceKeys.set(key, entry.key);
    const current = this.columnTop.get(key);
    if (!current) {
      this.columnTop.set(key, solid ? { block: top, surface: 0 } : { block: 0, surface: top });
      return;
    }
    if (solid) current.block = Math.max(current.block, top);
    else current.surface = Math.max(current.surface, top);
  }

  place(entry, bucket = this.nodes, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def) return;

    const loader = this.s.loader;
    const handle = loader && this.s.isLoading ? loader.attach(1) : null;
    this.applyEntry(entry, section);
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const anchor = this.createAnchor(entry, def, x, z, bucket);
    const work = this.attachModel(anchor, def, entry, section);
    if (handle) Promise.resolve(work).catch(() => {}).then(() => loader.detach(handle));
    if (this.onPlaced) this.onPlaced(entry);
  }

  topAt(cx, cz) {
    const cell = this.columnTop.get(cellKey(cx, cz));
    if (!cell) return 0;
    return Math.max(cell.block, cell.surface);
  }

  surfaceAt(cx, cz) {
    const cell = this.columnTop.get(cellKey(cx, cz));
    return cell ? cell.surface : 0;
  }

  surfaceKeyAt(cx, cz) {
    return this.surfaceKeys.get(cellKey(cx, cz)) || null;
  }

  createAnchor(entry, def, x, z, bucket = this.nodes) {
    const anchor = new TransformNode(`deco_${entry.key}_${entry.cx}_${entry.cz}`, this.s);
    anchor.position = new Vector3(x + entry.offsetX, entry.liftY || 0, z + entry.offsetZ);
    anchor.rotation.y = (Math.PI / 2) * entry.rotation;
    anchor.metadata = { key: entry.key, def, bucket, entry };
    bucket.push(anchor);
    return anchor;
  }

  dispose() {
    for (const node of this.s.transformNodes.slice()) this.disposeAnchor(node);
    this.nodes.length = 0;
    this.pathNodes.length = 0;
    this.waterNodes.length = 0;
  }

  disposeAnchor(node) {
    if (!node || node.isDisposed() || !node.name?.startsWith('deco_')) return;
    const bucket = node.metadata?.bucket;
    const index = bucket ? bucket.indexOf(node) : -1;
    if (index >= 0) bucket.splice(index, 1);
    node.dispose(false, false);
  }

  async attachModel(anchor, def, entry, section) {
    const template = await loadModel(this.s, def.model);
    if (!template || anchor.isDisposed()) return;

    const node = instantiateModel(this.s, template, `decoModel_${entry.key}_${entry.cx}_${entry.cz}`);
    node.parent = anchor;
    node.position = new Vector3(0, 0, 0);
    node.scaling = new Vector3(def.scale, def.scale, def.scale);
    tintTemplate(node, def, this.colors, section);

    if (this.onDecoReady) this.onDecoReady(anchor, node, def, entry);
  }

  readyEntries() {
    const out = [];
    for (const node of this.nodes) {
      const entry = node.metadata?.entry;
      const def = node.metadata?.def;
      if (!entry || !def || !def.gather) continue;
      if (!node.getChildMeshes().length) continue;
      out.push({ anchor: node, def, entry });
    }
    return out;
  }

  isBlocked(cx, cz) {
    return this.blocked.has(cellKey(cx, cz));
  }

  releaseCell(cx, cz) {
    const key = cellKey(cx, cz);
    this.blocked.delete(key);
    this.columnTop.delete(key);
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

function shapeSignature(editorLayout) {
  if (!editorLayout) return '';
  const zones = [];
  for (const zone of editorLayout.zones || []) {
    for (const [cx, cz] of zone.cells) zones.push(`${cellKey(cx, cz)}:${zone.brush}`);
  }
  const height = (editorLayout.height || []).map(([key, level]) => `${key}=${level}`).sort().join(';');
  const exclude = (editorLayout.exclude || []).map(([cx, cz]) => cellKey(cx, cz)).sort().join(';');
  return `${zones.sort().join(';')}##${height}##${exclude}`;
}
