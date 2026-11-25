// Mřížka světa — náhled dekorací a zvýraznění buněk v editoru mapy.
// Podlahu a linky buněk kreslí terrainSystem; tenhle systém řeší jen kurzor.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { instantiateModel } from '../../utils/assetLoader.js';
import { decorationTemplate } from '../../utils/decoTemplate.js';

const EDGE_INSETS = [0, 0.05, 0.1];
const EDGE_LIFT = 0.09;

const HOLO_VALID = new Color3(0.35, 0.95, 0.8);
const HOLO_INVALID = new Color3(0.95, 0.38, 0.32);

const HOLOGRAM_ALPHA = 0.45;
const HOLO_ERASE = new Color3(1, 0.1, 0.06);
const HOLOGRAM_ERASE_ALPHA = 0.8;
const HOLOGRAM_ERASE_OFFSET = -3;
const CREATURE_RADIUS_ROAM = new Color3(1, 0.82, 0.35);
const CREATURE_RADIUS_ROAM_RING = new Color3(1, 0.86, 0.4);
const CREATURE_RADIUS_NOTICE = new Color3(1, 0.42, 0.24);
const CREATURE_RADIUS_NOTICE_RING = new Color3(1, 0.5, 0.3);
const CREATURE_RADIUS_LIFT = 0.06;
const CREATURE_RADIUS_STEPS = 72;
const OUTLINE_LIFT = 0.07;
const ARROW_LIFT = 0.12;
const ARROW_HALF = CELL_SIZE * 0.32;
const ARROW_HEAD = CELL_SIZE * 0.16;
const ARROW_RING = CELL_SIZE * 0.4;
const ARROW_RING_STEPS = 16;
const SINGLE_ITEM = { offsetX: 0, offsetZ: 0, yaw: 0 };

function speciesOf(def) {
  return def.bush || def.tree || def.rock || def.shell || def.coral || def.flower || def.model || 'kus';
}
const ZONE_SLOTS = 12;


export default class GridSystem {

  constructor(scene) {
    this.s = scene;
    this.overlayGroup = 0;
    this.brushMaster = null;
    this.brushMaterial = null;
    this.brushInstances = [];
    this.hoverMaster = null;
    this.hoverMaterial = null;
    this.radiusDisc = null;
    this.radiusRing = null;
    this.radiusMaterial = null;
    this.zonesMasters = [];
    this.zonesMaterials = [];
    this.zonesPool = [];
    this.draftOutline = null;
    this.arrowLines = null;
    this.draftLinesAdd = null;
    this.draftAddPool = [];
    this.draftLinesRemove = null;
    this.draftRemovePool = [];
    this.hologramKey = '';
    this.hologramNodes = [];
    this.hologramItems = null;
    this.hologramBase = null;
    this.hologramVisible = false;
    this.hologramOwnMaterials = [];
    this.hologramToken = 0;
    this.hologramValid = true;
    this.draftModels = [];
    this.draftModelMaterials = [];
    this.draftModelToken = 0;
  }

  showDecorPreview(def, items, cx, cz, topY, rotation = 0, decoKey = null) {
    if (!def) return;
    const list = Array.isArray(items) && items.length ? items : [SINGLE_ITEM];
    const key = `deco:${decoKey || speciesOf(def)}`;
    if (this.hologramKey !== key) this.buildHologram(key, () => decorationTemplate(this.s, def), list);
    this.placeHologram(cx * CELL_SIZE, topY, cz * CELL_SIZE, (Math.PI / 2) * rotation, list);
    this.tintHologram(true);
  }

  placeHologram(x, y, z, rotation, items = null) {
    this.hologramBase = { x, y, z, rotation };
    if (items) this.hologramItems = items;
    this.hologramVisible = true;
    this.arrangeHologram();
  }

