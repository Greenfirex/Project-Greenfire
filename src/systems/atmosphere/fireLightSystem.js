// Světla ohně — pochodeň, táboráky i lucerny jsou jen zdroje (poloha, barva, síla, dosah); skutečná světla jsou dvě
// a hra je přiděluje nejbližším hořícím zdrojům kolem postavy. Jedno vrhá stín (táborák, lucerna), druhé ne (pochodeň),
// takže žádný materiál nemá víc než čtyři světla (obloha, slunce a tato dvě). Přechod mezi zdroji je plynulý.
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { bothSidesMaterial } from '../../utils/bothSidesMaterial.js';

const SLOT_FADE_SECONDS = 0.25;
const REACH_MARGIN = 4;
const SHADOW_SIZE = 512;
const SHADOW_BIAS = 0.006;
const SHADOW_NEAR = 0.05;
const SHADOWED_LIGHTS = 1;

export default class FireLightSystem {

  constructor(scene) {
    this.s = scene;
    this.sources = new Set();
    this.castersNear = null;
    this.stub = new Mesh('fireShadowStub', scene);
    this.stub.isPickable = false;
    this.stub.setEnabled(false);
    this.slots = [];
    for (let k = 0; k < SHADOWED_LIGHTS; k += 1) this.slots.push(this.createSlot(`fireLightShadow${k}`, true));
    this.slots.push(this.createSlot('fireLightPlain', false));
  }

  createSlot(name, shadowed) {
    const light = new PointLight(name, Vector3.Zero(), this.s);
    light.diffuse = new Color3(1, 0.6, 0.25);
    light.specular = Color3.Black();
    light.radius = 0.05;
    light.intensity = 0;
    const slot = { light, shadowed, source: null, weight: 0, timer: 0, shadows: null };
    if (!shadowed) {
      light.shadowEnabled = false;
      return slot;
    }
    light.shadowMinZ = SHADOW_NEAR;
    const shadows = new ShadowGenerator(SHADOW_SIZE, light);
    shadows.usePoissonSampling = true;
    shadows.bias = SHADOW_BIAS;
    const map = shadows.getShadowMap();
    map.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    map.renderList = [this.stub];
    let woken = [];
    map.onBeforeRenderObservable.add(() => {
      woken = map.renderList.filter((mesh) => !mesh.isEnabled() && !mesh.isDisposed() && mesh.metadata && mesh.metadata.building);
      for (const mesh of woken) mesh.setEnabled(true);
    });
    map.onAfterRenderObservable.add(() => {
      for (const mesh of woken) mesh.setEnabled(false);
      woken = [];
    });
    slot.shadows = shadows;
    return slot;
  }

  add(source) {
    if (source) this.sources.add(source);
  }

  remove(source) {
    this.sources.delete(source);
    for (const slot of this.slots) {
      if (slot.source !== source) continue;
      slot.source = null;
      slot.weight = 0;
      slot.light.intensity = 0;
    }
  }

  refreshCasters() {
    for (const slot of this.slots) {
      if (slot.shadowed && slot.source) this.aim(slot);
    }
  }

  update(dt, focus) {
    const { shadowed, plain } = this.choose(focus);
    const shadowSlots = this.slots.filter((slot) => slot.shadowed);
    const targets = shadowSlots.map((slot) => (shadowed.includes(slot.source) ? slot.source : null));
    const rest = shadowed.filter((source) => !targets.includes(source));
    shadowSlots.forEach((slot, index) => this.drive(slot, targets[index] || rest.shift() || null, dt));
    for (const slot of this.slots) {
      if (!slot.shadowed) this.drive(slot, plain, dt);
    }
  }

  choose(focus) {
    if (!focus) return { shadowed: [], plain: null };
    const level = focus.level || 0;
    const near = [...this.sources]
      .filter((source) => source.intensity > 0.001 && (source.level === null || source.level === undefined || source.level === level))
      .map((source) => ({ source, gap: Math.hypot(source.x - focus.x, source.y - focus.y, source.z - focus.z) }))
      .filter((item) => item.gap <= item.source.range + REACH_MARGIN)
      .sort((a, b) => a.gap - b.gap)
      .map((item) => item.source);
    const shadowed = near.filter((source) => source.shadow !== 'none').slice(0, SHADOWED_LIGHTS);
    const plain = near.find((source) => !shadowed.includes(source) && source.shadow === 'none')
      || near.find((source) => !shadowed.includes(source) && source.shadow === 'prefer')
      || null;
    return { shadowed, plain };
  }

  drive(slot, target, dt) {
    const step = Math.max(0, dt) / SLOT_FADE_SECONDS;
    if (slot.source !== target) {
      slot.weight = slot.source ? Math.max(0, slot.weight - step) : 0;
      if (slot.weight <= 0) {
        slot.source = target;
        if (target) this.aim(slot);
      }
    } else if (slot.source) {
      slot.weight = Math.min(1, slot.weight + step);
    }
    const source = slot.source;
    if (!source) {
      slot.light.intensity = 0;
      return;
    }
    slot.light.position.set(source.x, source.y, source.z);
    slot.light.intensity = source.intensity * slot.weight;
    if (!slot.shadowed) return;
    slot.timer -= dt;
    if (source.dirty || (source.refresh > 0 && slot.timer <= 0)) {
      source.dirty = false;
      slot.timer = source.refresh || 0;
      slot.shadows.getShadowMap().resetRefreshCounter();
    }
  }

  aim(slot) {
    const source = slot.source;
    slot.light.diffuse.copyFrom(source.color);
    slot.light.range = source.range;
    if (!slot.shadowed) return;
    slot.light.shadowMaxZ = source.range;
    slot.shadows.setDarkness(source.darkness || 0);
    const map = slot.shadows.getShadowMap();
    const own = source.own || [];
    const casters = (this.castersNear ? this.castersNear(source) : []).filter((mesh) => !own.includes(mesh));
    const bothSides = bothSidesMaterial(this.s);
    for (const mesh of casters) {
      if (mesh.metadata && mesh.metadata.volume) map.setMaterialForRendering(mesh, bothSides);
    }
    map.renderList = [this.stub, ...casters];
    map.resetRefreshCounter();
    slot.timer = source.refresh || 0;
  }
}
