// Oheň na pochodni v ruce — částečky plamene ze špičky pochodně a blikající oranžový zdroj světla (skutečné světlo
// přidělí systém světel ohně). Ve dne jen slabounce přisvětluje, v noci, v jeskyni a ve stavbě svítí naplno;
// bez pochodně v ruce zhasne.
import '@babylonjs/core/Particles/webgl2ParticleSystem';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { fireParticleTexture, fireLayer } from './fireParticles.js';
import { createFlicker, stepFlicker } from '../utils/flicker.js';

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
const FLICKER_INTERVAL = 0.12;
const FLICKER_RANGE = [0.8, 1.1];
const LIGHT_COLOR = new Color3(1, 0.6, 0.25);
const LIGHT_DAY = 0.24;
const LIGHT_NIGHT = 1.8;
const LIGHT_RANGE = 9;
const LIGHT_OFFSET_Y = 0.1;

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
    this.source = { x: 0, y: 0, z: 0, intensity: 0, color: LIGHT_COLOR, range: LIGHT_RANGE, shadow: 'none', level: null, refresh: 0, dirty: false, own: null };
    this.flicker = createFlicker(FLICKER_RANGE[0], FLICKER_RANGE[1], FLICKER_INTERVAL);
    this.dayness = 1;
    this.indoors = false;
    this.visible = false;
    this.detach();
  }

  attach(toolNode) {
    if (!toolNode) return;
    this.emitter.parent = toolNode;
    this.emitter.position = FLAME_SPOT.clone();
    for (const system of this.layers) system.start();
    this.visible = true;
  }

  detach() {
    this.visible = false;
    for (const system of this.layers) system.stop();
    this.emitter.parent = null;
    this.emitter.position = Vector3.Zero();
    this.source.intensity = 0;
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, value));
  }

  setIndoors(on) {
    this.indoors = Boolean(on);
  }

  update(dt) {
    if (!this.visible) return;
    const flicker = stepFlicker(this.flicker, dt);
    const dayness = this.indoors ? 0 : this.dayness;
    const strength = LIGHT_DAY + (LIGHT_NIGHT - LIGHT_DAY) * (1 - dayness);
    const at = this.emitter.getAbsolutePosition();
    this.source.x = at.x;
    this.source.y = at.y + LIGHT_OFFSET_Y;
    this.source.z = at.z;
    this.source.intensity = strength * flicker;
  }

  dispose() {
    for (const system of this.layers) system.dispose();
    this.texture.dispose();
    this.emitter.dispose();
  }
}
