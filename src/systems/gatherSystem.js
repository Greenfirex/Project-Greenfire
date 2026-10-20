// Sběr surovin z krajiny — najde nejbližší strom nebo kámen, počítá údery a hýbe s ním.
// Drží jen stav vyčerpávání a naklonění modelů; modely dodává dekorace, hráče předává scéna.
const REACH = 2.6;
const BARE_COOLDOWN = 0.62;
const BARE_KINDS = ['tree'];
const BARE_SOUND = 'bare';
const BARE_YIELDS = { wood: 1 };
const SWAY_KINDS = ['tree'];
const ORE_HITS = 10;
const FALLBACK_DURATION = 0.5;
const IMPACT_SHARE = 0.62;
const SWAY_AMPLITUDE = 0.055;
const SWAY_DECAY = 6.5;
const SWAY_SPEED = 16;

export default class GatherSystem {

  constructor(scene) {
    this.s = scene;
    this.entries = [];
    this.target = null;
    this.playerPos = null;
    this.cooldown = 0;
    this.hitCooldown = BARE_COOLDOWN;
    this.pending = null;
    this.swayTime = 0;
    this.tool = null;
    this.decoSystem = null;
  }

  clear() {
    this.entries = [];
    this.target = null;
    this.playerPos = null;
    this.cooldown = 0;
    this.pending = null;
  }

  addEntry(entry, def, anchor) {
    if (!def || !def.gather || !anchor) return;
    const isOre = def.kind === 'ore';
    const total = isOre ? ORE_HITS : Object.values(def.gather).reduce((sum, n) => sum + n, 0);
    if (total <= 0) return;
    this.entries.push({
      entry,
      def,
      anchor,
      x: anchor.position.x,
      z: anchor.position.z,
      total,
      left: total,
      hits: 0,
      sway: 0,
      axisX: 0,
      axisZ: 1,
    });
  }

  syncFromDeco() {
    const deco = this.decoSystem;
    if (!deco || !deco.readyEntries) return;
    for (const item of deco.readyEntries()) {
      if (item.entry && this.hasEntry(item.entry.cx, item.entry.cz)) continue;
      this.addEntry(item.entry, item.def, item.anchor);
    }
  }

  hasEntry(cx, cz) {
    return this.entries.some((e) => e.entry.cx === cx && e.entry.cz === cz && e.left > 0);
  }

  exhaustedCells() {
    return this.entries
      .filter((e) => e.left <= 0)
      .map((e) => ({ cx: e.entry.cx, cz: e.entry.cz }));
  }

  setTool(tool) {
    this.tool = tool || null;
    this.hitCooldown = tool && tool.harvest ? tool.harvest.cooldown : BARE_COOLDOWN;
  }

  canHarvest(item) {
    if (!item) return false;
    if (this.tool && this.tool.harvest) return this.tool.harvest.kinds.includes(item.def.kind);
    return BARE_KINDS.includes(item.def.kind);
  }

  findNearest(x, z) {
    let best = null;
    let bestDist = REACH;
    for (const item of this.entries) {
      if (item.left <= 0 || !this.canHarvest(item)) continue;
      const dx = item.x - x;
      const dz = item.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > bestDist) continue;
      best = item;
      bestDist = dist;
    }
    return best;
  }

  update(dt, player) {
    if (this.cooldown > 0) this.cooldown -= dt;
    const root = player && player.root ? player.root : null;
    this.playerPos = root ? { x: root.position.x, z: root.position.z } : null;
    const target = this.playerPos ? this.findNearest(this.playerPos.x, this.playerPos.z) : null;
    this.target = target;
    this.updateSway(dt);
    return this.target;
  }

  beginHit() {
    const item = this.target;
    if (!item || item.left <= 0 || this.cooldown > 0) {
      this.pending = null;
      return false;
    }
    if (this.playerPos) {
      const dx = item.x - this.playerPos.x;
      const dz = item.z - this.playerPos.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 0.001) {
        item.axisX = dx / len;
        item.axisZ = dz / len;
      }
    }
    if (this.player && this.player.faceTo) this.player.faceTo(item.x, item.z);
    const duration = this.startSwing(item);
    const impact = this.player && this.player.strikeImpactTime ? this.player.strikeImpactTime() : 0;
    const fallback = duration > 0 ? duration * IMPACT_SHARE : FALLBACK_DURATION * IMPACT_SHARE;
    this.pending.delay = Number.isFinite(impact) && impact > 0 ? impact : fallback;
    return true;
  }

  startSwing(item) {
    if (!item) return;
    this.pending = { item };
    const swing = this.player && this.player.strike ? this.player.strike() : 0;
    const duration = Number.isFinite(swing) && swing > 0 ? swing : FALLBACK_DURATION;
    this.cooldown = Math.max(this.hitCooldown, duration);
    return duration;
  }

  impactSound(withTool) {
    if (!this.tool) return BARE_SOUND;
    if (withTool === 'mine' && this.tool.harvest && !this.tool.harvest.kinds.includes('rock')) return BARE_SOUND;
    return withTool;
  }

  resolvePending() {
    const pending = this.pending;
    if (!pending) return null;
    this.pending = null;
    const item = pending.item;
    const still = this.target === item && item.left > 0;
    if (!still) return null;
    item.hits += 1;
    item.left -= 1;
    this.startSway(item);
    return {
      item,
      sound: item.def.kind === 'tree' ? this.impactSound('chop') : this.impactSound('mine'),
      total: item.total,
      left: item.left,
      exhausted: item.left <= 0,
    };
  }

  startSway(item) {
    if (!item || !SWAY_KINDS.includes(item.def.kind)) return;
    item.sway = Math.min(1, 0.3 + item.hits * 0.08);
    this.swayTime = 0;
  }

  takeYield() {
    const item = this.target;
    if (!item || item.left > 0) return null;
    this.target = null;
    if (item.anchor && !item.anchor.isDisposed()) item.anchor.setEnabled(false);
    const yields = this.tool && this.tool.harvest ? item.def.gather : BARE_YIELDS;
    const owned = item.def.kind === 'ore';
    return Object.entries(yields)
      .filter(([key, amount]) => typeof key === 'string' && Number.isFinite(amount) && amount > 0)
      .map(([itemKey, amount]) => ({ itemKey, amount: owned ? item.total : amount }));
  }

  shakeNearby(kind) {
    for (const item of this.entries) {
      if (item.def.kind !== kind || item.left <= 0) continue;
      if (!this.playerPos) continue;
      const dx = item.x - this.playerPos.x;
      const dz = item.z - this.playerPos.z;
      if (dx * dx + dz * dz > REACH * REACH) continue;
      item.sway = Math.max(item.sway, 0.2);
    }
    this.swayTime = 0;
  }

  updateSway(dt) {
    this.swayTime += dt;
    const falloff = Math.exp(-SWAY_DECAY * dt);
    const bend = SWAY_AMPLITUDE * Math.sin(this.swayTime * SWAY_SPEED);
    for (const item of this.entries) {
      if (item.sway <= 0) continue;
      item.sway *= falloff;
      if (item.sway < 0.01) item.sway = 0;
      if (!item.anchor || item.anchor.isDisposed()) continue;
      const angleX = item.axisZ * bend * item.sway;
      const angleZ = -item.axisX * bend * item.sway;
      item.anchor.rotation.set(angleX, item.anchor.rotation.y, angleZ);
    }
  }

  setPlayer(player) {
    this.player = player || null;
  }
}
