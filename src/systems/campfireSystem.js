// Táboráky ve světě — kde stojí, jestli hoří, a co udělá zapálení.
// Drží jen seznam ohňů; kdo klikne a kde stojí hráč, mu hlásí scéna.
import { cellKey, cellToWorldCoords } from '../utils/gridMath.js';
import CampfireFire from '../effects/campfireFire.js';

const REACH = 3.2;
const MOVE_CANCEL = 0.16;

function sameEntry(item, entry) {
  return item.entry === entry || (item.cx === entry.cx && item.cz === entry.cz);
}

export default class CampfireSystem {

  constructor(scene) {
    this.s = scene;
    this.fires = [];
    this.dayness = 1;
    this.nearest = null;
    this.onIgnite = null;
    this.pending = null;
    this.pendingSparks = false;
    this.onIgniteStart = null;
    this.onFireAdded = null;
    this.onFireRemoved = null;
  }

  add(entry, def, surfaceY) {
    const cfg = def && def.flame;
    if (!cfg) return;
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const fire = new CampfireFire(this.s);
    fire.setDayness(this.dayness);
    fire.setScale(cfg.size);
    fire.place(x, surfaceY + cfg.y, z);
    this.fires.push({ entry, cx: entry.cx, cz: entry.cz, x, z, fire, lift: cfg.y, lit: false });
    if (this.onFireAdded) this.onFireAdded(fire);
  }

  reseatHeights(heightForEntry, entries) {
    if (typeof heightForEntry !== 'function') return;
    const list = Array.isArray(entries) ? entries : null;
    for (const item of this.fires) {
      const fresh = list ? list.find((entry) => entry && sameEntry(item, entry)) : null;
      if (fresh) item.entry = fresh;
      const base = heightForEntry(item.entry);
      if (!Number.isFinite(base)) continue;
      item.fire.place(item.x, base + (item.lift || 0), item.z);
    }
  }

  sync(entries) {
    const alive = this.fires.filter((item) => entries.some((entry) => sameEntry(item, entry)));
    for (const item of this.fires) {
      if (alive.includes(item)) continue;
      if (this.onFireRemoved) this.onFireRemoved(item.fire);
      item.fire.dispose();
    }
    this.fires = alive;
    for (const item of alive) {
      if (item.lit) continue;
      if (!entries.some((entry) => sameEntry(item, entry) && entry.lit)) continue;
      this.light(item);
    }
    this.nearest = null;
  }

  has(cx, cz) {
    return this.fires.some((item) => item.cx === cx && item.cz === cz);
  }

  nearestUnlit(x, z) {
    let best = null;
    let bestDist = REACH;
    for (const item of this.fires) {
      if (item.lit) continue;
      const dist = Math.hypot(item.x - x, item.z - z);
      if (dist > bestDist) continue;
      best = item;
      bestDist = dist;
    }
    return best;
  }

  ignite(entry) {
    const item = this.fires.find((fire) => sameEntry(fire, entry));
    if (!item || item.lit) return false;
    if (this.pending) return false;
    this.pending = { item, anchorX: null, anchorZ: null };
    this.pendingSparks = false;
    if (this.onIgniteStart) this.onIgniteStart(item);
    return true;
  }

  cancel() {
    if (!this.pending) return false;
    this.pending = null;
    this.pendingSparks = false;
    return true;
  }

  light(item) {
    item.lit = true;
    item.entry.lit = true;
    item.fire.ignite();
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, value));
    for (const item of this.fires) item.fire.setDayness(this.dayness);
  }

  update(dt, root) {
    this.nearest = root && !this.pending ? this.nearestUnlit(root.position.x, root.position.z) : null;
    this.updatePending(root);
    for (const item of this.fires) item.fire.update(dt);
  }

  updatePending(root) {
    const order = this.pending;
    if (!order) return;
    if (!root) {
      this.cancel();
      return;
    }
    if (order.anchorX === null) {
      order.anchorX = root.position.x;
      order.anchorZ = root.position.z;
      return;
    }
    if (Math.hypot(root.position.x - order.anchorX, root.position.z - order.anchorZ) > MOVE_CANCEL) {
      this.cancel();
      return;
    }
    if (root.igniteImpactAt > 0 || order.item.lit) return;
    if (!this.pendingSparks) {
      this.pendingSparks = true;
      order.item.fire.ignite();
      return;
    }
    this.pending = null;
    this.pendingSparks = false;
    this.light(order.item);
    if (this.onIgnite) this.onIgnite(order.item.entry);
  }

  nearestBurning(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const item of this.fires) {
      if (!item.lit) continue;
      const dist = Math.hypot(item.x - x, item.z - z);
      if (dist >= bestDist) continue;
      best = item;
      bestDist = dist;
    }
    return best ? { item: best, distance: bestDist } : null;
  }

  serialize() {
    return { lit: this.fires.filter((item) => item.lit).map((item) => cellKey(item.cx, item.cz)) };
  }

  registerState(key, provider) {
    this.saveKey = key;
    this.savedState = provider;
  }

  defaultState() {
    return { lit: [] };
  }

  apply(data) {
    const list = data && Array.isArray(data.lit) ? data.lit.filter((key) => typeof key === 'string') : [];
    for (const item of this.fires) {
      if (!list.includes(cellKey(item.cx, item.cz))) continue;
      this.light(item);
      item.fire.heat = 1;
    }
  }

  dispose() {
    for (const item of this.fires) item.fire.dispose();
    this.fires = [];
    this.nearest = null;
    this.pending = null;
    this.pendingSparks = false;
  }
}
