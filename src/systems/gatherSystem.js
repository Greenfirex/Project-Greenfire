// Sber surovin z krajiny - najde nejblizsi strom nebo kamen, pocita udery a hybe s nim.
// Drzi jen stav vycerpavani a nakloneni modelu; modely dodava dekorace, hrace predava scena.
const REACH = 2.6;
const BARE_COOLDOWN = 0.62;
const BARE_KINDS = ['tree', 'log'];
const BARE_SOUND = 'bare';
const BARE_YIELDS = { wood: 1 };
const SWAY_KINDS = ['tree', 'log'];
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
    this.player = null;
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

  totalFor(def) {
    if (def.kind === 'ore') return ORE_HITS;
    return Object.values(def.gather).reduce((sum, n) => sum + n, 0);
  }

  addEntry(entry, def, anchor) {
    if (!def || !def.gather || !anchor) return null;
    const total = this.totalFor(def);
    if (total <= 0) return null;
    const item = {
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
    };
    this.entries.push(item);
    return item;
  }

  ensureEntry(anchor) {
    const def = anchor.metadata?.def;
    const entry = anchor.metadata?.entry;
    if (!def || !entry || !def.gather) return null;
    for (const item of this.entries) {
      if (item.anchor !== anchor) continue;
      item.entry = entry;
      if (item.left <= 0) Object.assign(item, { left: item.total, hits: 0 });
      return item;
    }
    return this.addEntry(entry, def, anchor);
  }

  syncEntryPositions() {
    for (const item of this.entries) {
      const anchor = item.anchor;
      if (!anchor || anchor.isDisposed()) continue;
      item.x = anchor.position.x;
      item.z = anchor.position.z;
    }
  }

  syncFromDeco() {
    const deco = this.decoSystem;
    if (!deco || !deco.readyEntries) return;
    const fresh = [];
    for (const anchor of deco.readyEntries()) {
      const item = this.ensureEntry(anchor);
      if (item) fresh.push(item);
    }
    this.retainEntries(fresh);
  }

  retainEntries(fresh) {
    const live = new Set(fresh);
    this.entries = this.entries.filter((item) => live.has(item));
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
      if (!Number.isFinite(dist)) continue;
      if (dist > bestDist) continue;
      best = item;
      bestDist = dist;
    }
    return best;
  }

  syncPlayerPos(player) {
    const root = player && player.root ? player.root : null;
    if (!root || root.isDisposed()) return this.playerPos;
    this.playerPos = { x: root.position.x, z: root.position.z };
    return this.playerPos;
  }

  update(dt, player) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.syncEntryPositions();
    this.syncPlayerPos(player);
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
    this.syncPlayerPos(this.player);
    if (!this.playerPos) {
      this.pending = null;
      return false;
    }
    const reachX = item.x - this.playerPos.x;
    const reachZ = item.z - this.playerPos.z;
    if (reachX * reachX + reachZ * reachZ > REACH * REACH) {
      this.pending = null;
      this.target = null;
      return false;
    }
    const len = Math.sqrt(reachX * reachX + reachZ * reachZ);
    if (len > 0.001) {
      item.axisX = reachX / len;
      item.axisZ = reachZ / len;
    }
    if (this.player && this.player.faceTo) this.player.faceTo(item.x, item.z, REACH);
    const duration = this.startSwing(item);
    const impact = this.player && this.player.strikeImpactTime ? this.player.strikeImpactTime() : 0;
    const fallback = duration > 0 ? duration * IMPACT_SHARE : FALLBACK_DURATION * IMPACT_SHARE;
    this.pending.delay = Number.isFinite(impact) && impact > 0 ? impact : fallback;
    console.info(`[gather] ${item.def.displayName}: ${item.left}/${item.total} úderů, nástroj ${this.tool ? this.tool.displayName : 'ruka'}`);
    return true;
  }

  explicitTotal(item) {
    const sum = Object.values(item.def.gather).reduce((acc, n) => acc + n, 0);
    return sum > 0 ? sum : item.total;
  }

  startSwing(item) {
    if (!item) return 0;
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
    if (!item || item.left <= 0 || !this.canHarvest(item)) return null;
    if (item.anchor && item.anchor.isDisposed()) return null;
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

  takeYield(item) {
    const source = item || this.target;
    if (!source || source.left > 0) return null;
    if (this.target === source) this.target = null;
    if (source.anchor && !source.anchor.isDisposed()) source.anchor.setEnabled(false);
    const withTool = Boolean(this.tool && this.tool.harvest);
    const yields = withTool ? source.def.gather : BARE_YIELDS;
    return Object.entries(yields)
      .filter(([key, amount]) => typeof key === 'string' && Number.isFinite(amount) && amount > 0)
      .map(([itemKey, amount]) => ({ itemKey, amount: withTool ? this.toolYieldAmount(source, amount) : 1 }));
  }

  toolYieldAmount(source, amount) {
    if (source.def.kind !== 'ore') return amount;
    return this.explicitTotal(source);
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
