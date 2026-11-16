// Výseč rány na zemi — slabě ukazuje, kam a jak široko dosáhne příští rána tasenou zbraní.
// Při úderu krátce zesvětlí; tvar se mění podle dosahu a úhlu zbraně.
// U kousnutí tvora se výseč od tvora postupně vyplňuje; když se vyplní celá, tvor kousne.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const LIFT = 0.06;
const FILL_LIFT = 0.01;
const REST_ALPHA = 0.05;
const FLASH_ALPHA = 0.18;
const FLASH_FADE = 0.3;
const FILL_ALPHA = 0.35;
const TESSELLATION = 48;
const COLOR = new Color3(1, 0.88, 0.62);
export const DANGER_COLOR = new Color3(1, 0.2, 0.12);

export default class AttackArc {

  constructor(scene, color = COLOR) {
    this.s = scene;
    this.root = new TransformNode('attackArc', scene);
    this.root.setEnabled(false);
    this.material = this.makeMaterial('attackArcMaterial', color, REST_ALPHA);
    this.fillMaterial = null;
    this.color = color;
    this.disc = null;
    this.fill = null;
    this.shape = '';
    this.flash = 0;
  }

  makeMaterial(name, color, alpha) {
    const material = new StandardMaterial(name, this.s);
    material.disableLighting = true;
    material.emissiveColor = color;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    material.zOffset = -2;
    material.alpha = alpha;
    return material;
  }

  makeDisc(name, reach, arc, material) {
    const disc = CreateDisc(name, {
      radius: reach,
      arc: Math.min(1, arc / (Math.PI * 2)),
      tessellation: TESSELLATION,
      sideOrientation: Mesh.DOUBLESIDE,
    }, this.s);
    disc.rotation.x = Math.PI / 2;
    disc.parent = this.root;
    disc.material = material;
    disc.isPickable = false;
    return disc;
  }

  reshape(reach, arc) {
    const shape = `${reach.toFixed(3)}:${arc.toFixed(3)}`;
    if (shape === this.shape) return;
    this.shape = shape;
    if (this.disc) this.disc.dispose();
    this.disc = this.makeDisc('attackArcDisc', reach, arc, this.material);
    if (this.fill) {
      this.fill.dispose();
      this.fill = null;
    }
  }

  setFill(progress, reach, arc) {
    if (!Number.isFinite(progress)) {
      if (this.fill) this.fill.setEnabled(false);
      return;
    }
    if (!this.fillMaterial) this.fillMaterial = this.makeMaterial('attackArcFillMaterial', this.color, FILL_ALPHA);
    if (!this.fill) {
      this.fill = this.makeDisc('attackArcFill', reach, arc, this.fillMaterial);
      this.fill.position.y = FILL_LIFT;
    }
    const share = Math.max(0.001, Math.min(1, progress));
    this.fill.setEnabled(true);
    this.fill.scaling.set(share, share, 1);
  }

  pulse() {
    this.flash = 1;
  }

  update(dt, view) {
    if (!view || !(view.reach > 0) || !(view.arc > 0)) {
      this.root.setEnabled(false);
      this.flash = 0;
      return;
    }
    this.reshape(view.reach, view.arc);
    this.setFill(view.progress, view.reach, view.arc);
    this.root.setEnabled(true);
    this.root.position.set(view.x, view.y + LIFT, view.z);
    this.root.rotation.y = view.facing - (Math.PI / 2 - view.arc / 2);
    this.flash = Math.max(0, this.flash - dt / FLASH_FADE);
    this.material.alpha = Number.isFinite(view.alpha) ? view.alpha : REST_ALPHA + (FLASH_ALPHA - REST_ALPHA) * this.flash;
  }

  dispose() {
    if (this.disc) this.disc.dispose();
    if (this.fill) this.fill.dispose();
    this.material.dispose();
    if (this.fillMaterial) this.fillMaterial.dispose();
    this.root.dispose();
  }
}
