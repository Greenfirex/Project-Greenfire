// Stavba dekoraci krajiny z dat mapy - dlazdice pudy, cesty, stromy, skaly.
// Drzi jen postavene meshe a blokovane bunky; rozvrzeni si bere z data mapy.
import '@babylonjs/core/Meshes/transformNode';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/mesh';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, worldToCellCoords, cellKey, indexToCellCoords, CELL_SIZE } from '../../utils/gridMath.js';
import { getDecoration, decoHeight } from '../../data/catalogs/decorations.js';
import { deriveBlocked } from '../../data/maps/layoutStore.js';
import { levelOfEntry } from '../../data/maps/areaShape.js';
import { instantiateModel, ownMaterials, whenModelsIdle } from '../../utils/assetLoader.js';
import { treeStumpTemplate, treeLogTemplate, treeFrondTemplate } from '../../utils/treeFactory.js';
import { decorationTemplate } from '../../utils/decoTemplate.js';
import { tintTemplate, forgetTints } from '../../utils/decoTint.js';
import { cellNoise, decoJitter, decoPlacement } from '../../utils/decoPlacement.js';
import { warnMissingWiring } from '../../utils/missingWiring.js';
import PathSystem from './pathSystem.js';
import ContactShadow from '../../utils/contactShadow.js';

const PATH_SURFACE = 0.02;
const FLAT_SINK = 0.015;
const AREA_WORLD = CELL_SIZE * 8;
const AREA_VIEW_MARGIN = 26;
const AREA_VIEW_HYSTERESIS = 4;
const DECK_FEET_CLEAR = 0.25;

function entryMatchKey(entry) {
  return `${levelOfEntry(entry)}|${entry.key}|${entry.cx}|${entry.cz}|${entry.offsetX || 0}|${entry.offsetZ || 0}|${entry.scale || 1}|${entry.rotation || 0}`;
}


function liesFlat(def) {
  return Boolean(def && (def.shell || def.flat));
}

function hasModelDef(def) {
  if (!def) return false;
  return Boolean(def.model || def.tree || def.log || def.branch || def.driftwood
    || def.rock || def.shell || def.coral || def.flower || def.bush || def.campfire || def.moss || def.plank || def.furniture);
}

function boxContact(shape, x, z) {
  const c = Math.cos(shape.yaw || 0);
  const s = Math.sin(shape.yaw || 0);
  const lx = x * c - z * s;
  const lz = x * s + z * c;
  const qx = Math.abs(lx) - shape.box[0];
  const qz = Math.abs(lz) - shape.box[1];
  const gap = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
  let nlx = Math.sign(lx) * Math.max(qx, 0);
  let nlz = Math.sign(lz) * Math.max(qz, 0);
  if (gap <= 0) {
    nlx = qx > qz ? Math.sign(lx) || 1 : 0;
    nlz = qx > qz ? 0 : Math.sign(lz) || 1;
  }
  const length = Math.hypot(nlx, nlz) || 1;
  return { gap, nx: (nlx * c + nlz * s) / length, nz: (-nlx * s + nlz * c) / length };
}

function underFeet(shape, feetY) {
  return feetY + DECK_FEET_CLEAR >= shape.top;
}

