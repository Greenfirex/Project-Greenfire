// Oheň v táboráku — široký nízký plamen, který se po zapálení postupně rozhořívá.
// Drží jen částice, světlo a míru rozhoření; kde táborák stojí, mu řekne scéna.
import '@babylonjs/core/Particles/particleSystem';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { fireParticleTexture, fireLayer } from './fireParticles.js';

const LIT_SECONDS = 7;
const SPUTTER_SECONDS = 1.1;
const SPUTTER_LEVEL = 0.35;
const LIGHT_COLOR = new Color3(1, 0.58, 0.22);
const LIGHT_DAY = 0.9;
const LIGHT_NIGHT = 4.0;
const LIGHT_RANGE = 16;
const LIGHT_OFFSET_Y = 0.75;
const SHADOW_SIZE = 512;
const SHADOW_BIAS = 0.006;
const SHADOW_NEAR = 0.05;
const SHADOW_REFRESH_SECONDS = 1.5;
const GLOW_STRENGTH = 0.9;
const GLOW_HOT = 0.28;
const FLICKER_INTERVAL = 0.12;

const CORE = {
  boxHeight: 0.03,
  capacity: 260,
  rate: 110,
  size: [0.14, 0.26],
  life: [0.28, 0.45],
  rise: [0.4, 0.7],
  spread: 0.11,
  drift: 0.12,
  colors: [[1, 0.96, 0.68], [1, 0.82, 0.32], [0.9, 0.3, 0.05]],
};

const TONGUE = {
  boxHeight: 0.03,
  capacity: 150,
  rate: 34,
  size: [0.22, 0.4],
  life: [0.45, 0.8],
  rise: [0.55, 0.95],
  spread: 0.07,
  drift: 0.16,
  colors: [[1, 0.75, 0.25], [1, 0.4, 0.06], [0.35, 0.08, 0.02]],
};

const SPARKS = {
  boxHeight: 0.03,
  capacity: 40,
  rate: 4,
  size: [0.03, 0.06],
  life: [0.7, 1.3],
  rise: [0.9, 1.6],
  spread: 0.06,
  drift: 0.35,
  colors: [[1, 0.9, 0.5], [1, 0.55, 0.15], [0.5, 0.15, 0.05]],
};

const IGNITE = {
  boxHeight: 0.03,
  capacity: 30,
  rate: 0,
  size: [0.03, 0.07],
  life: [0.18, 0.42],
  rise: [1.2, 2.2],
  spread: 0.3,
  drift: 0.6,
  colors: [[1, 0.95, 0.7], [1, 0.7, 0.2], [0.55, 0.15, 0.03]],
};

export default class CampfireFire {

  constructor(scene) {
    this.s = scene;
    this.emitter = new TransformNode('campfireEmitter', scene);
    this.emitter.setEnabled(false);
    this.texture = fireParticleTexture(scene, 'campfireParticleTexture');
    this.layers = [
      fireLayer(scene, 'campfireCore', this.emitter, this.texture, CORE, new Vector3(0, 0.6, 0)),
      fireLayer(scene, 'campfireTongue', this.emitter, this.texture, TONGUE, new Vector3(0, 0.55, 0)),
      fireLayer(scene, 'campfireSparks', this.emitter, this.texture, SPARKS, new Vector3(0, -0.25, 0)),
    ];
    this.layers[2].minEmitPower = 1.1;
    this.layers[2].maxEmitPower = 1.9;
    this.igniteSparks = fireLayer(scene, 'campfireIgnite', this.emitter, this.texture, IGNITE, new Vector3(0, 0.8, 0));
    this.light = new PointLight('campfireLight', new Vector3(0, LIGHT_OFFSET_Y, 0), scene);
    this.light.diffuse = LIGHT_COLOR;
    this.light.specular = Color3.Black();
    this.light.radius = 0.05;
    this.light.intensity = 0;
    this.light.range = LIGHT_RANGE;
    this.light.parent = this.emitter;
    this.light.shadowMinZ = SHADOW_NEAR;
    this.light.shadowMaxZ = LIGHT_RANGE;
    this.shadows = new ShadowGenerator(SHADOW_SIZE, this.light);
    this.shadows.usePoissonSampling = true;
    this.shadows.bias = SHADOW_BIAS;
    this.shadows.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.shadowTimer = 0;
    this.terrain = [];
    this.heat = 0;
    this.flickerTimer = FLICKER_INTERVAL;
    this.flicker = 1;
    this.dayness = 1;
    this.scale = 1;
    this.sputter = 0;
    this.spread = [CORE.spread, TONGUE.spread, SPARKS.spread];
  }