  arrangeHologram() {
    const base = this.hologramBase;
    if (!base || !this.hologramNodes.length) return;
    const items = this.hologramItems && this.hologramItems.length ? this.hologramItems : [SINGLE_ITEM];
    this.growHologramNodes(items.length);
    this.hologramNodes.forEach((node, index) => {
      const item = items[index];
      if (!item) {
        node.setEnabled(false);
        return;
      }
      node.position.set(base.x + (item.offsetX || 0), base.y, base.z + (item.offsetZ || 0));
      node.rotation.y = base.rotation + (item.yaw || 0);
      if (Number.isFinite(item.scale)) node.scaling.setAll(item.scale);
      node.setEnabled(this.hologramVisible);
    });
  }

  growHologramNodes(count) {
    const first = this.hologramNodes[0];
    while (first && this.hologramNodes.length < count) {
      const copy = first.clone(`hologramModel_${this.hologramNodes.length}`);
      if (!copy) return;
      copy.setEnabled(false);
      this.hologramNodes.push(copy);
    }
  }

  buildHologram(key, loadTemplate, items = null) {
    this.hologramKey = key;
    this.hologramItems = items;
    this.disposeHologram();
    this.hologramToken += 1;
    const token = this.hologramToken;
    Promise.resolve(loadTemplate()).then((template) => {
      if (token !== this.hologramToken || this.hologramKey !== key) return;
      const node = instantiateModel(this.s, template, 'hologramModel');
      if (!node) return;
      this.hologramOwnMaterials = this.hologramMaterials(node);
      this.hologramNodes = [node];
      this.arrangeHologram();
      this.tintHologram(this.hologramValid);
    });
  }

  hologramMaterials(node, erase = false) {
    return node.getChildMeshes().map((mesh) => {
      const mat = new StandardMaterial(`hologramMat_${mesh.name}`, this.s);
      const source = mesh.material;
      if (source && source.alphaTexture) mat.opacityTexture = source.alphaTexture;
      else if (source && source.useAlphaFromDiffuseTexture && source.diffuseTexture) mat.opacityTexture = source.diffuseTexture;
      mat.specularColor = new Color3(0, 0, 0);
      mat.backFaceCulling = false;
      this.paintHologram(mat, erase);
      mesh.material = mat;
      mesh.receiveShadows = false;
      return mat;
    });
  }

  showDraftModels(items) {
    this.draftModelToken += 1;
    const token = this.draftModelToken;
    this.clearDraftModels();
    for (const item of items) {
      Promise.resolve(decorationTemplate(this.s, item.def)).then((template) => {
        if (token !== this.draftModelToken || !template) return;
        const node = instantiateModel(this.s, template, 'hologramDraft');
        if (!node) return;
        this.draftModelMaterials.push(...this.hologramMaterials(node, item.remove));
        node.position.set(item.x, item.y, item.z);
        node.rotation.y = item.yaw;
        node.scaling.setAll(item.scale);
        node.setEnabled(true);
        this.draftModels.push(node);
      });
    }
  }

  clearDraftModels() {
    for (const node of this.draftModels) node.dispose(false, false);
    this.draftModels = [];
    for (const mat of this.draftModelMaterials) mat.dispose();
    this.draftModelMaterials = [];
  }

  disposeHologram() {
    for (const node of this.hologramNodes) node.dispose(false, false);
    this.hologramNodes = [];
    for (const mat of this.hologramOwnMaterials) mat.dispose();
    this.hologramOwnMaterials = [];
  }

  paintHologram(mat, erase) {
    const base = erase ? HOLO_ERASE : HOLO_VALID;
    mat.diffuseColor = base.clone();
    mat.emissiveColor = erase ? base.clone() : base.scale(0.6);
    mat.alpha = erase ? HOLOGRAM_ERASE_ALPHA : HOLOGRAM_ALPHA;
    mat.zOffset = erase ? HOLOGRAM_ERASE_OFFSET : 0;
  }

  tintHologram(isValid) {
    this.hologramValid = isValid;
    for (const mat of this.hologramOwnMaterials) this.paintHologram(mat, !isValid);
  }

  hideHologram() {
    this.hologramVisible = false;
    for (const node of this.hologramNodes) node.setEnabled(false);
  }

