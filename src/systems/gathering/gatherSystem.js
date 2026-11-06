// Sběr surovin z krajiny — údery do věci, na kterou hráč ukáže, a hýbání modelem.
// Drží jen stav vyčerpávání a náklon modelu; modely dodává dekorace, hráče předává scéna.
const REACH = 2.6;
const BARE_COOLDOWN = 0.62;
const BARE_KINDS = ['tree'];
const BARE_SOUND = 'bare';
const PICKUP_SOUND = 'pickup';
const BARE_YIELDS = { wood: 1 };
const SWAY_KINDS = ['tree'];
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
    this.falls = [];
    this.onLand = null;
    this.onFell = null;
  }

  clear() {
    this.entries = [];
    this.target = null;
    this.playerPos = null;
    this.cooldown = 0;
    this.pending = null;
    this.falls = [];
  }

  totalFor(def) {
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

  setTool(tool) {
    this.tool = tool || null;
    this.hitCooldown = tool && tool.harvest ? tool.harvest.cooldown : BARE_COOLDOWN;
  }

  canHarvest(item) {
    if (!item) return false;
    if (item.def.byHand) return true;
    if (this.tool && this.tool.harvest) return this.tool.harvest.kinds.includes(item.def.kind);
    return BARE_KINDS.includes(item.def.kind);
  }

  itemAtCell(cx, cz) {
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
    for (const item of this.entries) {
      if (item.left <= 0 || !this.canHarvest(item)) continue;
      if (item.entry.cx === cx && item.entry.cz === cz) return item;
    }
    return null;
  }

  inReach(item) {
    if (!item || !this.playerPos) return false;
    const dx = item.x - this.playerPos.x;
    const dz = item.z - this.playerPos.z;
    return dx * dx + dz * dz <= REACH * REACH;
  }

  hitItem(item) {
    this.target = item || null;
    return this.beginHit();
  }

  syncPlayerPos(player) {
    const root = player && player.root ? player.root : null;
    if (!root || root.isDisposed()) return this.playerPos;
    this.playerPos = { x: root.position.x, z: root.position.z };
    return this.playerPos;
  }

  update(dt, player, cell) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.syncEntryPositions();
    this.syncPlayerPos(player);
    this.target = cell ? this.itemAtCell(cell.cx, cell.cz) : null;
    this.updateFalls(dt);
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
    const impact = this.player && item.def.byHand && this.player.pickupImpactTime
      ? this.player.pickupImpactTime()
      : this.player && this.player.strikeImpactTime ? this.player.strikeImpactTime() : 0;
    const fallback = duration > 0 ? duration * IMPACT_SHARE : FALLBACK_DURATION * IMPACT_SHARE;
    this.pending.delay = Number.isFinite(impact) && impact > 0 ? impact : fallback;
    console.info(`[gather] ${item.def.displayName}: ${item.left}/${item.total} úderů, nástroj ${this.tool ? this.tool.displayName : 'ruka'}`);
    return true;
  }

  startSwing(item) {
    if (!item) return 0;
    this.pending = { item };
    const swing = item.def.byHand && this.player && this.player.pickUp
      ? this.player.pickUp()
      : this.player && this.player.strike ? this.player.strike() : 0;
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
      sound: this.gatherSound(item),
      total: item.total,
      left: item.left,
      exhausted: item.left <= 0,
    };
  }

  gatherSound(item) {
    if (item.def.pickSound) return item.def.pickSound;
    if (item.def.byHand) return PICKUP_SOUND;
    return item.def.kind === 'tree' ? this.impactSound('chop') : this.impactSound('mine');
  }

  startSway(item) {
    if (!item || !SWAY_KINDS.includes(item.def.kind)) return;
    item.sway = Math.min(1, 0.3 + item.hits * 0.08);
    this.swayTime = 0;
  }

  takeYield(item, hide = true) {
    const source = item || this.target;
    if (!source || source.left > 0) return null;
    if (this.target === source) this.target = null;
    if (hide && source.anchor && !source.anchor.isDisposed()) source.anchor.setEnabled(false);
    const withTool = Boolean(this.tool && this.tool.harvest);
    const yields = withTool || source.def.byHand ? source.def.gather : BARE_YIELDS;
    return Object.entries(yields)
      .filter(([key, amount]) => typeof key === 'string' && Number.isFinite(amount) && amount > 0)
      .map(([itemKey, amount]) => ({ itemKey, amount: withTool ? amount : 1 }));
  }



  beginFall(item, fromX, fromZ) {
    if (!item || !item.anchor || item.anchor.isDisposed()) return false;
    const dx = item.x - fromX;
    const dz = item.z - fromZ;
    const length = Math.hypot(dx, dz) || 1;
    item.sway = 0;
    item.fall = { time: 0, duration: 1.05, dirX: dx / length, dirZ: dz / length, landed: false };
    this.falls.push(item);
    return true;
  }

  updateFalls(dt) {
    if (!this.falls.length) return;
    for (const item of this.falls.slice()) {
      const fall = item.fall;
      const anchor = item.anchor;
      if (!fall || !anchor || anchor.isDisposed()) {
        this.falls.splice(this.falls.indexOf(item), 1);
        continue;
      }
      fall.time += dt;
      const t = Math.min(1, fall.time / fall.duration);
      const angle = (Math.PI / 2) * t * t;
      anchor.rotation.x = angle * fall.dirZ;
      anchor.rotation.z = -angle * fall.dirX;
      if (!fall.landed && t >= 0.88) {
        fall.landed = true;
        if (this.onLand) this.onLand(item);
      }
      if (t >= 1) {
        this.falls.splice(this.falls.indexOf(item), 1);
        if (this.onFell) this.onFell(item);
      }
    }
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
      if (item.sway <= 0 || item.fall) continue;
      item.sway *= falloff;
      if (item.sway < 0.01) item.sway = 0;
      if (!item.anchor || item.anchor.isDisposed()) continue;
      const angleX = item.axisZ * bend * item.sway;
      const angleZ = -item.axisX * bend * item.sway;
      item.anchor.rotation.set(angleX, item.anchor.rotation.y, angleZ);
    }
  }

  markTaken(cx, cz) {
    for (const item of this.entries) {
      if (item.entry.cx !== cx || item.entry.cz !== cz) continue;
      item.left = 0;
      item.hits = item.total;
      if (this.target === item) this.target = null;
    }
  }

  setPlayer(player) {
    this.player = player || null;
  }
}
