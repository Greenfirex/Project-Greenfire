// Stavba dekoraci krajiny z dat mapy - dlazdice pudy, cesty, stromy, skaly.
// Drzi jen postavene meshe a blokovane bunky; rozvrzeni si bere z data mapy.
import '@babylonjs/core/Meshes/transformNode';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, cellKey, CELL_SIZE } from '../utils/gridMath.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { loadModel, instantiateModel } from '../utils/assetLoader.js';
import { tintTemplate, forgetTints } from '../utils/decoTint.js';

const PATH_LIFT = 0.002;
const WATER_LIFT = 0.003;

function withLift(entry, lift) {
  const base = entry.liftY || 0;
  return base > lift ? entry : { ...entry, liftY: lift };
}

export default class DecoSystem {

  constructor(scene) {
    this.s = scene;
    this.blocked = new Map();
    this.columnTop = new Map();
    this.onDecoReady = null;
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
    for (const cell of layout.blocked || []) {
      this.blocked.set(cellKey(cell.cx, cell.cz), cell.radius || CELL_SIZE / 2);
    }
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

  applyEntry(entry) {
    const def = getDecoration(entry.key);
    if (!def) return;

    const lift = entry.liftY || 0;
    const top = lift + (def.height || 0);
    const key = cellKey(entry.cx, entry.cz);
    const walkable = entry.blocks === false || def.blocks === false;
    const current = this.columnTop.get(key);
    if (!current) {
      this.columnTop.set(key, { block: walkable ? lift : top, surface: walkable ? top : lift });
      return;
    }
    if (!walkable) current.block = Math.max(current.block, top);
    current.surface = Math.max(current.surface, walkable ? top : lift);
  }

  place(entry, bucket = this.nodes, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def) return;

    this.applyEntry(entry);
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const anchor = this.createAnchor(entry, def, x, z, bucket);
    this.attachModel(anchor, def, entry, section);
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

  createAnchor(entry, def, x, z, bucket = this.nodes) {
    const anchor = new TransformNode(`deco_${entry.key}_${entry.cx}_${entry.cz}`, this.s);
    anchor.position = new Vector3(x + entry.offsetX, entry.liftY || 0, z + entry.offsetZ);
    anchor.rotation.y = (Math.PI / 2) * entry.rotation;
    anchor.metadata = { key: entry.key, def, bucket };
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

  isBlocked(cx, cz) {
    return this.blocked.has(cellKey(cx, cz));
  }

  overlaps(x, z, bodyRadius) {
    const cx = Math.round(x / CELL_SIZE);
    const cz = Math.round(z / CELL_SIZE);
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const radius = this.blocked.get(cellKey(ix, iz));
        if (radius === undefined) continue;
        const dx = x - ix * CELL_SIZE;
        const dz = z - iz * CELL_SIZE;
        const reach = radius + bodyRadius;
        if (dx * dx + dz * dz < reach * reach) return true;
      }
    }
    return false;
  }

  nearestContact(x, z, bodyRadius, reachOut) {
    const cx = Math.floor(x / CELL_SIZE);
    const cz = Math.floor(z / CELL_SIZE);
    let best = null;
    for (let ix = cx - 2; ix <= cx + 2; ix++) {
      for (let iz = cz - 2; iz <= cz + 2; iz++) {
        const radius = this.blocked.get(cellKey(ix, iz));
        if (radius === undefined) continue;
        const dx = x - ix * CELL_SIZE;
        const dz = z - iz * CELL_SIZE;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const gap = dist - radius - bodyRadius;
        if (gap > reachOut) continue;
        if (!best || gap < best.gap) best = { nx: dx / (dist || 1), nz: dz / (dist || 1), radius, gap };
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
