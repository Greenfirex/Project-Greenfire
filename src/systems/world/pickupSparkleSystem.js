// Třpyt nad věcmi, které jde poblíž hráče sebrat rukou — drobnosti na zemi, truhly i mrtvoly.
// Scéna mu každý snímek dá seznam míst a on nad nimi nechá pomalu stoupat a blikat hvězdičky.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';

const POOL = 8;
const CAPACITY = 40;
const RATE = 5;
const RATE_PER_METER = 3;
const RATE_MAX = 12;
const SIZE = [0.04, 0.08];
const LIFE = [0.7, 1.3];
const RISE = [0.06, 0.2];
const DRIFT = 0.2;
const SPREAD_MIN = 0.12;
const SPREAD_MAX = 0.9;
const LIFT_MIN = 0.25;
const JITTER = 0.04;
const COLORS = [[1, 0.96, 0.8, 1], [1, 0.86, 0.5, 1], [1, 0.8, 0.4, 0]];

function color(values) {
  return new Color4(values[0], values[1], values[2], values[3]);
}

function sparkleTexture(scene) {
  const size = 64;
  const half = size / 2;
  const texture = new DynamicTexture('pickupSparkleTexture', size, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(half, half, 0, half, half, half * 0.45);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.quadraticCurveTo(half, half, size, half);
  ctx.quadraticCurveTo(half, half, half, size);
  ctx.quadraticCurveTo(half, half, 0, half);
  ctx.quadraticCurveTo(half, half, half, 0);
  ctx.fill();
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

export default class PickupSparkleSystem {

  constructor(scene) {
    this.s = scene;
    this.texture = null;
    this.pool = [];
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled !== false;
    if (!this.enabled) this.clear();
  }

  make(index) {
    if (!this.texture) this.texture = sparkleTexture(this.s);
    const system = new ParticleSystem(`pickupSparkle_${index}`, CAPACITY, this.s);
    const slot = { system, cue: null };
    system.particleTexture = this.texture;
    system.emitter = new Vector3(0, 0, 0);
    system.startPositionFunction = (matrix, position) => this.spawnAt(slot.cue, position);
    system.color1 = color(COLORS[0]);
    system.color2 = color(COLORS[1]);
    system.colorDead = color(COLORS[2]);
    system.addSizeGradient(0, 0);
    system.addSizeGradient(0.3, SIZE[0], SIZE[1]);
    system.addSizeGradient(1, 0);
    system.minLifeTime = LIFE[0];
    system.maxLifeTime = LIFE[1];
    system.minEmitPower = RISE[0];
    system.maxEmitPower = RISE[1];
    system.direction1 = new Vector3(-DRIFT, 1, -DRIFT);
    system.direction2 = new Vector3(DRIFT, 1, DRIFT);
    system.minInitialRotation = 0;
    system.maxInitialRotation = Math.PI / 2;
    system.minAngularSpeed = -1.2;
    system.maxAngularSpeed = 1.2;
    system.gravity = new Vector3(0, 0, 0);
    system.blendMode = ParticleSystem.BLENDMODE_ADD;
    system.isLocal = false;
    system.emitRate = 0;
    system.start();
    return slot;
  }

  spawnAt(cue, position) {
    if (!cue) return;
    const points = cue.points;
    if (points && points.length) {
      const point = points[Math.floor(Math.random() * points.length)];
      position.set(
        point.x + (Math.random() - 0.5) * JITTER,
        point.y + Math.random() * JITTER,
        point.z + (Math.random() - 0.5) * JITTER,
      );
      return;
    }
    const spread = Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, cue.width * 0.45));
    const top = Math.max(LIFT_MIN, cue.height * 1.05);
    position.set(
      cue.x + (Math.random() * 2 - 1) * spread,
      cue.y + top * (0.2 + 0.8 * Math.random()),
      cue.z + (Math.random() * 2 - 1) * spread,
    );
  }

  update(cues) {
    const list = this.enabled && cues ? cues : [];
    while (this.pool.length < Math.min(POOL, list.length)) this.pool.push(this.make(this.pool.length));
    for (let i = 0; i < this.pool.length; i += 1) {
      const slot = this.pool[i];
      const cue = list[i];
      slot.cue = cue || slot.cue;
      slot.system.emitRate = cue ? Math.min(RATE_MAX, RATE + RATE_PER_METER * cue.width) : 0;
    }
  }

  clear() {
    for (const slot of this.pool) slot.system.emitRate = 0;
  }
}
