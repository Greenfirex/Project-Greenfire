// Zvýraznění spawních míst tvorů v editoru — kruhy toulání a čtverečky buněk.
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
const SQUARE_COLOR = new Color3(0.3, 0.9, 0.8);
const RING_ALPHA = 0.85;
const WAITING_ALPHA = 0.55;
const NEW_ALPHA = 0.45;
const SQUARE_ALPHA = 0.9;
const RING_ALPHA_INDEX = 2;
const SQUARE_ALPHA_INDEX = 3;

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

export default class CreatureOverlay {

  constructor(scene) {
    this.s = scene;
    this.rings = [];
    this.squares = [];
    this.outlines = [];
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
    for (const mark of list) {
      const state = mark.state === 'waiting' || mark.state === 'new' ? mark.state : 'alive';
      const x = mark.cx * CELL_SIZE;
      const z = mark.cz * CELL_SIZE;
      const ground = surfaceAt(mark.cx, mark.cz);
      const y = Number.isFinite(ground) ? ground : 0;
      const ring = this.ringAt(used);
      ring.position = new Vector3(x, y + RING_LIFT, z);
      ring.scaling.set(mark.radius, 1, mark.radius);
      ring.color = state === 'alive' ? ALIVE_COLOR : state === 'waiting' ? WAITING_COLOR : NEW_COLOR;
      ring.alpha = state === 'alive' ? RING_ALPHA : state === 'waiting' ? WAITING_ALPHA : NEW_ALPHA;
      ring.setEnabled(true);
      const square = this.squareAt(used);
      const outline = this.outlineAt(used);
      if (state === 'alive') {
        square.position = new Vector3(x, y + SQUARE_LIFT, z);
        square.setEnabled(true);
        outline.setEnabled(false);
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
  }

  clear() {
    this.hideFrom(0);
  }

  hideFrom(index) {
    for (let i = index; i < this.rings.length; i += 1) this.rings[i].setEnabled(false);
    for (let i = index; i < this.squares.length; i += 1) this.squares[i].setEnabled(false);
    for (let i = index; i < this.outlines.length; i += 1) this.outlines[i].setEnabled(false);
  }
}