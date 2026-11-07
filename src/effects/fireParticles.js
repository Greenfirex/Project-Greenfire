// Společné částice ohně — kulatá zářivá skvrna a jedna vrstva plamene podle nastavení.
// Táborák i pochodeň si skládají plamen z těchto vrstev, liší se jen čísly.
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export function fireParticleTexture(scene, name) {
  const size = 64;
  const texture = new DynamicTexture(name, size, scene, false);
  const ctx = texture.getContext();
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.clearRect(0, 0, size, size);
  ctx.fillRect(0, 0, size, size);
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

export function fireLayer(scene, name, emitter, texture, cfg, gravity) {
  const system = new ParticleSystem(name, cfg.capacity, scene);
  system.particleTexture = texture;
  system.emitter = emitter;
  system.minEmitBox = new Vector3(-cfg.spread, 0, -cfg.spread);
  system.maxEmitBox = new Vector3(cfg.spread, cfg.boxHeight, cfg.spread);
  system.color1 = new Color4(cfg.colors[0][0], cfg.colors[0][1], cfg.colors[0][2], 1);
  system.color2 = new Color4(cfg.colors[1][0], cfg.colors[1][1], cfg.colors[1][2], 0.9);
  system.colorDead = new Color4(cfg.colors[2][0], cfg.colors[2][1], cfg.colors[2][2], 0);
  system.minSize = cfg.size[0];
  system.maxSize = cfg.size[1];
  system.minLifeTime = cfg.life[0];
  system.maxLifeTime = cfg.life[1];
  system.emitRate = cfg.rate;
  system.minEmitPower = cfg.rise[0];
  system.maxEmitPower = cfg.rise[1];
  system.updateSpeed = 0.01;
  system.direction1 = new Vector3(-cfg.drift, 1, -cfg.drift);
  system.direction2 = new Vector3(cfg.drift, 1, cfg.drift);
  system.blendMode = ParticleSystem.BLENDMODE_ADD;
  system.gravity = gravity;
  system.isLocal = false;
  return system;
}
