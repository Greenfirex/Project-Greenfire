// Zvýraznění spawních míst tvorů v editoru — kruhy toulání, čtverečky buněk
// a spojnice od spawního místa k živému tvorovi. U hnízd kruh, odkud se berou hlídači,
// a spojnice k živým hlídačům (k mrtvým slabší spojnice k místu, kde se znovu objeví);
// hnízdo bez hlídačů má jinou barvu. Tvorové ve smečce mají fialovou značku a fialové
// spojnice ke členům smečky, na které dovolají.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../utils/gridMath.js';
import { PACK_CALL_RANGE } from '../data/catalogs/creatures/index.js';

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
const NEST_COLOR = new Color3(1, 0.78, 0.25);
const LONELY_NEST_COLOR = new Color3(0.95, 0.35, 0.3);
const NEST_RING_ALPHA = 0.8;
const NEST_LINK_ALPHA = 0.85;
const NEST_WAITING_ALPHA = 0.35;
const NEST_CORE = CELL_SIZE * 0.3;
const PACK_COLOR = new Color3(0.78, 0.45, 1);
const PACK_LINK_ALPHA = 0.75;

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
    this.nestRings = [];
    this.nestCores = [];
    this.nestLinks = [];
    this.packLinks = [];
    this.squareMaterial = null;
    this.packMaterial = null;
  }

  linesFrom(pool, index, name, points, updatable = false) {
    while (pool.length <= index) {
      const lines = MeshBuilder.CreateLines(`${name}_${pool.length}`, { points, updatable }, this.s);
      lines.alphaIndex = RING_ALPHA_INDEX;
      lines.isPickable = false;
      lines.setEnabled(false);
      pool.push(lines);
    }
    return pool[index];
  }

  groundLine(fromX, fromZ, toX, toZ, surfaceAt) {
    const points = [];
    for (let step = 0; step < LINK_POINTS; step += 1) {
      const share = step / (LINK_POINTS - 1);
      const px = fromX + (toX - fromX) * share;
      const pz = fromZ + (toZ - fromZ) * share;
      const ground = surfaceAt(px / CELL_SIZE, pz / CELL_SIZE);
      points.push(new Vector3(px, (Number.isFinite(ground) ? ground : 0) + LINK_LIFT, pz));
    }
    return points;
  }

  showNests(nests, surfaceAt) {
    let rings = 0;
    let links = 0;
    for (const nest of Array.isArray(nests) ? nests : []) {
      const guarded = nest.guards && nest.guards.length > 0;
      const color = guarded ? NEST_COLOR : LONELY_NEST_COLOR;
      const ground = surfaceAt(nest.x / CELL_SIZE, nest.z / CELL_SIZE);
      const y = (Number.isFinite(ground) ? ground : 0) + RING_LIFT;
      for (const [pool, radius, name] of [[this.nestRings, nest.guardLink, 'nestMarkRing'], [this.nestCores, NEST_CORE, 'nestMarkCore']]) {
        const ring = this.linesFrom(pool, rings, name, circlePoints());
        ring.position = new Vector3(nest.x, y, nest.z);
        ring.scaling.set(radius, 1, radius);
        ring.color = color;
        ring.alpha = NEST_RING_ALPHA;
        ring.setEnabled(true);
      }
      rings += 1;
      for (const guard of nest.guards || []) {
        const toX = guard.alive ? guard.x : guard.cx * CELL_SIZE;
        const toZ = guard.alive ? guard.z : guard.cz * CELL_SIZE;
        const points = this.groundLine(nest.x, nest.z, toX, toZ, surfaceAt);
        const link = this.linesFrom(this.nestLinks, links, 'nestMarkLink', straightPoints(), true);
        MeshBuilder.CreateLines(link.name, { points, instance: link }, this.s);
        link.color = NEST_COLOR;
        link.alpha = guard.alive ? NEST_LINK_ALPHA : NEST_WAITING_ALPHA;
        link.setEnabled(true);
        links += 1;
      }
    }
    for (const pool of [this.nestRings, this.nestCores]) {
      for (let i = rings; i < pool.length; i += 1) pool[i].setEnabled(false);
    }
    for (let i = links; i < this.nestLinks.length; i += 1) this.nestLinks[i].setEnabled(false);
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
    return this.linesFrom(this.links, index, 'creatureMarkLink', straightPoints(), true);
  }

  linkReaches(mark, x, z) {
    const liveX = Number(mark.x);
    const liveZ = Number(mark.z);
    if (!Number.isFinite(liveX) || !Number.isFinite(liveZ)) return false;
    return Math.hypot(liveX - x, liveZ - z) > LINK_MIN;
  }

  showLink(index, mark, x, z, surfaceAt) {
    const points = this.groundLine(x, z, Number(mark.x), Number(mark.z), surfaceAt);
    const link = this.linkAt(index);
    MeshBuilder.CreateLines(link.name, { points, instance: link }, this.s);
    link.color = ALIVE_COLOR;
    link.alpha = LINK_ALPHA;
    link.setEnabled(true);
  }

  material(pack = false) {
    const field = pack ? 'packMaterial' : 'squareMaterial';
    if (this[field]) return this[field];
    const color = pack ? PACK_COLOR : SQUARE_COLOR;
    const material = new StandardMaterial(pack ? 'creatureMarkPackMat' : 'creatureMarkSquareMat', this.s);
    material.diffuseColor = color;
    material.emissiveColor = color;
    material.disableLighting = true;
    material.alpha = SQUARE_ALPHA;
    this[field] = material;
    return material;
  }

  showPackLinks(marks, surfaceAt) {
    const pack = marks.filter((mark) => mark.pack);
    let used = 0;
    for (let i = 0; i < pack.length; i += 1) {
      for (let j = i + 1; j < pack.length; j += 1) {
        const fromX = pack[i].cx * CELL_SIZE;
        const fromZ = pack[i].cz * CELL_SIZE;
        const toX = pack[j].cx * CELL_SIZE;
        const toZ = pack[j].cz * CELL_SIZE;
        if (Math.hypot(toX - fromX, toZ - fromZ) > PACK_CALL_RANGE) continue;
        const link = this.linesFrom(this.packLinks, used, 'creaturePackLink', straightPoints(), true);
        MeshBuilder.CreateLines(link.name, { points: this.groundLine(fromX, fromZ, toX, toZ, surfaceAt), instance: link }, this.s);
        link.color = PACK_COLOR;
        link.alpha = PACK_LINK_ALPHA;
        link.setEnabled(true);
        used += 1;
      }
    }
    for (let i = used; i < this.packLinks.length; i += 1) this.packLinks[i].setEnabled(false);
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
      square.material = this.material(Boolean(mark.pack));
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
        outline.color = mark.pack ? PACK_COLOR : state === 'waiting' ? WAITING_COLOR : NEW_COLOR;
        outline.alpha = state === 'waiting' ? RING_ALPHA : NEW_ALPHA;
        outline.setEnabled(true);
      }
      used += 1;
    }
    this.hideFrom(used);
    this.hideLinksFrom(linked);
    this.showPackLinks(list, surfaceAt);
  }

  clear() {
    this.hideFrom(0);
    this.hideLinksFrom(0);
    this.showPackLinks([], () => 0);
    this.showNests([], () => 0);
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