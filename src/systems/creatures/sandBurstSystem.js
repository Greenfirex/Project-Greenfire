// Rozstřik písku, když se tvor vyhrabává ze země nebo se do ní zahrabává.
// Každý výbuch má dvě vrstvy: odlétající zrnka a pomalejší obláček prachu.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { fireParticleTexture } from '../../effects/fireParticles.js';

const POOL = 4;
const GRAINS = {
  capacity: 220,
  burst: 70,
  rate: 160,
  size: [0.05, 0.13],
  life: [0.45, 0.9],
  power: [1.4, 2.6],
  gravity: -9,
  colors: [[0.86, 0.75, 0.53, 1], [0.7, 0.58, 0.4, 1], [0.7, 0.58, 0.4, 0]],
};
const DUST = {
  capacity: 80,
  burst: 22,
  rate: 40,
  size: [0.35, 0.75],
  life: [0.9, 1.6],
  power: [0.3, 0.7],
  gravity: 0.15,
  colors: [[0.88, 0.8, 0.62, 0.42], [0.8, 0.71, 0.54, 0.3], [0.8, 0.71, 0.54, 0]],
};

function color(values) {
  return new Color4(values[0], values[1], values[2], values[3]);
}

export default class SandBurstSystem {

  constructor(scene) {
    this.s = scene;
    this.texture = null;
    this.pool = [];
    this.cursor = 0;
  }

  makeLayer(name, cfg) {
    if (!this.texture) this.texture = fireParticleTexture(this.s, 'sandBurstTexture');
    const system = new ParticleSystem(name, cfg.capacity, this.s);
    system.particleTexture = this.texture;
    system.emitter = new Vector3(0, 0, 0);
    system.color1 = color(cfg.colors[0]);
    system.color2 = color(cfg.colors[1]);
    system.colorDead = color(cfg.colors[2]);
    system.minLifeTime = cfg.life[0];
    system.maxLifeTime = cfg.life[1];
    system.minEmitPower = cfg.power[0];
    system.maxEmitPower = cfg.power[1];
    system.gravity = new Vector3(0, cfg.gravity, 0);
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    system.emitRate = 0;
    system.manualEmitCount = 0;
    system.start();
    return { system, cfg };
  }

  entry() {
    if (this.pool.length < POOL) {
      const index = this.pool.length;
      const item = {
        layers: [this.makeLayer(`sandGrains_${index}`, GRAINS), this.makeLayer(`sandDust_${index}`, DUST)],
        left: 0,
        scale: 1,
      };
      this.pool.push(item);
      return item;
    }
    const item = this.pool[this.cursor % POOL];
    this.cursor += 1;
    return item;
  }

  burst(x, y, z, scale = 1, seconds = 0.5) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    const size = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const item = this.pool.find((entry) => entry.left <= 0) || this.entry();
    item.left = Number.isFinite(seconds) && seconds > 0 ? seconds : 0.5;
    item.scale = size;
    for (const { system, cfg } of item.layers) {
      const spread = 0.35 * size;
      system.emitter.set(x, y, z);
      system.minEmitBox = new Vector3(-spread, 0, -spread);
      system.maxEmitBox = new Vector3(spread, 0.08 * size, spread);
      system.direction1 = new Vector3(-1, 1.6, -1);
      system.direction2 = new Vector3(1, 2.8, 1);
      system.minSize = cfg.size[0] * size;
      system.maxSize = cfg.size[1] * size;
      system.manualEmitCount = Math.max(0, system.manualEmitCount) + Math.round(cfg.burst * size);
    }
  }

  update(dt) {
    const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    if (!seconds) return;
    for (const item of this.pool) {
      if (item.left <= 0) continue;
      item.left = Math.max(0, item.left - seconds);
      for (const layer of item.layers) {
        layer.carry = (layer.carry || 0) + layer.cfg.rate * item.scale * seconds;
        const count = Math.floor(layer.carry);
        layer.carry -= count;
        if (count > 0) layer.system.manualEmitCount = Math.max(0, layer.system.manualEmitCount) + count;
      }
    }
  }
}
