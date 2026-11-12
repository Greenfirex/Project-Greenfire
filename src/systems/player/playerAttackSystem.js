// Hráčův útok nablízko — kdy máchne rukou, kdy je dopad a jestli rána vyšla.
// O zásahu i o critu rozhodne porovnání útoku s obranou cíle; ubrané zdraví hlásí scéně, sám ho nedrží.
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import { creatureStat } from '../../data/catalogs/creatures/index.js';
import { rollStrike, rollDamage, normalizeRange, CRIT_MULTIPLIER } from '../../utils/combatRoll.js';

export default class PlayerAttackSystem {

  constructor() {
    const punch = PLAYER_BASE.punch || {};
    this.baseAttack = this.number(PLAYER_BASE.attack);
    this.attack = this.baseAttack;
    this.reach = this.number(punch.reach);
    this.heightLimit = this.number(punch.heightLimit);
    this.setWeapon(null);
    this.cooldown = 0;
    this.pending = null;
    this.impactTimer = 0;
    this.impactDelay = 0;
    this.target = null;
    this.nextUnarmed = 'punch';
    this.groundHeightAt = null;
    this.onHit = null;
    this.onMiss = null;
  }

  number(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  setWeapon(tool) {
    const weapon = tool && tool.weapon ? tool.weapon : null;
    const punch = PLAYER_BASE.punch || {};
    this.weaponAnim = weapon ? weapon.anim : null;
    this.attack = this.baseAttack + this.number(weapon ? weapon.attack : 0);
    this.damage = normalizeRange(weapon ? weapon.damage : punch.damage);
    this.cooldownSeconds = this.number(weapon ? weapon.cooldown : punch.cooldown);
  }

  canHit(creature, player) {
    if (!creature || !player || !player.root) return false;
    const root = player.root;
    const dx = creature.x - root.position.x;
    const dz = creature.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > this.reach) return false;
    const ground = this.groundHeightAt ? this.groundHeightAt(creature.x, creature.z) : root.position.y;
    return Math.abs(root.position.y - ground) <= this.heightLimit;
  }

  swing(creature, player) {
    if (this.cooldown > 0 || this.pending) return false;
    if (!this.canHit(creature, player)) return false;
    if (player.faceTo) player.faceTo(creature.x, creature.z, this.reach);
    const animKey = this.weaponAnim || this.nextUnarmed;
    if (!this.weaponAnim) this.nextUnarmed = animKey === 'punch' ? 'kick' : 'punch';
    player.strike(animKey);
    this.pending = { creature, damage: this.damage };
    this.impactTimer = 0;
    this.impactDelay = player.strikeImpactTime();
    this.cooldown = this.cooldownSeconds;
    this.target = creature;
    return true;
  }

  update(dt) {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - step);
    const pending = this.pending;
    if (!pending) return;
    this.impactTimer += step;
    if (this.impactTimer < this.impactDelay) return;
    this.pending = null;
    const creature = pending.creature;
    const defense = creatureStat(creature.type, creature.tier, 'defense');
    const strike = rollStrike(this.attack, defense);
    if (!strike.hit) {
      if (this.onMiss) this.onMiss(creature);
      return;
    }
    const rolled = rollDamage(pending.damage);
    const damage = strike.crit ? rolled * CRIT_MULTIPLIER : rolled;
    if (this.onHit) this.onHit(creature, damage, strike.crit);
  }
}
