// Mřížka světa — náhled dekorací a zvýraznění buněk v editoru mapy.
// Podlahu a linky buněk kreslí terrainSystem; tenhle systém řeší jen kurzor.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import '@babylonjs/core/Meshes/Builders/discBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { instantiateModel } from '../../utils/assetLoader.js';
import { decorationTemplate } from '../../utils/decoTemplate.js';

const HOLO_VALID = new Color3(0.35, 0.95, 0.8);
const HOLO_INVALID = new Color3(0.95, 0.38, 0.32);

const HOLOGRAM_ALPHA = 0.45;
const CREATURE_RADIUS_LIFT = 0.06;
const CREATURE_RADIUS_STEPS = 72;
const OUTLINE_LIFT = 0.07;
const SINGLE_ITEM = { offsetX: 0, offsetZ: 0, yaw: 0 };

function speciesOf(def) {
  return def.bush || def.tree || def.rock || def.shell || def.coral || def.flower || def.model || 'kus';
}
const ZONE_SLOTS = 12;


export default class GridSystem {

  constructor(scene) {
    this.s = scene;
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
  }

  showDecorPreview(def, items, cx, cz, topY, rotation = 0) {
    if (!def) return;
    const list = Array.isArray(items) && items.length ? items : [SINGLE_ITEM];
    const key = `deco:${speciesOf(def)}`;
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
      this.hologramOwnMaterials = node.getChildMeshes().map((mesh) => {
        const mat = new StandardMaterial(`hologramMat_${mesh.name}`, this.s);
        const source = mesh.material;
        if (source && source.alphaTexture) mat.opacityTexture = source.alphaTexture;
        else if (source && source.useAlphaFromDiffuseTexture && source.diffuseTexture) mat.opacityTexture = source.diffuseTexture;
        mat.diffuseColor = HOLO_VALID.clone();
        mat.emissiveColor = new Color3(0.21, 0.57, 0.48);
        mat.specularColor = new Color3(0, 0, 0);
        mat.alpha = HOLOGRAM_ALPHA;
        mat.backFaceCulling = false;
        mesh.material = mat;
        mesh.receiveShadows = false;
        return mat;
      });
      this.hologramNodes = [node];
      this.arrangeHologram();
      this.tintHologram(this.hologramValid);
    });
  }

  disposeHologram() {
    for (const node of this.hologramNodes) node.dispose(false, false);
    this.hologramNodes = [];
    for (const mat of this.hologramOwnMaterials) mat.dispose();
    this.hologramOwnMaterials = [];
  }

  tintHologram(isValid) {
    this.hologramValid = isValid;
    const base = isValid ? HOLO_VALID.clone() : HOLO_INVALID.clone();
    for (const mat of this.hologramOwnMaterials) {
      mat.diffuseColor = base;
      mat.emissiveColor = base.scale(0.6);
    }
  }

  hideHologram() {
    this.hologramVisible = false;
    for (const node of this.hologramNodes) node.setEnabled(false);
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

  showCreatureRadius(cx, cz, radiusMeters, surfaceAt) {
    const radius = Number(radiusMeters);
    if (!Number.isFinite(radius) || radius <= 0) {
      this.clearCreatureRadius();
      return;
    }
    if (!this.radiusDisc) {
      this.radiusDisc = MeshBuilder.CreateDisc('creatureRadiusDisc', { radius: 1, tessellation: 64 }, this.s);
      const mat = new StandardMaterial('creatureRadiusMat', this.s);
      mat.diffuseColor = new Color3(1, 0.82, 0.35);
      mat.emissiveColor = new Color3(0.9, 0.68, 0.2);
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
      this.radiusRing.color = new Color3(1, 0.86, 0.4);
      this.radiusRing.isPickable = false;
      this.radiusRing.setEnabled(false);
    }
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

    for (const master of this.zonesMasters) master.setEnabled(false);
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