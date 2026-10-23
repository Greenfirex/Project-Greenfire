// Stavba strojů — položení modelu na buňku, rotace, bourání a obnova ze savu.
// Stroj se objeví hned jako box, model z Kenney kitu se doplní, jakmile se načte.
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellToWorldCoords, cellKey } from '../utils/gridMath.js';
import { getMachine } from '../data/catalogs/machines.js';
import { loadModel, instantiateModel, whenModelsIdle } from '../utils/assetLoader.js';
import { MACHINE_STATE_DEFAULT } from '../data/catalogs/saveSchema.js';

function sanitizeCounts(source) {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const [key, value] of Object.entries(source)) {
    if (typeof key !== 'string' || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    result[key] = value;
  }
  return result;
}

export function normalizeMachineState(data) {
  const progress = data && typeof data.progress === 'number' && Number.isFinite(data.progress)
    ? data.progress
    : MACHINE_STATE_DEFAULT.progress;
  return {
    input: sanitizeCounts(data && data.input),
    output: sanitizeCounts(data && data.output),
    progress: Math.min(1, Math.max(0, progress)),
  };
}

export default class BuildSystem {

  constructor(scene) {
    this.s = scene;
    this.machines = new Map();
    this.nextId = 1;
    this.onMachineReady = null;
    this.markedCell = null;
    this.blockedTest = null;
    this.heightTest = null;
    this.rangeTest = null;
  }

  isOccupied(cx, cz) {
    return this.machines.has(cellKey(cx, cz));
  }

  getAt(cx, cz) {
    return this.machines.get(cellKey(cx, cz)) || null;
  }

  canBuild(cx, cz) {
    if (this.isOccupied(cx, cz)) return false;
    if (this.blockedTest && this.blockedTest(cx, cz)) return false;
    if (this.heightTest && this.heightTest(cx, cz)) return false;
    if (this.rangeTest && !this.rangeTest(cx, cz)) return false;
    return true;
  }

  build(machineKey, cx, cz, rotation = 0, state = null) {
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
      rotation: normalizeRotation(rotation),
      state: normalizeMachineState(state),
      mesh,
      node: null,
    };
    this.applyRotation(record);
    this.machines.set(cellKey(cx, cz), record);

    if (def.model) this.attachModel(record, def);
    return record;
  }

  rotate(cx, cz) {
    const record = this.getAt(cx, cz);
    if (!record) return null;
    record.rotation = normalizeRotation(record.rotation + 1);
    this.applyRotation(record);
    return record;
  }

  demark() {
    const cx = this.markedCell ? this.markedCell.cx : null;
    const cz = this.markedCell ? this.markedCell.cz : null;
    this.markedCell = null;
    return cx === null ? null : { cx, cz };
  }

  toggleMark(cx, cz) {
    const record = this.getAt(cx, cz);
    if (!record) {
      this.markedCell = null;
      return { marked: false, removed: null };
    }

    const existing = this.markedCell;
    if (existing && existing.cx === cx && existing.cz === cz) {
      const removed = this.removeAt(cx, cz);
      this.markedCell = null;
      return { marked: false, removed };
    }

    this.markedCell = { cx, cz };
    return { marked: true, removed: null };
  }

  applyRotation(record) {
    const angle = (Math.PI / 2) * record.rotation;
    record.mesh.rotation.y = angle;
    if (record.node) record.node.rotation.y = angle;
  }

  async attachModel(record, def) {
    if (this.s.isLoading) await whenModelsIdle();
    const template = await loadModel(this.s, def.model);
    if (!template) {
      console.error(
        `[build] Stroj "${record.type}" na buňce ${record.cx},${record.cz} `
        + `nemá model (${def.model}) — zůstává placeholder box.`,
      );
      return;
    }
    if (this.machines.get(cellKey(record.cx, record.cz)) !== record) return;

    const node = instantiateModel(this.s, template, `model_${record.id}`);
    node.position = new Vector3(record.mesh.position.x, 0, record.mesh.position.z);
    record.node = node;
    this.applyRotation(record);
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

  removeAt(cx, cz) {
    const key = cellKey(cx, cz);
    const record = this.machines.get(key);
    if (!record) return null;
    this.machines.delete(key);
    if (this.markedCell && this.markedCell.cx === cx && this.markedCell.cz === cz) {
      this.markedCell = null;
    }
    this.disposeRecord(record);
    return record;
  }

  disposeRecord(record) {
    if (record.node) record.node.dispose(false, false);
    if (record.mesh.material) record.mesh.material.dispose();
    record.mesh.dispose();
  }

  removeAll() {
    for (const record of this.machines.values()) this.disposeRecord(record);
    this.machines.clear();
    this.markedCell = null;
    this.nextId = 1;
  }

  serialize() {
    return Array.from(this.machines.values()).map((r) => ({
      type: r.type,
      cx: r.cx,
      cz: r.cz,
      rotation: r.rotation,
      state: { ...r.state, input: { ...r.state.input }, output: { ...r.state.output } },
    }));
  }

  apply(data) {
    this.removeAll();
    if (!Array.isArray(data)) return;
    for (const entry of data) {
      if (!entry || typeof entry.type !== 'string') continue;
      if (typeof entry.cx !== 'number' || typeof entry.cz !== 'number') continue;
      this.build(entry.type, entry.cx, entry.cz, entry.rotation, entry.state);
    }
  }

  registerState(key, provider) {
    this.saveKey = key;
    this.savedState = provider;
  }

  defaultState() {
    return [];
  }

  get count() {
    return this.machines.size;
  }
}

function normalizeRotation(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const step = Math.round(value) % 4;
  return step < 0 ? step + 4 : step;
}