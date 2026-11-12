// Truhly ve světě — co v nich ještě zbylo, jestli už je hráč otevřel, a zvednutí víka při otevření.
// Drží jen seznam truhel; kde stojí hráč a kam obsah putuje, řeší scéna.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellKey } from '../../utils/gridMath.js';
import { levelOfEntry } from '../../data/maps/areaShape.js';
import { PLAYER_BASE } from '../../data/catalogs/player.js';

const REACH = PLAYER_BASE.handReach.distance;
const REACH_HEIGHT = PLAYER_BASE.handReach.heightLimit;
const OPEN_SECONDS = 0.7;
const CLOSE_SECONDS = 0.5;
const OPEN_ANGLE = 1.9;
const REACH_INSIDE = 0.4;

function boxKey(cx, cz, level) {
  return `${cellKey(cx, cz)}|${level}`;
}

function ease(value) {
  const t = Math.min(1, Math.max(0, value));
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

export default class LootSystem {

  constructor(scene) {
    this.s = scene;
    this.boxes = [];
    this.opened = new Set();
    this.remaining = new Map();
    this.nearest = null;
  }

  add(entry, def, node, position) {
    if (!def || !def.loot || !node) return;
    const level = levelOfEntry(entry);
    const key = boxKey(entry.cx, entry.cz, level);
    const hinge = this.hingeFor(node, def.lid);
    const existing = this.boxes.find((box) => box.key === key);
    const box = existing || { key, cx: entry.cx, cz: entry.cz, level, open: 0 };
    Object.assign(box, { entry, def, hinge, x: position.x, y: position.y, z: position.z }, this.shapeOf(node, hinge));
    this.settle(box);
    if (!existing) this.boxes.push(box);
  }

  shapeOf(node, hinge) {
    const { min, max } = node.getHierarchyBoundingVectors(true);
    const center = min.add(max).scale(0.5);
    const shape = { front: null, center, halfDepth: Math.max(max.x - min.x, max.z - min.z) / 2, top: max.y };
    if (!hinge || !hinge.parent) return shape;
    hinge.parent.computeWorldMatrix(true);
    const front = Vector3.TransformNormal(new Vector3(0, 0, 1), hinge.parent.getWorldMatrix());
    front.y = 0;
    if (front.lengthSquared() < 1e-6) return shape;
    front.normalize();
    shape.front = front;
    shape.halfDepth = (Math.abs(front.x) * (max.x - min.x) + Math.abs(front.z) * (max.z - min.z)) / 2;
    return shape;
  }

  standSpot(box, gap, from) {
    if (!box || !box.center) return null;
    let side = box.front;
    if (!side) {
      side = new Vector3(from.x - box.center.x, 0, from.z - box.center.z);
      if (side.lengthSquared() < 1e-6) return null;
      side.normalize();
    }
    const distance = Math.max(box.front ? box.halfDepth : 0, box.def.radius || 0) + gap;
    return box.center.add(side.scale(distance));
  }

  reachPoint(box) {
    if (!box || !box.center) return null;
    if (!box.front) return box.center.clone();
    const edge = box.center.add(box.front.scale(box.halfDepth * REACH_INSIDE));
    edge.y = box.top;
    return edge;
  }

  hingeFor(node, lidName) {
    if (!lidName) return null;
    const parts = node.getChildMeshes().filter((mesh) => mesh.name.includes(lidName));
    if (!parts.length) return null;
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of parts) {
      const box = mesh.getBoundingInfo().boundingBox;
      min.minimizeInPlace(box.minimum);
      max.maximizeInPlace(box.maximum);
    }
    const pivot = new Vector3((min.x + max.x) / 2, min.y, min.z);
    const hinge = new TransformNode(`${node.name}_hinge`, this.s);
    hinge.parent = parts[0].parent;
    hinge.position = pivot;
    for (const mesh of parts) {
      mesh.parent = hinge;
      mesh.position = pivot.scale(-1);
    }
    return hinge;
  }

  pose(box) {
    if (box.hinge && !box.hinge.isDisposed()) box.hinge.rotation.x = -OPEN_ANGLE * ease(box.open);
  }

  sync(entries) {
    const live = new Set((entries || []).map((entry) => boxKey(entry.cx, entry.cz, levelOfEntry(entry))));
    this.boxes = this.boxes.filter((box) => live.has(box.key));
    this.nearest = null;
  }

  at(cx, cz, level = 0) {
    return this.boxes.find((box) => box.cx === cx && box.cz === cz && box.level === level) || null;
  }

  swing(box) {
    if (box) box.goal = 1;
  }

  shut(box) {
    if (box && !this.isEmpty(box)) box.goal = 0;
  }

  settle(box) {
    box.goal = this.isEmpty(box) ? 1 : 0;
    box.open = box.goal;
    this.pose(box);
  }

  isEmpty(box) {
    return Boolean(box) && this.opened.has(box.key) && !this.remaining.has(box.key);
  }

  open(box) {
    if (!box || this.isEmpty(box)) return null;
    if (!this.opened.has(box.key)) {
      this.opened.add(box.key);
      const fresh = {};
      for (const [itemKey, amount] of Object.entries(box.def.loot)) {
        if (Number.isFinite(amount) && amount > 0) fresh[itemKey] = amount;
      }
      if (Object.keys(fresh).length) this.remaining.set(box.key, fresh);
    }
    return this.contentsOf(box);
  }

  contentsOf(box) {
    const left = box ? this.remaining.get(box.key) : null;
    return left ? Object.entries(left).map(([itemKey, amount]) => ({ itemKey, amount })) : [];
  }

  take(box, itemKey) {
    const left = box ? this.remaining.get(box.key) : null;
    if (!left || !left[itemKey]) return null;
    const taken = { itemKey, amount: left[itemKey] };
    delete left[itemKey];
    if (!Object.keys(left).length) this.remaining.delete(box.key);
    return taken;
  }

  update(dt, root, level = 0) {
    this.nearest = root ? this.nearestClosed(root.position, level) : null;
    for (const box of this.boxes) {
      if (box.open === box.goal) continue;
      box.open = box.goal > box.open
        ? Math.min(box.goal, box.open + dt / OPEN_SECONDS)
        : Math.max(box.goal, box.open - dt / CLOSE_SECONDS);
      this.pose(box);
    }
  }

  nearestClosed(from, level) {
    let best = null;
    let bestDist = REACH;
    for (const box of this.boxes) {
      if (box.level !== level || this.isEmpty(box)) continue;
      if (Math.abs(box.y - from.y) > REACH_HEIGHT) continue;
      const dist = Math.hypot(box.x - from.x, box.z - from.z);
      if (dist > bestDist) continue;
      best = box;
      bestDist = dist;
    }
    return best;
  }

  serialize() {
    return { opened: [...this.opened], remaining: Object.fromEntries(this.remaining) };
  }

  defaultState() {
    return { opened: [], remaining: {} };
  }

  apply(data) {
    const list = data && Array.isArray(data.opened) ? data.opened.filter((key) => typeof key === 'string') : [];
    this.opened = new Set(list);
    this.remaining = new Map();
    const saved = data && data.remaining && typeof data.remaining === 'object' ? data.remaining : {};
    for (const [key, items] of Object.entries(saved)) {
      if (!this.opened.has(key) || !items || typeof items !== 'object') continue;
      const clean = {};
      for (const [itemKey, amount] of Object.entries(items)) {
        if (Number.isFinite(amount) && amount > 0) clean[itemKey] = amount;
      }
      if (Object.keys(clean).length) this.remaining.set(key, clean);
    }
    for (const box of this.boxes) this.settle(box);
  }
}
