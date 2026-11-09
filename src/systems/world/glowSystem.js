// Světelná záře kolem plamenů — rozzáří jen oheň a jiskry, zbytek scény nechá temný.
// V nastavení se dá vypnout, aby na slabším počítači hra běžela rychleji.
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const INTENSITY = 0.85;
const BLUR = 48;
const TEXTURE_RATIO = 0.5;
const FIRE_COLOR = new Color3(1, 0.55, 0.2);

export default class GlowSystem {

  constructor(scene) {
    this.s = scene;
    this.layer = null;
    this.meshes = [];
    this.entries = [];
    this.retry = [];
    this.wanted = true;
  }

  create() {
    if (this.layer) return this.layer;
    this.layer = new GlowLayer('fireGlow', this.s, {
      blurKernelSize: BLUR,
      mainTextureRatio: TEXTURE_RATIO,
    });
    this.layer.excludeByDefault = true;
    this.layer.intensity = INTENSITY;
    this.layer.customEmissiveColorSelector = (mesh, subMesh, material, result) => {
      const entry = this.entries.find((item) => item.mesh === mesh);
      const strength = entry ? entry.source.glowStrength() : 0;
      result.set(FIRE_COLOR.r, FIRE_COLOR.g, FIRE_COLOR.b, Math.max(0, Math.min(1, strength)));
    };
    return this.layer;
  }

  addSource(source) {
    if (!source) return;
    const partial = source.glowMeshes().some((system) => this.s.getMeshByName(system.id));
    if (!partial) {
      if (this.retry.indexOf(source) < 0) this.retry.push(source);
      return;
    }
    const index = this.retry.indexOf(source);
    if (index >= 0) this.retry.splice(index, 1);
    if (this.entries.some((item) => item.source === source)) return;
    for (const system of source.glowMeshes()) {
      const mesh = this.s.getMeshByName(system.id);
      if (!mesh) continue;
      const existing = this.entries.find((item) => item.mesh === mesh);
      if (existing) {
        existing.source = source;
        continue;
      }
      this.entries.push({ source, mesh });
      this.meshes.push(mesh);
      this.layer.addIncludedOnlyMesh(mesh);
    }
  }

  removeSource(source) {
    const retry = this.retry.indexOf(source);
    if (retry >= 0) this.retry.splice(retry, 1);
    const keep = [];
    for (const item of this.entries) {
      if (item.source !== source) {
        keep.push(item);
        continue;
      }
      this.layer.removeIncludedOnlyMesh(item.mesh);
      this.meshes.splice(this.meshes.indexOf(item.mesh), 1);
    }
    this.entries = keep;
  }

  retryPending() {
    if (!this.retry.length) return;
    for (const source of this.retry.slice()) this.addSource(source);
  }

  setEnabled(value) {
    this.wanted = Boolean(value);
    this.update();
  }

  update() {
    if (!this.layer) return;
    const burning = this.wanted && this.entries.some((item) => item.source.glowStrength() > 0);
    if (this.layer.isEnabled !== burning) this.layer.isEnabled = burning;
  }

  dispose() {
    if (this.layer) this.layer.dispose();
    this.layer = null;
    this.meshes.length = 0;
    this.entries.length = 0;
    this.retry.length = 0;
  }
}
