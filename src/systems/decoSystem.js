// Stavba dekorací krajiny z dat mapy — dlaždice půdy, cesty, stromy, skály.
// Drží jen postavené meshe a blokované buňky; rozvržení si bere z data mapy.
import '@babylonjs/core/Meshes/transformNode';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, cellKey } from '../utils/gridMath.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { loadModel, instantiateModel } from '../utils/assetLoader.js';
import { tintTemplate } from '../utils/decoTint.js';
import { createWaterPlane } from './waterSystem.js';

export default class DecoSystem {

  constructor(scene) {
    this.s = scene;
    this.blocked = new Map();
    this.columnTop = new Map();
    this.onDecoReady = null;
    this.tinted = new Set();
    this.colors = null;
    this.nodes = [];
    this.pathNodes = [];
  }

  create(layout, colors) {
    this.dispose();
    this.blocked.clear();
    this.columnTop.clear();
    this.colors = colors || null;
    this.layout = layout;

    for (const entry of layout.floor || []) this.place(entry);
    this.buildPath();
    for (const entry of layout.clearing || []) this.place(entry);
    for (const entry of layout.decorations || []) this.place(entry);

    for (const cell of layout.blocked || []) {
      this.blocked.set(cellKey(cell.cx, cell.cz), cell.radius);
    }
  }

  buildPath() {
    for (const entry of this.layout?.path || []) this.place(entry, this.pathNodes);
    for (const entry of this.layout?.manual || []) this.placePathManual(entry);
  }

  placePathManual(entry) {
    if (!getDecoration(entry.key)) return;
    this.place({ ...entry, liftY: 0 }, this.pathNodes);
  }

  updatePath(layout) {
    this.layout = layout;
    for (const node of this.pathNodes) if (node && !node.isDisposed()) node.dispose(false, false);
    this.pathNodes.length = 0;
    this.buildPath();
  }

  canUpdatePath(editorLayout) {
    if (!this.snapshot) return false;
    return shapeSignature(editorLayout) === this.snapshot;
  }

  rememberLayout(editorLayout) {
    this.snapshot = shapeSignature(editorLayout);
  }

  place(entry, bucket = this.nodes) {
    const def = getDecoration(entry.key);
    if (!def) return;

    const lift = entry.liftY || 0;
    const top = lift + (def.height || 0);
    const key = cellKey(entry.cx, entry.cz);
    const walkable = entry.blocks === false || def.blocks === false;
    const current = this.columnTop.get(key);
    if (!current) {
      this.columnTop.set(key, { block: walkable ? lift : top, surface: walkable ? top : lift });
    } else {
      if (!walkable) current.block = Math.max(current.block, top);
      current.surface = Math.max(current.surface, walkable ? top : lift);
    }

    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const anchor = this.createAnchor(entry, def, x, z, bucket);
    this.attachModel(anchor, def, entry);
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
    anchor.metadata = { key: entry.key, def };
    bucket.push(anchor);
    return anchor;
  }

  dispose() {
    for (const node of this.nodes) if (node && !node.isDisposed()) node.dispose(false, false);
    for (const node of this.pathNodes) if (node && !node.isDisposed()) node.dispose(false, false);
    this.nodes.length = 0;
    this.pathNodes.length = 0;
  }

  async attachModel(anchor, def, entry) {
    if (def.procedural === 'water') {
      const rgb = this.colors?.water || [0.09, 0.28, 0.34];
      const plane = createWaterPlane(this.s, `water_${entry.cx}_${entry.cz}`, rgb);
      plane.parent = anchor;
      if (this.onDecoReady) this.onDecoReady(anchor, plane, def);
      return;
    }

    const template = await loadModel(this.s, def.model, (root) => this.tintTemplate(root, def));
    if (!template || anchor.isDisposed()) return;

    const node = instantiateModel(this.s, template, `decoModel_${entry.key}_${entry.cx}_${entry.cz}`);
    node.parent = anchor;
    node.position = new Vector3(0, 0, 0);
    node.scaling = new Vector3(def.scale, def.scale, def.scale);

    if (this.onDecoReady) this.onDecoReady(anchor, node, def);
  }

  tintTemplate(template, def) {
    if (this.tinted.has(def.model)) return;
    this.tinted.add(def.model);
    tintTemplate(template, def, this.colors);
  }

  isBlocked(cx, cz) {
    return this.blocked.has(cellKey(cx, cz));
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
