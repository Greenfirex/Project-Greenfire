// Truhly ve světě — co v nich je, jestli už je hráč vybral, a zvednutí víka při otevření.
// Drží jen seznam truhel; kde stojí hráč a kam obsah putuje, řeší scéna.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellKey } from '../../utils/gridMath.js';
import { levelOfEntry } from '../../data/maps/areaShape.js';
import { PLAYER_BASE } from '../../data/catalogs/player.js';

const REACH = PLAYER_BASE.handReach.distance;
const REACH_HEIGHT = PLAYER_BASE.handReach.heightLimit;
const OPEN_SECONDS = 0.7;
const OPEN_ANGLE = 1.9;

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
    this.nearest = null;
  }

  add(entry, def, node, position) {
    if (!def || !def.loot || !node) return;
    const level = levelOfEntry(entry);
    const key = boxKey(entry.cx, entry.cz, level);
    const hinge = this.hingeFor(node, def.lid);
    const existing = this.boxes.find((box) => box.key === key);
    const box = existing || { key, cx: entry.cx, cz: entry.cz, level, open: 0 };
    Object.assign(box, { entry, def, hinge, x: position.x, y: position.y, z: position.z });
    box.open = this.opened.has(key) ? 1 : 0;
    this.pose(box);
    if (!existing) this.boxes.push(box);
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
    if (box) box.swinging = true;
  }

  open(box) {
    if (!box || this.opened.has(box.key)) return null;
    this.opened.add(box.key);
    return Object.entries(box.def.loot)
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .map(([itemKey, amount]) => ({ itemKey, amount }));
  }

  update(dt, root, level = 0) {
    this.nearest = root ? this.nearestClosed(root.position, level) : null;
    for (const box of this.boxes) {
      if (!box.swinging || box.open >= 1) continue;
      box.open = Math.min(1, box.open + dt / OPEN_SECONDS);
      this.pose(box);
    }
  }

  nearestClosed(from, level) {
    let best = null;
    let bestDist = REACH;
    for (const box of this.boxes) {
      if (box.level !== level || this.opened.has(box.key)) continue;
      if (Math.abs(box.y - from.y) > REACH_HEIGHT) continue;
      const dist = Math.hypot(box.x - from.x, box.z - from.z);
      if (dist > bestDist) continue;
      best = box;
      bestDist = dist;
    }
    return best;
  }

  serialize() {
    return { opened: [...this.opened] };
  }

  defaultState() {
    return { opened: [] };
  }

  apply(data) {
    const list = data && Array.isArray(data.opened) ? data.opened.filter((key) => typeof key === 'string') : [];
    this.opened = new Set(list);
    for (const box of this.boxes) {
      box.open = this.opened.has(box.key) ? 1 : 0;
      this.pose(box);
    }
  }
}