function cellGap(shape, x, z) {
  if (shape.box) return boxContact(shape, x, z).gap;
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
    this.caveBlocked = new Map();
    this.treeCells = new Set();
    this.columnTop = new Map();
    this.blockedVersion = 0;
    this.surfaceKeys = new Map();
    this.onDecoReady = null;
    this.onDecoBroken = null;
    this.colors = null;
    this.groundHeightAt = null;
    this.deckAt = null;
    this.nodes = [];
    this.anchors = [];
    this.flowerAnchors = [];
    this.pathNodes = [];
    this.pendingPieces = [];
    this.areas = new Map();
    this.hidden = false;
    this.brokenCount = 0;
    this.pathSystem = new PathSystem(scene);
    this.contactShadow = new ContactShadow(scene);
  }

  create(layout, colors) {
    this.dispose();
    forgetTints();
    this.blocked.clear();
    this.columnTop.clear();
    this.surfaceKeys.clear();
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
    this.brokenCount = 0;
    this.colors = colors || null;
    this.layout = layout;
  }

  hasModel(key) {
    return hasModelDef(getDecoration(key));
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
    this.refreshBlocked(this.layout || {});
  }

  beginHeights(layout, colors) {
    this.blocked.clear();
    this.columnTop.clear();
    this.surfaceKeys.clear();
    this.colors = colors || this.colors;
    this.layout = layout;
    for (const entry of layout.floor || []) this.applyEntry(entry);
    this.buildPath();
    for (const entry of layout.clearing || []) this.applyEntry(entry);
    for (const entry of layout.decorations || []) this.applyEntry(entry);
    this.relinkEntries(layout);
    this.refreshBlocked(layout);
  }

  relinkEntries(layout) {
    const fresh = new Map();
    for (const entry of layout.decorations || []) {
      if (!entry) continue;
      fresh.set(entryMatchKey(entry), entry);
    }
    for (const anchor of this.anchors) {
      const meta = anchor && anchor.metadata;
      if (!meta || !meta.entry) continue;
      const next = fresh.get(entryMatchKey(meta.entry));
      if (next) meta.entry = next;
    }
  }

  reseatHeights() {
    if (!this.groundHeightAt) return;
    for (const anchor of this.anchors) {
      if (!anchor || anchor.isDisposed()) continue;
      const meta = anchor.metadata;
      if (!meta || !meta.entry) continue;
      const jitter = decoJitter(meta.def, meta.entry);
      const shiftX = jitter ? jitter.x : 0;
      const shiftZ = jitter ? jitter.z : 0;
      const y = this.entryHeight(meta.entry, shiftX, shiftZ);
      anchor.position.y = y;
      if (liesFlat(meta.def)) this.leanFlat(anchor, meta.def, anchor.position.x, y, anchor.position.z);
    }
    this.refreshContactShadows();
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
    this.blockedVersion += 1;
    this.blocked.clear();
    this.caveBlocked.clear();
    this.treeCells.clear();
    const entries = [].concat(
      layout.floor || [],
      layout.path || [],
      layout.clearing || [],
      (layout.decorations || []).filter((entry) => entry && levelOfEntry(entry) === 0 && !entry.deck),
    );
    for (const entry of layout.decorations || []) {
      if (!entry || levelOfEntry(entry) !== 0) continue;
      const def = getDecoration(entry.key);
      if (def && def.kind === 'tree') this.treeCells.add(cellKey(entry.cx, entry.cz));
    }
    for (const shape of deriveBlocked(entries)) this.addBlockedShape(shape);
    for (const cell of layout.blocked || []) this.addBlockedShape(cell);
    for (const entry of layout.decorations || []) {
      if (!entry || entry.deck !== 'lower' || levelOfEntry(entry) !== 0) continue;
      const top = this.entryHeight(entry) + decoHeight(getDecoration(entry.key) || {});
      for (const shape of deriveBlocked([entry])) this.addBlockedShape({ ...shape, top });
    }
    for (const entry of layout.decorations || []) {
      const level = levelOfEntry(entry);
      if (!entry || level === 0) continue;
      for (const shape of deriveBlocked([entry])) this.addBlockedShape(shape, level);
    }
  }

  blockedOn(level) {
    if (level === 0) return this.blocked;
    if (!this.caveBlocked.has(level)) this.caveBlocked.set(level, new Map());
    return this.caveBlocked.get(level);
  }

  addBlockedShape(cell, level = 0) {
    const blocked = this.blockedOn(level);
    const key = cellKey(cell.cx, cell.cz);
    const list = blocked.get(key);
    const shape = {
      cx: cell.cx,
      cz: cell.cz,
      radius: cell.radius || 0,
      footprint: cell.footprint || null,
      turn: cell.turn || 0,
      box: cell.box || null,
      yaw: cell.yaw || 0,
      top: Number.isFinite(cell.top) ? cell.top : Infinity,
      offsetX: cell.offsetX || 0,
      offsetZ: cell.offsetZ || 0,
    };
    if (list) list.push(shape);
    else blocked.set(key, [shape]);
  }

  updatePath(layout) {
    this.layout = layout;
    this.buildPath();
    this.refreshBlocked(layout);
  }

  applyEntry(entry, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def || levelOfEntry(entry) !== 0 || entry.deck) return;

    const top = this.entryHeight(entry) + decoHeight(def);
    const key = cellKey(entry.cx, entry.cz);
    const solid = def.blocks !== false;
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
    if (entry.deck && this.deckAt) {
      const spot = cellToWorldCoords(entry.cx, entry.cz);
      const deck = this.deckAt(spot.x + (entry.offsetX || 0) + extraX, spot.z + (entry.offsetZ || 0) + extraZ, entry.deck);
      if (deck) return deck.y;
    }
    const base = entry.liftY || 0;
    if (!this.groundHeightAt) {
      warnMissingWiring('dekorace: výška země');
      return base;
    }
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const level = levelOfEntry(entry);
    const local = this.groundAt(x + (entry.offsetX || 0) + extraX, z + (entry.offsetZ || 0) + extraZ, level);
    const center = this.groundAt(x, z, level);
    return base + (local - center);
  }

  place(entry, bucket = this.nodes, section = 'deco') {
    const def = getDecoration(entry.key);
    if (!def) return null;

    this.applyEntry(entry, section);
    if (!hasModelDef(def)) return null;
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const anchor = this.createAnchor(entry, def, x, z, bucket);
    const work = this.attachModel(anchor, def, entry, section);
    this.pendingPieces.push(work);
    return work;
  }

  caveDecoMeshes(level) {
    if (level === 0) return [];
    const meshes = [];
    for (const anchor of this.anchors) {
      const entry = anchor && anchor.metadata && anchor.metadata.entry;
      if (!entry || levelOfEntry(entry) !== level || anchor.isDisposed()) continue;
      meshes.push(...anchor.getChildMeshes(false));
    }
    return meshes;
  }

  caveDecoInSight(seen) {
    const meshes = [];
    for (const anchor of this.anchors) {
      const entry = anchor && anchor.metadata && anchor.metadata.entry;
      const floor = levelOfEntry(entry);
      if (!entry || floor === 0 || anchor.isDisposed() || !seen(anchor.position, floor)) continue;
      meshes.push(...anchor.getChildMeshes(false));
    }
    return meshes;
  }

  topAt(cx, cz) {
    const cell = this.columnTop.get(cellKey(cx, cz));
    if (cell) return Math.max(cell.block, cell.surface);
    return this.surfaceAt(cx, cz);
  }

  surfaceAt(cx, cz) {
    const key = cellKey(cx, cz);
    const { x, z } = cellToWorldCoords(cx, cz);
    const ground = this.groundAt(x, z);
    const cell = this.columnTop.get(key);
    if (cell) return Math.max(cell.surface, ground);
    return ground;
  }

  groundAt(x, z, level = 0) {
    if (!this.groundHeightAt) {
      warnMissingWiring('dekorace: výška země');
      return 0;
    }
    const height = this.groundHeightAt(x, z, level);
    return Number.isFinite(height) ? height : 0;
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
    const place = decoPlacement(def, entry);
    const spotX = x + place.offsetX;
    const spotZ = z + place.offsetZ;
    const spotY = this.entryHeight(entry, place.jitterX, place.jitterZ);
    const yaw = place.yaw;
    if (def.bush) this.addContactShadow(def, spotX, spotY, spotZ);
    const anchor = new TransformNode(`deco_${entry.key}_${entry.cx}_${entry.cz}`, this.s);
    anchor.parent = this.areaFor(spotX, spotZ);
    anchor.position = new Vector3(spotX, spotY, spotZ);
    anchor.metadata = { key: entry.key, def, bucket, entry, yaw };
    if (liesFlat(def)) {
      if (def.flat) anchor.rotation.y = yaw;
      this.leanFlat(anchor, def, spotX, spotY, spotZ);
    }
    else if (!def.flower) anchor.rotation.y = yaw;
    if (def.flower) this.flowerAnchors.push(anchor);
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
    if (def.flat) {
      const yaw = anchor.rotation.y;
      const turn = Quaternion.RotationAxis(Vector3.Up(), yaw);
      anchor.rotationQuaternion = tilt.multiply(turn);
    } else {
      anchor.rotationQuaternion = tilt;
    }
    anchor.position.y = y - FLAT_SINK;
  }

  addContactShadow(def, x, y, z) {
    const radius = Number.isFinite(def.radius) ? def.radius : 1;
    this.contactShadow.add(x, y, z, Math.max(0.4, radius), this.groundTiltAt(x, z, Math.max(0.4, radius)));
  }

  groundTiltAt(x, z, reach) {
    if (!this.groundHeightAt) return null;
    const slopeX = (this.groundHeightAt(x + reach, z) - this.groundHeightAt(x - reach, z)) / (2 * reach);
    const slopeZ = (this.groundHeightAt(x, z + reach) - this.groundHeightAt(x, z - reach)) / (2 * reach);
    const normal = new Vector3(-slopeX, 1, -slopeZ).normalize();
    const tilt = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), normal, tilt);
    return tilt;
  }

  refreshContactShadows() {
    this.contactShadow.clear();
    for (const anchor of this.anchors) {
      if (!anchor || anchor.isDisposed()) continue;
      const meta = anchor.metadata;
      if (!meta || !meta.def || !meta.def.bush) continue;
      this.addContactShadow(meta.def, anchor.position.x, anchor.position.y, anchor.position.z);
    }
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
    this.contactShadow.clear();
    for (const anchor of this.anchors.slice()) this.disposeAnchor(anchor);
    this.anchors.length = 0;
    this.flowerAnchors.length = 0;
    this.nodes.length = 0;
    this.pathNodes.length = 0;
    this.pendingPieces.length = 0;
    for (const area of this.areas.values()) area.node.dispose();
    this.areas.clear();
  }

  areaFor(x, z) {
    const areaX = Math.floor(x / AREA_WORLD);
    const areaZ = Math.floor(z / AREA_WORLD);
    const key = `${areaX}|${areaZ}`;
    if (!this.areas.has(key)) {
      const node = new TransformNode(`decoArea_${key}`, this.s);
      node.setEnabled(!this.hidden);
      this.areas.set(key, {
        node,
        minX: areaX * AREA_WORLD,
        minZ: areaZ * AREA_WORLD,
        enabled: true,
      });
    }
    return this.areas.get(key).node;
  }

  showDeckDecorations(shownAt) {
    for (const anchor of this.anchors) {
      const entry = anchor.metadata && anchor.metadata.entry;
      if (!entry || !entry.deck || anchor.isDisposed()) continue;
      anchor.setEnabled(shownAt(anchor.position.x, anchor.position.z, entry.deck));
    }
  }

  setHidden(hidden) {
    this.hidden = hidden === true;
    for (const area of this.areas.values()) area.node.setEnabled(area.enabled && !this.hidden);
    for (const mesh of this.pathSystem.meshes) {
      if (mesh && !mesh.isDisposed()) mesh.setEnabled(!this.hidden);
    }
    const shadows = this.contactShadow.master;
    if (shadows) shadows.setEnabled(!this.hidden && this.contactShadow.items.length > 0);
  }

  updateView(view) {
    if (!view) return;
    const inner = view.radius + AREA_VIEW_MARGIN;
    const outer = inner + AREA_VIEW_HYSTERESIS;
    for (const area of this.areas.values()) {
      const dx = Math.max(area.minX - view.x, 0, view.x - (area.minX + AREA_WORLD));
      const dz = Math.max(area.minZ - view.z, 0, view.z - (area.minZ + AREA_WORLD));
      const distance = Math.hypot(dx, dz);
      const enabled = area.enabled ? distance <= outer : distance <= inner;
      if (enabled === area.enabled) continue;
      area.enabled = enabled;
      area.node.setEnabled(enabled && !this.hidden);
    }
  }

  disposeAnchor(node) {
    if (!node || node.isDisposed()) return;
    const bucket = node.metadata?.bucket;
    const index = bucket ? bucket.indexOf(node) : -1;
    if (index >= 0) bucket.splice(index, 1);
    const own = this.anchors.indexOf(node);
    if (own >= 0) this.anchors.splice(own, 1);
    const flower = this.flowerAnchors.indexOf(node);
    if (flower >= 0) this.flowerAnchors.splice(flower, 1);
    node.dispose(false, false);
  }

  async attachModel(anchor, def, entry, section) {
    try {
      await this.attachModelNow(anchor, def, entry, section);
    } catch (error) {
      console.warn('[deco] Model se nepodařilo připojit:', def.model || def.tree, error);
      if (!anchor.isDisposed() && !anchor.metadata?.broken) this.markBroken(anchor, def);
    }
  }

  async attachModelNow(anchor, def, entry, section) {
    const template = await decorationTemplate(this.s, def);
    if (anchor.isDisposed()) return;
    if (!template) return this.markBroken(anchor, def);

    const node = instantiateModel(this.s, template, `decoModel_${entry.key}_${entry.cx}_${entry.cz}`);
    if (!node) return this.markBroken(anchor, def);
    node.parent = anchor;
    node.position = new Vector3(0, 0, 0);
    const { scale } = decoPlacement(def, entry);
    node.scaling = new Vector3(scale, scale, scale);
    if (((liesFlat(def) && !def.flat) || def.flower) && anchor.metadata) node.rotation.y = anchor.metadata.yaw || 0;
    if (!def.noTint) ownMaterials(node);
    tintTemplate(node, def, this.colors, section);
    anchor.metadata.model = node;
    if (this.onDecoReady) this.onDecoReady(anchor, node, def, entry);
  }

  updateWind(time) {
    if (this.contactShadow) this.contactShadow.flush();
    if (!this.flowerAnchors.length) return;
    const seconds = Number.isFinite(time) ? time : 0;
    for (let index = 0; index < this.flowerAnchors.length; index += 1) {
      const anchor = this.flowerAnchors[index];
      if (!anchor || anchor.isDisposed()) continue;
      const phase = anchor.position.x * 0.55 + anchor.position.z * 0.42;
      const gust = Math.sin(seconds * 0.8 + phase * 0.35);
      const pushX = Math.sin(seconds * 1.6 + phase) * 0.55
        + Math.sin(seconds * 3.4 + phase * 2.1) * 0.2;
      const pushZ = Math.cos(seconds * 1.25 + phase * 1.4) * 0.45
        + Math.cos(seconds * 2.9 + phase * 0.7) * 0.15;
      const amount = 0.28 * (0.7 + 0.3 * gust);
      anchor.rotation.x = pushZ * amount;
      anchor.rotation.z = -pushX * amount;
    }
  }

  readyEntries() {
    const out = [];
    for (const node of this.nodes) {
      if (!node || node.isDisposed() || !node.metadata?.model) continue;
      out.push(node);
    }
    return out;
  }

  entryAt(cx, cz, match) {
    const anchor = this.nodes.find((node) => {
      if (!node || node.isDisposed() || !node.metadata?.def?.gather) return false;
      if (!match(node.metadata.def, node.metadata.entry)) return false;
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
  felledParts(anchor) {
    if (!anchor || anchor.isDisposed()) return [];
    const prefixes = [`stump_${anchor.name}`, `log_${anchor.name}_`, `frond_${anchor.name}_`];
    return anchor.getChildren().filter((node) => prefixes.some((prefix) => node.name.startsWith(prefix)));
  }

  restoreFelled(anchor) {
    if (!anchor || anchor.isDisposed()) return;
    for (const node of this.felledParts(anchor)) node.dispose(false, false);
    if (anchor.metadata) anchor.metadata.stump = null;
    const model = anchor.metadata ? anchor.metadata.model : null;
    if (model && !model.isDisposed()) model.setEnabled(true);
  }

  isBroken(node) {
    return !!(node && node.metadata && node.metadata.broken);
  }

  markBroken(anchor, def) {
    if (anchor) anchor.metadata = { ...(anchor.metadata || {}), broken: true };
    this.brokenCount += 1;
    console.warn(`[deco] Model se nepodařilo postavit: ${def.displayName || def.model || def.tree}`);
  }

  isBlocked(cx, cz) {
    return this.blocked.has(cellKey(cx, cz));
  }

  isTreeCell(cx, cz) {
    return this.treeCells.has(cellKey(cx, cz));
  }

  releaseCell(cx, cz, anchor = null) {
    const def = anchor && anchor.metadata ? anchor.metadata.def : null;
    if (def && def.blocks === false && def.kind !== 'tree') return;
    const key = cellKey(cx, cz);
    this.blockedVersion += 1;
    const level = levelOfEntry(anchor && anchor.metadata ? anchor.metadata.entry : null);
    if (level !== 0) {
      this.blockedOn(level).delete(key);
      return;
    }
    this.blocked.delete(key);
    this.treeCells.delete(key);
    this.columnTop.delete(key);
  }

  overlaps(x, z, bodyRadius, level = 0, feetY = -Infinity) {
    const blocked = this.blockedOn(level);
    const { cx, cz } = indexToCellCoords(x, z);
    for (let ix = cx - 2; ix <= cx + 2; ix++) {
      for (let iz = cz - 2; iz <= cz + 2; iz++) {
        const shapes = blocked.get(cellKey(ix, iz));
        if (!shapes) continue;
        for (const shape of shapes) {
          if (underFeet(shape, feetY)) continue;
          const dx = x - shape.cx * CELL_SIZE - shape.offsetX;
          const dz = z - shape.cz * CELL_SIZE - shape.offsetZ;
          if (cellGap(shape, dx, dz) < bodyRadius) return true;
        }
      }
    }
    return false;
  }

  nearestContact(x, z, bodyRadius, reachOut, level = 0, feetY = -Infinity) {
    const blocked = this.blockedOn(level);
    const { cx, cz } = indexToCellCoords(x, z);
    let best = null;
    for (let ix = cx - 2; ix <= cx + 2; ix++) {
      for (let iz = cz - 2; iz <= cz + 2; iz++) {
        const shapes = blocked.get(cellKey(ix, iz));
        if (!shapes) continue;
        for (const shape of shapes) {
          if (underFeet(shape, feetY)) continue;
          const dx = x - shape.cx * CELL_SIZE - shape.offsetX;
          const dz = z - shape.cz * CELL_SIZE - shape.offsetZ;
          if (shape.box) {
            const contact = boxContact(shape, dx, dz);
            const gap = contact.gap - bodyRadius;
            if (gap > reachOut || (best && gap >= best.gap)) continue;
            best = { nx: contact.nx, nz: contact.nz, gap };
            continue;
          }
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

