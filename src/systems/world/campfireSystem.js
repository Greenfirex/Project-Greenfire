// Táboráky ve světě — kde stojí, jestli hoří, a co udělá zapálení.
// Drží jen seznam ohňů; kdo klikne a kde stojí hráč, mu hlásí scéna.
import { cellKey, cellToWorldCoords } from '../../utils/gridMath.js';
import CampfireFire from '../../effects/campfireFire.js';
import { levelOfEntry } from '../../data/maps/areaShape.js';
import { PLAYER_BASE } from '../../data/catalogs/player.js';

const REACH = 3.2;
const REACH_HEIGHT = PLAYER_BASE.handReach.heightLimit;
const MOVE_CANCEL = 0.16;

function sameEntry(item, entry) {
  return item.entry === entry || (item.cx === entry.cx && item.cz === entry.cz && item.level === levelOfEntry(entry));
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
    this.igniteBusy = null;
    this.terrain = [];
  }

  setTerrain(surfaces) {
    this.terrain = surfaces;
    for (const item of this.fires) item.fire.setTerrain(surfaces);
  }

  add(entry, def, surfaceY) {
    const cfg = def && def.flame;
    if (!cfg) return;
    const { x, z } = cellToWorldCoords(entry.cx, entry.cz);
    const existing = this.fires.find((item) => sameEntry(item, entry));
    if (existing) {
      existing.entry = entry;
      existing.lift = cfg.y;
      existing.y = surfaceY;
      existing.fire.setScale(cfg.size);
      existing.fire.place(x, surfaceY + cfg.y, z);
      return;
    }
    const fire = new CampfireFire(this.s);
    fire.setScale(cfg.size);
    fire.place(x, surfaceY + cfg.y, z);
    fire.setTerrain(this.terrain);
    const level = levelOfEntry(entry);
    fire.setDayness(level < 0 ? 0 : this.dayness);
    this.fires.push({ entry, cx: entry.cx, cz: entry.cz, level, x, y: surfaceY, z, fire, lift: cfg.y, lit: false });
  }

  reseatHeights(heightForEntry, entries) {
    if (typeof heightForEntry !== 'function') return;
    const list = Array.isArray(entries) ? entries : null;
    for (const item of this.fires) {
      const fresh = list ? list.find((entry) => entry && sameEntry(item, entry)) : null;
      if (fresh) item.entry = fresh;
      const base = heightForEntry(item.entry);
      if (!Number.isFinite(base)) continue;
      item.y = base;
      item.fire.place(item.x, base + (item.lift || 0), item.z);
    }
  }

  sync(entries) {
    const alive = this.fires.filter((item) => entries.some((entry) => sameEntry(item, entry)));
    for (const item of this.fires) {
      if (alive.includes(item)) continue;
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

  nearestUnlit(from, level = 0) {
    let best = null;
    let bestDist = REACH;
    for (const item of this.fires) {
      if (item.lit || item.level !== level) continue;
      if (Math.abs(item.y - from.y) > REACH_HEIGHT) continue;
      const dist = Math.hypot(item.x - from.x, item.z - from.z);
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
    for (const item of this.fires) item.fire.setDayness(item.level < 0 ? 0 : this.dayness);
  }

  update(dt, root, level = 0) {
    this.nearest = root && !this.pending ? this.nearestUnlit(root.position, level) : null;
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
    if ((this.igniteBusy && this.igniteBusy()) || order.item.lit) return;
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

  nearestBurning(x, z, level = 0) {
    let best = null;
    let bestDist = Infinity;
    for (const item of this.fires) {
      if (!item.lit || item.level !== level) continue;
      const dist = Math.hypot(item.x - x, item.z - z);
      if (dist >= bestDist) continue;
      best = item;
      bestDist = dist;
    }
    return best ? { item: best, distance: bestDist } : null;
  }

  serialize() {
    return { lit: this.fires.filter((item) => item.lit).map((item) => `${cellKey(item.cx, item.cz)}|${item.level}`) };
  }

  defaultState() {
    return { lit: [] };
  }

  apply(data) {
    const list = data && Array.isArray(data.lit) ? data.lit.filter((key) => typeof key === 'string') : [];
    for (const item of this.fires) {
      if (!list.includes(`${cellKey(item.cx, item.cz)}|${item.level}`)) continue;
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
