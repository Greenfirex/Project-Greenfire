// Rozstřik vln o skalní stěny — kapky vyšlehnou tam, kde je u břehu pořád hloubka.
// Místa se hledají jednou po postavení vody; emitor vysype kapky, až k němu dorazí hřeben.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/webgl2ParticleSystem';
import { CELL_SIZE } from '../../utils/gridMath.js';

const CLIFF_RISE = 1.1;
const SITE_SPACING = 2.4;
const SITE_LIMIT = 64;
const NEAR_CAMERA = 70;
const CREST_TRIGGER = 0.06;
const BURST = 26;
const CAPACITY = 160;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export default class WaveSpraySystem {

  constructor(scene) {
    this.s = scene;
    this.water = null;
    this.sites = [];
    this.texture = null;
  }

  particleTexture() {
    if (this.texture) return this.texture;
    const size = 64;
    const texture = new DynamicTexture('waveSprayTexture', size, this.s, false);
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    texture.hasAlpha = true;
    texture.update();
    this.texture = texture;
    return texture;
  }

  build(water) {
    this.clear();
    this.water = water || null;
    if (!water || !Number.isFinite(water.level) || !water.heightAt) return;
    const level = water.level;
    const buckets = new Map();
    for (const [cx, cz] of water.shoreCells || []) {
      for (const [dx, dz] of AROUND) {
        const rise = water.heightAt((cx + dx) * CELL_SIZE, (cz + dz) * CELL_SIZE) - level;
        if (rise < CLIFF_RISE) continue;
        const siteX = cx * CELL_SIZE - dx * CELL_SIZE * 0.35;
        const siteZ = cz * CELL_SIZE - dz * CELL_SIZE * 0.35;
        const key = `${Math.round(siteX / SITE_SPACING)},${Math.round(siteZ / SITE_SPACING)}`;
        if (buckets.has(key)) continue;
        buckets.set(key, { x: siteX, z: siteZ, dirX: -dx, dirZ: -dz });
      }
    }
    const all = [...buckets.values()];
    const stride = Math.max(1, Math.ceil(all.length / SITE_LIMIT));
    for (let i = 0; i < all.length; i += stride) this.sites.push(this.makeEmitter(all[i]));
  }

  makeEmitter(site) {
    const system = new ParticleSystem(`waveSpray_${this.sites.length}`, CAPACITY, this.s);
    system.particleTexture = this.particleTexture();
    system.emitter = new Vector3(site.x, 0, site.z);
    system.minEmitBox = new Vector3(-0.6, 0.05, -0.6);
    system.maxEmitBox = new Vector3(0.6, 0.3, 0.6);
    system.direction1 = new Vector3(site.dirX * 0.6 - 0.45, 2.2, site.dirZ * 0.6 - 0.45);
    system.direction2 = new Vector3(site.dirX * 1.5 + 0.45, 4.2, site.dirZ * 1.5 + 0.45);
    system.minSize = 0.2;
    system.maxSize = 0.72;
    system.minLifeTime = 0.4;
    system.maxLifeTime = 0.95;
    system.emitRate = 0;
    system.manualEmitCount = 0;
    system.gravity = new Vector3(0, -7.5, 0);
    system.color1 = new Color4(0.96, 0.99, 1, 0.9);
    system.color2 = new Color4(0.8, 0.9, 0.97, 0.6);
    system.colorDead = new Color4(0.85, 0.92, 0.97, 0);
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    system.minAngularSpeed = 0;
    system.maxAngularSpeed = 0;
    system.start();
    return { system, site, active: false };
  }

  update(cameraX, cameraZ) {
    const water = this.water;
    if (!water || !Number.isFinite(water.level)) return;
    if (water.hidden) return;
    const level = water.level;
    const camX = Number.isFinite(cameraX) ? cameraX : 0;
    const camZ = Number.isFinite(cameraZ) ? cameraZ : 0;
    for (const entry of this.sites) {
      const { system, site } = entry;
      if (Math.hypot(site.x - camX, site.z - camZ) > NEAR_CAMERA) {
        if (entry.active) {
          entry.active = false;
          system.emitRate = 0;
        }
        continue;
      }
      const surface = water.surfaceHeightAt(site.x, site.z);
      const crest = surface - level;
      system.emitter.y = surface + 0.05;
      const active = crest > CREST_TRIGGER;
      if (active && !entry.active) system.manualEmitCount = BURST;
      entry.active = active;
      system.emitRate = active ? 150 + 240 * Math.min(1.4, crest) : 0;
    }
  }

  clear() {
    for (const entry of this.sites) entry.system.dispose();
    this.sites = [];
    this.water = null;
  }

  dispose() {
    this.clear();
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}