  setOverlaysOnTop(on) {
    this.overlayGroup = on ? 1 : 0;
  }

  showBrush(cells, surfaceAt, erasing) {
    if (!this.brushMaster) {
      this.brushMaster = MeshBuilder.CreateGround('brushMaster', {
        width: CELL_SIZE * 0.92,
        height: CELL_SIZE * 0.92,
      }, this.s);
      const mat = new StandardMaterial('brushMasterMat', this.s);
      mat.diffuseColor = HOLO_VALID.clone();
      mat.emissiveColor = new Color3(0.3, 0.78, 0.65);
      mat.alpha = 0.42;
      this.brushMaster.material = mat;
      this.brushMaster.isPickable = false;
      this.brushMaster.setEnabled(false);
      this.brushMaterial = mat;
      this.brushInstances = [];
    }
    this.brushMaster.renderingGroupId = this.overlayGroup;
    const tint = erasing ? HOLO_INVALID.clone() : HOLO_VALID.clone();
    const glow = erasing ? new Color3(0.72, 0.24, 0.2) : new Color3(0.3, 0.78, 0.65);
    this.brushMaterial.diffuseColor = tint;
    this.brushMaterial.emissiveColor = glow;

    for (const inst of this.brushInstances) inst.dispose();
    this.brushInstances = [];

    let first = true;
    for (const [cx, cz] of cells) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      const y = surfaceAt(cx, cz) + 0.04;
      if (first) {
        this.brushMaster.position = new Vector3(x, y, z);
        this.brushMaster.setEnabled(true);
        first = false;
        continue;
      }
      const inst = this.brushMaster.createInstance(`brush_${cx}_${cz}`);
      inst.position = new Vector3(x, y, z);
      inst.isPickable = false;
      this.brushInstances.push(inst);
    }
    if (first) this.brushMaster.setEnabled(false);
  }

  showEdges(edges) {
    this.clearEdges();
    if (!edges.length) return;
    const lines = [];
    const colors = [];
    const half = CELL_SIZE / 2;
    for (const edge of edges) {
      const color = new Color4(edge.color[0], edge.color[1], edge.color[2], 1);
      const y = edge.y + EDGE_LIFT;
      const sideX = -edge.dz * half;
      const sideZ = edge.dx * half;
      for (const inset of EDGE_INSETS) {
        const x = edge.cx * CELL_SIZE + edge.dx * (half - inset);
        const z = edge.cz * CELL_SIZE + edge.dz * (half - inset);
        lines.push([new Vector3(x - sideX, y, z - sideZ), new Vector3(x + sideX, y, z + sideZ)]);
        colors.push([color, color]);
      }
    }
    this.edgeLines = MeshBuilder.CreateLineSystem('floorEdgePreview', { lines, colors }, this.s);
    this.edgeLines.isPickable = false;
    this.edgeLines.renderingGroupId = this.overlayGroup;
  }

  clearEdges() {
    if (this.edgeLines) this.edgeLines.dispose();
    this.edgeLines = null;
  }

  showArrows(arrows) {
    this.clearArrows();
    if (!arrows.length) return;
    const lines = [];
    const colors = [];
    const point = (x, y, z) => new Vector3(x, y, z);
    for (const arrow of arrows) {
      const color = new Color4(arrow.color[0], arrow.color[1], arrow.color[2], 1);
      const x = arrow.cx * CELL_SIZE;
      const z = arrow.cz * CELL_SIZE;
      const y = arrow.y + ARROW_LIFT;
      const sideX = -arrow.dz;
      const sideZ = arrow.dx;
      const tail = point(x - arrow.dx * ARROW_HALF, y, z - arrow.dz * ARROW_HALF);
      const tip = point(x + arrow.dx * ARROW_HALF, y, z + arrow.dz * ARROW_HALF);
      const backX = tip.x - arrow.dx * ARROW_HEAD;
      const backZ = tip.z - arrow.dz * ARROW_HEAD;
      lines.push([tail, tip]);
      lines.push([tip, point(backX + sideX * ARROW_HEAD * 0.8, y, backZ + sideZ * ARROW_HEAD * 0.8)]);
      lines.push([tip, point(backX - sideX * ARROW_HEAD * 0.8, y, backZ - sideZ * ARROW_HEAD * 0.8)]);
      colors.push([color, color], [color, color], [color, color]);
      if (!arrow.source) continue;
      const ring = [];
      for (let step = 0; step <= ARROW_RING_STEPS; step += 1) {
        const angle = (step / ARROW_RING_STEPS) * Math.PI * 2;
        ring.push(point(x + Math.cos(angle) * ARROW_RING, y, z + Math.sin(angle) * ARROW_RING));
      }
      lines.push(ring);
      colors.push(ring.map(() => color));
    }
    this.arrowLines = MeshBuilder.CreateLineSystem('flowArrows', { lines, colors }, this.s);
    this.arrowLines.isPickable = false;
    this.arrowLines.renderingGroupId = this.overlayGroup;
  }

  clearArrows() {
    if (this.arrowLines) this.arrowLines.dispose();
    this.arrowLines = null;
  }

  clearBrush() {
    for (const inst of this.brushInstances || []) inst.dispose();
    this.brushInstances = [];
    if (this.brushMaster) this.brushMaster.setEnabled(false);
  }

  showHoverCell(cx, cz, surfaceAt, span = 1, erasing = false) {
    if (!this.hoverMaster) {
      this.hoverMaster = MeshBuilder.CreateGround('hoverCellMaster', {
        width: CELL_SIZE * 0.96,
        height: CELL_SIZE * 0.96,
      }, this.s);
      const mat = new StandardMaterial('hoverCellMat', this.s);
      mat.disableLighting = true;
      mat.alpha = 0.42;
      this.hoverMaster.material = mat;
      this.hoverMaster.isPickable = false;
      this.hoverMaster.setEnabled(false);
      this.hoverMaterial = mat;
    }
    this.hoverMaster.renderingGroupId = this.overlayGroup;
    this.hoverMaterial.diffuseColor = erasing ? new Color3(1, 0.5, 0.45) : new Color3(0.78, 0.96, 1);
    this.hoverMaterial.emissiveColor = erasing ? new Color3(0.95, 0.35, 0.3) : new Color3(0.55, 0.86, 1);
    const y = surfaceAt(cx, cz) + 0.09;
    this.hoverMaster.position = new Vector3(cx * CELL_SIZE, y, cz * CELL_SIZE);
    const size = Math.max(1, Math.round(Number(span) || 1));
    this.hoverMaster.scaling.set(size, 1, size);
    this.hoverMaster.setEnabled(true);
  }

  clearHoverCell() {
    if (this.hoverMaster) this.hoverMaster.setEnabled(false);
  }

  showCreatureRadius(cx, cz, radiusMeters, surfaceAt, kind = 'roam') {
    const radius = Number(radiusMeters);
    if (!Number.isFinite(radius) || radius <= 0) {
      this.clearCreatureRadius();
      return;
    }
    if (!this.radiusDisc) {
      this.radiusDisc = MeshBuilder.CreateDisc('creatureRadiusDisc', { radius: 1, tessellation: 64 }, this.s);
      const mat = new StandardMaterial('creatureRadiusMat', this.s);
      mat.disableLighting = true;
      mat.backFaceCulling = false;
      mat.alpha = 0.14;
      this.radiusDisc.material = mat;
      this.radiusDisc.isPickable = false;
      this.radiusDisc.rotation.x = Math.PI / 2;
      this.radiusDisc.setEnabled(false);
      this.radiusMaterial = mat;
      const points = [];
      for (let step = 0; step <= CREATURE_RADIUS_STEPS; step += 1) {
        const angle = (step / CREATURE_RADIUS_STEPS) * Math.PI * 2;
        points.push(new Vector3(Math.cos(angle), 0, Math.sin(angle)));
      }
      this.radiusRing = MeshBuilder.CreateLines('creatureRadiusRing', { points }, this.s);
      this.radiusRing.isPickable = false;
      this.radiusRing.setEnabled(false);
    }
    const notice = kind === 'notice';
    this.radiusMaterial.diffuseColor = notice ? CREATURE_RADIUS_NOTICE : CREATURE_RADIUS_ROAM;
    this.radiusMaterial.emissiveColor = notice ? CREATURE_RADIUS_NOTICE_RING : CREATURE_RADIUS_ROAM_RING;
    this.radiusRing.color = notice ? CREATURE_RADIUS_NOTICE_RING : CREATURE_RADIUS_ROAM_RING;
    const y = surfaceAt(cx, cz) + CREATURE_RADIUS_LIFT;
    this.radiusDisc.position.set(cx * CELL_SIZE, y, cz * CELL_SIZE);
    this.radiusDisc.scaling.set(radius, radius, 1);
    this.radiusDisc.setEnabled(true);
    this.radiusRing.position.set(cx * CELL_SIZE, y + 0.002, cz * CELL_SIZE);
    this.radiusRing.scaling.set(radius, 1, radius);
    this.radiusRing.setEnabled(true);
  }

  clearCreatureRadius() {
    if (this.radiusDisc) this.radiusDisc.setEnabled(false);
    if (this.radiusRing) this.radiusRing.setEnabled(false);
  }

  showZones(groups, surfaceAt) {
    if (!this.zonesMasters.length) {
      for (let slot = 0; slot < ZONE_SLOTS; slot++) {
        const master = MeshBuilder.CreateGround(`zonesMaster_${slot}`, {
          width: CELL_SIZE * 0.9,
          height: CELL_SIZE * 0.9,
        }, this.s);
        const mat = new StandardMaterial(`zonesMaterial_${slot}`, this.s);
        mat.disableLighting = true;
        master.material = mat;
        master.isPickable = false;
        master.setEnabled(false);
        this.zonesMasters[slot] = master;
        this.zonesMaterials[slot] = mat;
        this.zonesPool[slot] = [];
      }
    }

    for (const master of this.zonesMasters) {
      master.setEnabled(false);
      master.renderingGroupId = this.overlayGroup;
    }
    for (const pool of this.zonesPool) {
      for (const inst of pool) inst.setEnabled(false);
    }

    let slot = 0;
    for (const group of groups || []) {
      const cells = group.cells || [];
      if (!cells.length) continue;

      const master = this.zonesMasters[slot];
      const mat = this.zonesMaterials[slot];
      const pool = this.zonesPool[slot];
      if (!master) break;

      mat.diffuseColor = group.color;
      mat.emissiveColor = group.glow;
      mat.alpha = group.alpha === undefined ? 0.38 : group.alpha;

      let used = 0;
      let masterUsed = false;
      for (const [cx, cz] of cells) {
        const x = cx * CELL_SIZE;
        const z = cz * CELL_SIZE;
        const y = typeof group.yAt === 'function' ? group.yAt(cx, cz) : surfaceAt(cx, cz) + group.lift;
        if (!masterUsed) {
          master.position = new Vector3(x, y, z);
          master.setEnabled(true);
          masterUsed = true;
          continue;
        }
        if (used >= pool.length) {
          const inst = master.createInstance(`zone_${slot}_${pool.length}`);
          inst.isPickable = false;
          pool.push(inst);
        }
        const inst = pool[used];
        inst.position = new Vector3(x, y, z);
        inst.setEnabled(true);
        used++;
      }
      slot++;
    }
  }

  showDraftCells(cells, surfaceAt, mode = 'add') {
    const remove = mode === 'remove';
    if (!this.draftLinesAdd) {
      this.draftLinesAdd = MeshBuilder.CreateLines('draftEdgeAdd', {
        points: this.cellSquare(),
      }, this.s);
      this.draftLinesAdd.color = new Color3(0.75, 1, 0.95);
      this.draftLinesAdd.alpha = 1;
      this.draftLinesAdd.isPickable = false;
      this.draftLinesAdd.setEnabled(false);
      this.draftAddPool = [];
      this.draftLinesRemove = MeshBuilder.CreateLines('draftEdgeRemove', {
        points: this.cellSquare(),
      }, this.s);
      this.draftLinesRemove.color = new Color3(1, 0.35, 0.3);
      this.draftLinesRemove.alpha = 1;
      this.draftLinesRemove.isPickable = false;
      this.draftLinesRemove.setEnabled(false);
      this.draftRemovePool = [];
    }

    const master = remove ? this.draftLinesRemove : this.draftLinesAdd;
    const pool = remove ? this.draftRemovePool : this.draftAddPool;
    for (const line of pool) line.setEnabled(false);
    let used = 0;
    let masterUsed = false;

    for (const [cx, cz] of cells || []) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      const y = surfaceAt(cx, cz) + 0.07;
      if (!masterUsed) {
        master.position = new Vector3(x, y, z);
        master.setEnabled(true);
        masterUsed = true;
        continue;
      }
      if (used >= pool.length) {
        const line = master.clone(`${remove ? 'draftRemove' : 'draftAdd'}_${pool.length}`);
        line.isPickable = false;
        pool.push(line);
      }
      const line = pool[used];
      line.position = new Vector3(x, y, z);
      line.setEnabled(true);
      used++;
    }

    if (!masterUsed) master.setEnabled(false);
  }

  clearDraftCells() {
    for (const line of this.draftAddPool || []) line.setEnabled(false);
    for (const line of this.draftRemovePool || []) line.setEnabled(false);
    if (this.draftLinesAdd) this.draftLinesAdd.setEnabled(false);
    if (this.draftLinesRemove) this.draftLinesRemove.setEnabled(false);
  }

  cellSquare() {
    const h = CELL_SIZE * 0.45;
    return [
      new Vector3(-h, 0, -h),
      new Vector3(h, 0, -h),
      new Vector3(h, 0, h),
      new Vector3(-h, 0, h),
      new Vector3(-h, 0, -h),
    ];
  }

  showDraftOutline(cells, surfaceAt) {
    this.clearDraftOutline();
    const list = Array.isArray(cells) ? cells : [];
    if (!list.length) return;
    const marked = new Set(list.map(([cx, cz]) => `${cx},${cz}`));
    const half = CELL_SIZE / 2;
    const lines = [];
    const addEdge = (cx, cz, fromX, fromZ, toX, toZ) => {
      const y = surfaceAt(cx, cz) + OUTLINE_LIFT;
      lines.push([
        new Vector3(cx * CELL_SIZE + fromX * half, y, cz * CELL_SIZE + fromZ * half),
        new Vector3(cx * CELL_SIZE + toX * half, y, cz * CELL_SIZE + toZ * half),
      ]);
    };
    for (const [cx, cz] of list) {
      if (!marked.has(`${cx},${cz - 1}`)) addEdge(cx, cz, -1, -1, 1, -1);
      if (!marked.has(`${cx},${cz + 1}`)) addEdge(cx, cz, -1, 1, 1, 1);
      if (!marked.has(`${cx - 1},${cz}`)) addEdge(cx, cz, -1, -1, -1, 1);
      if (!marked.has(`${cx + 1},${cz}`)) addEdge(cx, cz, 1, -1, 1, 1);
    }
    if (!lines.length) return;
    const mesh = MeshBuilder.CreateLineSystem('draftOutline', { lines }, this.s);
    mesh.color = new Color3(0.75, 1, 0.95);
    mesh.alpha = 1;
    mesh.alphaIndex = 3;
    mesh.isPickable = false;
    this.draftOutline = mesh;
  }

  clearDraftOutline() {
    if (this.draftOutline && !this.draftOutline.isDisposed()) this.draftOutline.dispose(false, false);
    this.draftOutline = null;
  }

  clearZones() {
    for (const master of this.zonesMasters || []) master.setEnabled(false);
    for (const pool of this.zonesPool || []) {
      for (const inst of pool) inst.setEnabled(false);
    }
  }
}