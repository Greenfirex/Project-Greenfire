// Měkký stín pod rostlinami — všechny skvrny se kreslí jedním tahem.
// Skvrny se nedají mazat jednotlivě; při novém postavení mapy se seznam staví znovu.
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';

const TEXTURE_SIZE = 128;
const LIFT = 0.02;

export default class ContactShadow {

  constructor(scene) {
    this.s = scene;
    this.master = null;
    this.items = [];
    this.dirty = false;
  }

  get mesh() {
    if (!this.master) this.build();
    return this.master;
  }

  add(x, y, z, radius, tilt = null) {
    if (!Number.isFinite(radius) || radius <= 0) return;
    this.items.push({ x, y, z, radius, tilt: tilt || null });
    this.dirty = true;
  }

  clear() {
    if (!this.items.length) return;
    this.items.length = 0;
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    if (!this.items.length) {
      if (this.master) this.master.setEnabled(false);
      return;
    }
    const mesh = this.master || this.build();
    if (!mesh) return;
    const matrices = new Float32Array(this.items.length * 16);
    const scale = new Vector3(1, 1, 1);
    const spot = new Vector3();
    const flat = Quaternion.Identity();
    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index];
      spot.set(item.x, item.y + LIFT, item.z);
      scale.set(item.radius, 1, item.radius);
      Matrix.Compose(scale, item.tilt || flat, spot).copyToArray(matrices, index * 16);
    }
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
    mesh.setEnabled(true);
  }

  build() {
    const mesh = MeshBuilder.CreateGround('contactShadows', { width: 2, height: 2 }, this.s);
    const texture = this.gradientTexture();
    const material = new StandardMaterial('contactShadowMat', this.s);
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.diffuseColor = new Color3(0.02, 0.03, 0.02);
    material.specularColor = new Color3(0, 0, 0);
    material.emissiveColor = new Color3(0, 0, 0);
    material.disableLighting = true;
    material.backFaceCulling = false;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    this.master = mesh;
    return mesh;
  }

  gradientTexture() {
    const texture = new DynamicTexture('contactShadowTex', { width: TEXTURE_SIZE, height: TEXTURE_SIZE }, this.s, true);
    const context = texture.getContext();
    const half = TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.28)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    texture.hasAlpha = true;
    texture.update();
    return texture;
  }
}