  place(x, y, z) {
    this.emitter.position = new Vector3(x, y, z);
    this.emitter.setEnabled(true);
    this.emit(false);
    this.fitTerrain();
  }

  setTerrain(surfaces) {
    this.terrain = surfaces;
    this.fitTerrain();
  }

  fitTerrain() {
    const fire = this.emitter.position;
    const near = [];
    const far = [];
    for (const mesh of this.terrain) {
      mesh.computeWorldMatrix(true);
      const { centerWorld, radiusWorld } = mesh.getBoundingInfo().boundingSphere;
      (Vector3.Distance(centerWorld, fire) <= LIGHT_RANGE + radiusWorld ? near : far).push(mesh);
    }
    this.light.excludedMeshes = far;
    const map = this.shadows.getShadowMap();
    map.renderList = near.filter((mesh) => mesh.metadata && mesh.metadata.volume);
    map.resetRefreshCounter();
  }

  ignite() {
    this.heat = Math.max(this.heat, 0.02);
    this.sputter = SPUTTER_SECONDS;
    this.igniteSparks.manualEmitCount = 22;
    this.emit(true);
  }

  shutdown() {
    this.heat = 0;
    this.sputter = 0;
    this.emit(false);
    this.light.intensity = 0;
  }

  emit(on) {
    for (const system of this.layers) {
      if (on && !system.isStarted()) system.start();
      if (!on && system.isStarted()) system.stop();
    }
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, value));
  }

  setScale(value) {
    this.scale = Math.max(0.1, Number(value) || 1);
    this.layers.forEach((system, index) => {
      const spread = this.spread[index] * this.scale;
      system.minEmitBox = new Vector3(-spread, 0, -spread);
      system.maxEmitBox = new Vector3(spread, 0.03 * this.scale, spread);
    });
  }

  update(dt) {
    if (this.heat <= 0) return;
    this.shadowTimer -= dt;
    if (this.shadowTimer <= 0) {
      this.shadowTimer = SHADOW_REFRESH_SECONDS;
      this.shadows.getShadowMap().resetRefreshCounter();
    }
    this.heat = Math.min(1, this.heat + dt / LIT_SECONDS);
    const size = (0.3 + this.heat * 0.7) * this.scale;
    const [core, tongue, sparks] = this.layers;
    core.emitRate = CORE.rate * this.heat;
    core.minSize = CORE.size[0] * size;
    core.maxSize = CORE.size[1] * size;
    tongue.emitRate = TONGUE.rate * this.heat;
    tongue.minSize = TONGUE.size[0] * size;
    tongue.maxSize = TONGUE.size[1] * size;
    sparks.emitRate = SPARKS.rate * this.heat;
    if (this.igniteSparks.manualEmitCount > 0) this.igniteSparks.manualEmitCount = 0;
    if (this.flickerTimer >= FLICKER_INTERVAL) {
      this.flickerTimer = 0;
      this.flicker = 0.75 + Math.random() * 0.4;
    } else {
      this.flickerTimer += dt;
    }
    const base = LIGHT_DAY + (LIGHT_NIGHT - LIGHT_DAY) * (1 - this.dayness);
    let intensity = base * this.heat * this.flicker;
    if (this.sputter > 0) {
      this.sputter = Math.max(0, this.sputter - dt);
      const catchUp = 1 - this.sputter / SPUTTER_SECONDS;
      const blink = 0.35 + Math.random() * 0.45;
      intensity *= SPUTTER_LEVEL + (1 - SPUTTER_LEVEL) * Math.min(1, catchUp + blink * 0.35);
    }
    this.light.intensity = intensity;
  }

  glowStrength() {
    const hot = this.igniteSparks.isStarted() && this.heat > 0 && this.heat < GLOW_HOT ? 1 : this.heat;
    return hot * GLOW_STRENGTH * (this.sputter > 0 ? 0.5 + Math.random() * 0.5 : 1);
  }

  glowMeshes() {
    return [].concat(this.layers, this.igniteSparks);
  }

  dispose() {
    for (const system of this.layers) system.dispose();
    this.igniteSparks.dispose();
    this.shadows.dispose();
    this.light.dispose();
    this.texture.dispose();
    this.emitter.dispose();
    this.layers.length = 0;
  }
}
