// Výseč rány na zemi — slabě ukazuje, kam a jak široko dosáhne příští rána tasenou zbraní.
// Při úderu krátce zesvětlí; tvar se mění podle dosahu a úhlu zbraně.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const LIFT = 0.06;
const REST_ALPHA = 0.05;
const FLASH_ALPHA = 0.18;
const FLASH_FADE = 0.3;
const TESSELLATION = 48;
const COLOR = new Color3(1, 0.88, 0.62);

export default class AttackArc {

  constructor(scene) {
    this.s = scene;
    this.root = new TransformNode('attackArc', scene);
    this.root.setEnabled(false);
    this.material = new StandardMaterial('attackArcMaterial', scene);
    this.material.disableLighting = true;
    this.material.emissiveColor = COLOR;
    this.material.diffuseColor = Color3.Black();
    this.material.specularColor = Color3.Black();
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.material.zOffset = -2;
    this.material.alpha = REST_ALPHA;
    this.disc = null;
    this.shape = '';
    this.flash = 0;
  }

  reshape(reach, arc) {
    const shape = `${reach.toFixed(3)}:${arc.toFixed(3)}`;
    if (shape === this.shape) return;
    this.shape = shape;
    if (this.disc) this.disc.dispose();
    this.disc = CreateDisc('attackArcDisc', {
      radius: reach,
      arc: Math.min(1, arc / (Math.PI * 2)),
      tessellation: TESSELLATION,
      sideOrientation: Mesh.DOUBLESIDE,
    }, this.s);
    this.disc.rotation.x = Math.PI / 2;
    this.disc.parent = this.root;
    this.disc.material = this.material;
    this.disc.isPickable = false;
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
    this.root.setEnabled(true);
    this.root.position.set(view.x, view.y + LIFT, view.z);
    this.root.rotation.y = view.facing - (Math.PI / 2 - view.arc / 2);
    this.flash = Math.max(0, this.flash - dt / FLASH_FADE);
    this.material.alpha = REST_ALPHA + (FLASH_ALPHA - REST_ALPHA) * this.flash;
  }
}
