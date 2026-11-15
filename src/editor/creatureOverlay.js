// Zvýraznění spawních míst tvorů v editoru — kruhy toulání, čtverečky buněk
// a spojnice od spawního místa k živému tvorovi.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../utils/gridMath.js';

const RING_STEPS = 64;
const RING_LIFT = 0.1;
const SQUARE_LIFT = 0.11;
const SQUARE_SIZE = CELL_SIZE * 0.34;
const ALIVE_COLOR = new Color3(0.35, 0.95, 0.86);
const WAITING_COLOR = new Color3(0.28, 0.62, 0.58);
const NEW_COLOR = new Color3(0.82, 0.86, 0.86);
const NOTICE_COLOR = new Color3(1, 0.42, 0.24);
const SQUARE_COLOR = new Color3(0.3, 0.9, 0.8);
const RING_ALPHA = 0.85;
const WAITING_ALPHA = 0.55;
const NEW_ALPHA = 0.45;
const SQUARE_ALPHA = 0.9;
const RING_ALPHA_INDEX = 2;
const SQUARE_ALPHA_INDEX = 3;
const LINK_POINTS = 17;
const LINK_LIFT = 0.14;
const LINK_MIN = CELL_SIZE * 0.3;
const LINK_ALPHA = 0.5;

function circlePoints() {
  const points = [];
  for (let step = 0; step <= RING_STEPS; step += 1) {
    const angle = (step / RING_STEPS) * Math.PI * 2;
    points.push(new Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }
  return points;
}

function squarePoints() {
  const half = SQUARE_SIZE / 2;
  return [
    new Vector3(-half, 0, -half),
    new Vector3(half, 0, -half),
    new Vector3(half, 0, half),
    new Vector3(-half, 0, half),
    new Vector3(-half, 0, -half),
  ];
}

function straightPoints() {
  const points = [];
  for (let step = 0; step < LINK_POINTS; step += 1) points.push(new Vector3(0, 0, 0));
  return points;
}

export default class CreatureOverlay {

  constructor(scene) {
    this.s = scene;
    this.rings = [];
    this.squares = [];
    this.outlines = [];
    this.links = [];
    this.squareMaterial = null;
  }

  ringAt(index) {
    while (this.rings.length <= index) {
      const ring = MeshBuilder.CreateLines(`creatureMarkRing_${this.rings.length}`, { points: circlePoints() }, this.s);
      ring.alphaIndex = RING_ALPHA_INDEX;
      ring.isPickable = false;
      ring.setEnabled(false);
      this.rings.push(ring);
    }
    return this.rings[index];
  }

  squareAt(index) {
    while (this.squares.length <= index) {
      const square = MeshBuilder.CreateGround(`creatureMarkSquare_${this.squares.length}`, {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
      }, this.s);
      square.material = this.material();
      square.alphaIndex = SQUARE_ALPHA_INDEX;
      square.isPickable = false;
      square.setEnabled(false);
      this.squares.push(square);
    }
    return this.squares[index];
  }

  outlineAt(index) {
    while (this.outlines.length <= index) {
      const outline = MeshBuilder.CreateLines(`creatureMarkOutline_${this.outlines.length}`, {
        points: squarePoints(),
      }, this.s);
      outline.alphaIndex = SQUARE_ALPHA_INDEX;
      outline.isPickable = false;
      outline.setEnabled(false);
      this.outlines.push(outline);
    }
    return this.outlines[index];
  }

  linkAt(index) {
    while (this.links.length <= index) {
      const link = MeshBuilder.CreateLines(`creatureMarkLink_${this.links.length}`, {
        points: straightPoints(),
        updatable: true,
      }, this.s);
      link.alphaIndex = RING_ALPHA_INDEX;
      link.isPickable = false;
      link.setEnabled(false);
      this.links.push(link);
    }
    return this.links[index];
  }

  linkReaches(mark, x, z) {
    const liveX = Number(mark.x);
    const liveZ = Number(mark.z);
    if (!Number.isFinite(liveX) || !Number.isFinite(liveZ)) return false;
    return Math.hypot(liveX - x, liveZ - z) > LINK_MIN;
  }

  showLink(index, mark, x, z, surfaceAt) {
    const liveX = Number(mark.x);
    const liveZ = Number(mark.z);
    const points = [];
    for (let step = 0; step < LINK_POINTS; step += 1) {
      const share = step / (LINK_POINTS - 1);
      const px = x + (liveX - x) * share;
      const pz = z + (liveZ - z) * share;
      const ground = step === 0
        ? surfaceAt(mark.cx, mark.cz)
        : surfaceAt(px / CELL_SIZE, pz / CELL_SIZE);
      points.push(new Vector3(px, (Number.isFinite(ground) ? ground : 0) + LINK_LIFT, pz));
    }
    const link = this.linkAt(index);
    MeshBuilder.CreateLines(link.name, { points, instance: link }, this.s);
    link.color = ALIVE_COLOR;
    link.alpha = LINK_ALPHA;
    link.setEnabled(true);
  }

  material() {
    if (this.squareMaterial) return this.squareMaterial;
    const material = new StandardMaterial('creatureMarkSquareMat', this.s);
    material.diffuseColor = SQUARE_COLOR;
    material.emissiveColor = SQUARE_COLOR;
    material.disableLighting = true;
    material.alpha = SQUARE_ALPHA;
    this.squareMaterial = material;
    return material;
  }

  show(marks, surfaceAt) {
    const list = Array.isArray(marks) ? marks : [];
    let used = 0;
    let linked = 0;
    for (const mark of list) {
      const state = mark.state === 'waiting' || mark.state === 'new' ? mark.state : 'alive';
      const x = mark.cx * CELL_SIZE;
      const z = mark.cz * CELL_SIZE;
      const ground = surfaceAt(mark.cx, mark.cz);
      const y = Number.isFinite(ground) ? ground : 0;
      const ring = this.ringAt(used);
      const radius = Number(mark.radius);
      if (Number.isFinite(radius) && radius > 0) {
        ring.position = new Vector3(x, y + RING_LIFT, z);
        ring.scaling.set(radius, 1, radius);
        ring.color = mark.radiusKind === 'notice'
          ? NOTICE_COLOR
          : state === 'alive' ? ALIVE_COLOR : state === 'waiting' ? WAITING_COLOR : NEW_COLOR;
        ring.alpha = state === 'alive' ? RING_ALPHA : state === 'waiting' ? WAITING_ALPHA : NEW_ALPHA;
        ring.setEnabled(true);
      } else {
        ring.setEnabled(false);
      }
      const square = this.squareAt(used);
      const outline = this.outlineAt(used);
      if (state === 'alive') {
        square.position = new Vector3(x, y + SQUARE_LIFT, z);
        square.setEnabled(true);
        outline.setEnabled(false);
        if (this.linkReaches(mark, x, z)) {
          this.showLink(linked, mark, x, z, surfaceAt);
          linked += 1;
        }
      } else {
        square.setEnabled(false);
        outline.position = new Vector3(x, y + SQUARE_LIFT, z);
        outline.color = state === 'waiting' ? WAITING_COLOR : NEW_COLOR;
        outline.alpha = state === 'waiting' ? RING_ALPHA : NEW_ALPHA;
        outline.setEnabled(true);
      }
      used += 1;
    }
    this.hideFrom(used);
    this.hideLinksFrom(linked);
  }

  clear() {
    this.hideFrom(0);
    this.hideLinksFrom(0);
  }

  hideLinksFrom(index) {
    for (let i = index; i < this.links.length; i += 1) this.links[i].setEnabled(false);
  }

  hideFrom(index) {
    for (let i = index; i < this.rings.length; i += 1) this.rings[i].setEnabled(false);
    for (let i = index; i < this.squares.length; i += 1) this.squares[i].setEnabled(false);
    for (let i = index; i < this.outlines.length; i += 1) this.outlines[i].setEnabled(false);
  }
}