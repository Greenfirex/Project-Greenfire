// Krátkodobé stopy v písku — leží na zemi, střídají strany a v mělké vodě mizí rychleji.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const MAX_PRINTS = 120;
const DRY_SECONDS = 12;
const WET_SECONDS = 3.5;
const FADE_SECONDS = 2;
const PRINT_STYLES = {
  human: { width: 0.24, length: 0.38, alpha: 0.28 },
  turtle: { width: 0.22, length: 0.38, alpha: 0.62 },
  sanddevil: { width: 0.11, length: 0.13, alpha: 0.66 },
  gnaw_rat: { width: 0.09, length: 0.11, alpha: 0.6 },
  bird: { width: 0.26, length: 0.3, alpha: 0.62 },
};
const WET_ALPHA = 0.7;
const TEXTURE_YAW = Math.PI;

function makeHumanTexture(scene) {
  const texture = new DynamicTexture('footprintTexture', 64, 64, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgb(82, 60, 36)';
  for (const [x, y, rx, ry] of [
    [32, 51, 9, 10], [34, 37, 7, 12], [32, 24, 12, 9],
    [24, 10, 5, 6], [32, 8, 3.2, 3.8], [38, 9, 2.8, 3.3], [43, 11, 2.5, 3], [47, 15, 2.2, 2.6],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  texture.hasAlpha = true;
  texture.update(false);
  return texture;
}

function makeTurtleTexture(scene) {
  const texture = new DynamicTexture('turtleFootprintTexture', 64, 64, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(58, 46, 28, 0.78)';
  ctx.beginPath();
  ctx.ellipse(32, 39, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const x of [18, 32, 46]) {
    ctx.beginPath();
    ctx.ellipse(x, 16, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  texture.hasAlpha = true;
  texture.update(false);
  return texture;
}

function makeSandDevilTexture(scene) {
  const texture = new DynamicTexture('sandDevilFootprintTexture', 64, 64, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(58, 45, 28, 0.82)';
  ctx.beginPath();
  ctx.ellipse(32, 32, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 31, 20, 0.6)';
  ctx.beginPath();
  ctx.ellipse(32, 34, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  texture.hasAlpha = true;
  texture.update(false);
  return texture;
}

function makeGnawRatTexture(scene) {
  const texture = new DynamicTexture('gnawRatFootprintTexture', 64, 64, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(58, 45, 28, 0.8)';
  ctx.beginPath();
  ctx.ellipse(32, 42, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [x, y] of [[12, 30], [22, 16], [42, 16], [52, 30]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 6, (x - 32) * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  texture.hasAlpha = true;
  texture.update(false);
  return texture;
}

function makeBirdTexture(scene) {
  const texture = new DynamicTexture('birdFootprintTexture', 64, 64, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(58, 45, 28, 0.8)';
  ctx.fillStyle = 'rgba(58, 45, 28, 0.8)';
  ctx.lineCap = 'round';
  for (const [x, y, width] of [[32, 5, 7], [11, 13, 6], [53, 13, 6], [32, 58, 5]]) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(32, 38);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(32, 37, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  texture.hasAlpha = true;
  texture.update(false);
  return texture;
}

function makeMaterial(scene, name, texture, color) {
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.diffuseTexture.hasAlpha = true;
  material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true;
  material.emissiveColor = color;
  material.specularColor = new Color3(0, 0, 0);
  material.backFaceCulling = false;
  return material;
}

export default class FootprintSystem {

  constructor(scene) {
    this.s = scene;
    this.materials = {};
    this.items = [];
    this.cursor = 0;
    this.seq = 0;
  }

  ensureMaterials() {
    if (this.materials.human) return;
    this.materials.human = makeMaterial(this.s, 'footprintMaterial', makeHumanTexture(this.s), new Color3(0.16, 0.12, 0.08));
    this.materials.turtle = makeMaterial(this.s, 'turtleFootprintMaterial', makeTurtleTexture(this.s), new Color3(0.13, 0.12, 0.08));
    this.materials.sanddevil = makeMaterial(this.s, 'sandDevilFootprintMaterial', makeSandDevilTexture(this.s), new Color3(0.14, 0.12, 0.08));
    this.materials.gnaw_rat = makeMaterial(this.s, 'gnawRatFootprintMaterial', makeGnawRatTexture(this.s), new Color3(0.14, 0.12, 0.08));
    this.materials.bird = makeMaterial(this.s, 'birdFootprintMaterial', makeBirdTexture(this.s), new Color3(0.14, 0.12, 0.08));
  }

  createItem(kind = 'human') {
    this.ensureMaterials();
    const mesh = MeshBuilder.CreateGround(`footprint_${this.seq}`, { width: 1, height: 1 }, this.s);
    this.seq += 1;
    mesh.material = this.materials[kind] || this.materials.human;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.setEnabled(false);
    const item = { mesh, life: 0, alpha: PRINT_STYLES.human.alpha };
    this.items.push(item);
    return item;
  }

  spawn({ x, y, z, angle = 0, scale = 1, kind = 'human', wet = false, mirror = false }) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    let item = this.items.find((entry) => entry.life <= 0);
    if (!item) {
      if (this.items.length >= MAX_PRINTS) item = this.items[this.cursor % this.items.length];
      else item = this.createItem(kind);
    }
    this.cursor = (this.cursor + 1) % MAX_PRINTS;
    item.life = wet ? WET_SECONDS : DRY_SECONDS;
    item.mesh.setEnabled(true);
    item.mesh.material = this.materials[kind] || this.materials.human;
    const style = PRINT_STYLES[kind] || PRINT_STYLES.human;
    item.alpha = wet ? style.alpha * WET_ALPHA : style.alpha;
    item.mesh.visibility = item.alpha;
    item.mesh.position.set(x, y, z);
    item.mesh.rotation.y = angle + TEXTURE_YAW;
    item.mesh.scaling.set(style.width * scale * (mirror ? -1 : 1), 1, style.length * scale);
  }

  clear() {
    for (const item of this.items) {
      item.life = 0;
      item.mesh.setEnabled(false);
    }
  }

  update(dt) {
    const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    if (!seconds) return;
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= seconds;
      if (item.life <= 0) {
        item.life = 0;
        item.mesh.setEnabled(false);
        continue;
      }
      const fade = Math.min(1, item.life / FADE_SECONDS);
      item.mesh.visibility = item.alpha * fade;
    }
  }
}