// Stavba strojů — položení modelu na buňku, evidence postavených strojů a obnova ze savu.
// Stroj se objeví hned jako box, model z Kenney kitu se doplní, jakmile se načte.
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, cellKey } from '../utils/gridMath.js';
import { getMachine } from '../data/catalogs/machines.js';
import { loadModel, instantiateModel } from '../utils/assetLoader.js';

export default class BuildSystem {

  constructor(scene) {
    this.s = scene;
    this.machines = new Map();
    this.nextId = 1;
    this.onMachineReady = null;
  }

  isOccupied(cx, cz) {
    return this.machines.has(cellKey(cx, cz));
  }

  canBuild(cx, cz) {
    if (this.isOccupied(cx, cz)) return false;
    const limit = 13;
    return cx >= -limit && cx <= limit && cz >= -limit && cz <= limit;
  }

  build(machineKey, cx, cz) {
    if (!this.canBuild(cx, cz)) return null;
    const def = getMachine(machineKey);
    if (!def) return null;

    const { x, z } = cellToWorldCoords(cx, cz);
    const mesh = this.createPlaceholderMesh(def, machineKey, cx, cz);
    mesh.position = new Vector3(x, def.height / 2, z);

    const record = {
      id: this.nextId++,
      type: machineKey,
      cx,
      cz,
      mesh,
      node: null,
    };
    this.machines.set(cellKey(cx, cz), record);

    if (def.model) this.attachModel(record, def);
    return record;
  }

  async attachModel(record, def) {
    const template = await loadModel(this.s, def.model);
    if (!template) return;
    if (this.machines.get(cellKey(record.cx, record.cz)) !== record) return;

    const node = instantiateModel(this.s, template, `model_${record.id}`);
    node.position = new Vector3(record.mesh.position.x, 0, record.mesh.position.z);
    record.node = node;
    record.mesh.setEnabled(false);

    if (this.onMachineReady) this.onMachineReady(record, node);
  }

  createPlaceholderMesh(def, machineKey, cx, cz) {
    const w = def.footprint.w * 1.7;
    const d = def.footprint.h * 1.7;
    const mesh = MeshBuilder.CreateBox(`machine_${machineKey}_${cx}_${cz}`, {
      width: w,
      height: def.height,
      depth: d,
    }, this.s);

    const mat = new StandardMaterial(`machineMat_${machineKey}_${cx}_${cz}`, this.s);
    const c = def.color;
    mat.diffuseColor = new Color3(c[0], c[1], c[2]);
    mat.specularColor = new Color3(0.15, 0.15, 0.15);
    mesh.material = mat;
    mesh.isPickable = false;
    return mesh;
  }

  removeAll() {
    for (const record of this.machines.values()) {
      if (record.node) record.node.dispose(false, false);
      record.mesh.material?.dispose();
      record.mesh.dispose();
    }
    this.machines.clear();
    this.nextId = 1;
  }

  serialize() {
    return Array.from(this.machines.values()).map((r) => ({
      type: r.type,
      cx: r.cx,
      cz: r.cz,
    }));
  }

  apply(data) {
    this.removeAll();
    if (!Array.isArray(data)) return;
    for (const entry of data) {
      if (!entry || typeof entry.type !== 'string') continue;
      if (typeof entry.cx !== 'number' || typeof entry.cz !== 'number') continue;
      this.build(entry.type, entry.cx, entry.cz);
    }
  }

  get count() {
    return this.machines.size;
  }
}
