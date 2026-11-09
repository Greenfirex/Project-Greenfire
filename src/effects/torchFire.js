// Oheň na pochodni v ruce — částečky plamene ze špičky pochodně a oranžové světlo, které bliká.
// Ve dne jen slabounce přisvětluje, v noci svítí naplno; bez pochodně v ruce oheň i světlo zhasnou.
import '@babylonjs/core/Particles/webgl2ParticleSystem';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { fireParticleTexture, fireLayer } from './fireParticles.js';

const FLAME_SPOT = new Vector3(0, 0.78, 0);
const FLAME_GRAVITY = new Vector3(0, 0.35, 0);
const CORE = {
  boxHeight: 0.02,
  capacity: 300,
  rate: 110,
  size: [0.05, 0.09],
  life: [0.2, 0.3],
  rise: [0.5, 0.9],
  spread: 0.05,
  drift: 0.16,
  colors: [[1, 0.97, 0.72], [1, 0.8, 0.32], [1, 0.42, 0.07]],
};
const TONGUE = {
  boxHeight: 0.02,
  capacity: 170,
  rate: 36,
  size: [0.1, 0.2],
  life: [0.4, 0.68],
  rise: [0.65, 1.05],
  spread: 0.035,
  drift: 0.08,
  colors: [[1, 0.85, 0.35], [1, 0.52, 0.1], [0.5, 0.14, 0.03]],
};
const FLICKER_INTERVAL = 0.09;
const LIGHT_COLOR = new Color3(1, 0.6, 0.25);
const LIGHT_DAY = 0.24;
const LIGHT_NIGHT = 1.8;
const LIGHT_RANGE = 9;
const LIGHT_OFFSET_Y = 0.1;
const GLOW_STRENGTH = 0.55;

function startedLayer(scene, name, emitter, texture, cfg) {
  const system = fireLayer(scene, name, emitter, texture, cfg, FLAME_GRAVITY.clone());
  system.start();
  return system;
}

export default class TorchFire {

  constructor(scene) {
    this.s = scene;
    this.emitter = new TransformNode('torchFlameEmitter', scene);
    this.texture = fireParticleTexture(scene, 'torchParticleTexture');
    this.layers = [
      startedLayer(scene, 'torchFireCore', this.emitter, this.texture, CORE),
      startedLayer(scene, 'torchFireTongue', this.emitter, this.texture, TONGUE),
    ];
    this.light = new PointLight('torchLight', new Vector3(0, LIGHT_OFFSET_Y, 0), scene);
    this.light.diffuse = LIGHT_COLOR;
    this.light.specular = Color3.Black();
    this.light.radius = 0.05;
    this.light.intensity = 0;
    this.light.range = LIGHT_RANGE;
    this.light.parent = this.emitter;
    this.flickerTimer = FLICKER_INTERVAL;
    this.flicker = 1;
    this.dayness = 1;
    this.visible = false;
    this.emitter.setEnabled(false);
  }

  attach(toolNode) {
    if (!toolNode) return;
    this.emitter.parent = toolNode;
    this.emitter.position = FLAME_SPOT.clone();
    this.emitter.setEnabled(true);
    this.visible = true;
  }

  detach() {
    this.visible = false;
    this.emitter.setEnabled(false);
    this.light.intensity = 0;
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, value));
  }

  update(dt) {
    if (!this.visible) return;
    if (this.flickerTimer >= FLICKER_INTERVAL) {
      this.flickerTimer = 0;
      this.flicker = 0.7 + Math.random() * 0.45;
    } else {
      this.flickerTimer += dt;
    }
    const strength = LIGHT_DAY + (LIGHT_NIGHT - LIGHT_DAY) * (1 - this.dayness);
    this.light.intensity = strength * this.flicker;
  }

  glowStrength() {
    if (!this.visible) return 0;
    return GLOW_STRENGTH * this.flicker;
  }

  glowMeshes() {
    return this.layers.slice();
  }

  dispose() {
    for (const system of this.layers) system.dispose();
    this.light.dispose();
    this.texture.dispose();
    this.emitter.dispose();
  }
}
