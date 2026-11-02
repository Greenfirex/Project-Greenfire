// Boj nablízko — kdy hráč máchne rukou, kdy je dopad a jestli rána vyšla.
// Čísla bere z katalogu postavy; ubrané zdraví hlásí scéně, sám ho nedrží.
import { PLAYER_BASE } from '../data/catalogs/player.js';

export default class CombatSystem {

  constructor() {
    const punch = PLAYER_BASE.punch || {};
    this.damage = this.number(punch.damage);
    this.cooldownSeconds = this.number(punch.cooldown);
    this.reach = this.number(punch.reach);
    this.arcCosine = Math.cos((this.number(punch.arcDegrees) * Math.PI) / 360);
    this.heightLimit = this.number(punch.heightLimit);
    this.cooldown = 0;
    this.pending = null;
    this.impactTimer = 0;
    this.impactDelay = 0;
    this.target = null;
    this.groundHeightAt = null;
    this.onHit = null;
  }

  number(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  canHit(creature, player) {
    if (!creature || !player || !player.root) return false;
    const root = player.root;
    const dx = creature.x - root.position.x;
    const dz = creature.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > this.reach) return false;
    if (distance > 0.001) {
      const forwardX = Math.sin(player.facing);
      const forwardZ = Math.cos(player.facing);
      if ((dx * forwardX + dz * forwardZ) / distance < this.arcCosine) return false;
    }
    const ground = this.groundHeightAt ? this.groundHeightAt(creature.x, creature.z) : root.position.y;
    return Math.abs(root.position.y - ground) <= this.heightLimit;
  }

  swing(creature, player) {
    if (this.cooldown > 0 || this.pending) return false;
    if (!this.canHit(creature, player)) return false;
    if (player.faceTo) player.faceTo(creature.x, creature.z, this.reach);
    const length = player.strike('chopBare');
    this.pending = { creature, damage: this.damage };
    this.impactTimer = 0;
    this.impactDelay = player.strikeImpactTime();
    this.cooldown = Math.max(this.cooldownSeconds, length);
    this.target = creature;
    return true;
  }

  update(dt, player) {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - step);
    const pending = this.pending;
    if (!pending) return;
    this.impactTimer += step;
    if (this.impactTimer < this.impactDelay) return;
    this.pending = null;
    if (!this.canHit(pending.creature, player)) return;
    if (this.onHit) this.onHit(pending.creature, pending.damage);
  }
}
