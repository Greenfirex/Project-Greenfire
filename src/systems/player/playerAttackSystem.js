// Hráčův útok nablízko — kdy máchne, kdy je dopad a koho rána zasáhne.
// O zásahu rozhoduje míření: tvor musí stát ve výseči před postavou; kostka rozhodne jen, jak rána sedla.
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import { creatureStat, creatureLength } from '../../data/catalogs/creatures/index.js';
import { rollQuality, rollDamage, normalizeRange, CRIT_MULTIPLIER, GRAZE_MULTIPLIER } from '../../utils/combatRoll.js';
import { angleGap } from '../../utils/angles.js';

const BODY_SHARE = 0.3;

export default class PlayerAttackSystem {

  constructor() {
    const punch = PLAYER_BASE.punch || {};
    this.baseAttack = this.number(PLAYER_BASE.attack);
    this.attack = this.baseAttack;
    this.heightLimit = this.number(punch.heightLimit);
    this.setWeapon(null);
    this.cooldown = 0;
    this.pending = null;
    this.impactTimer = 0;
    this.impactDelay = 0;
    this.nextUnarmed = 'punch';
    this.groundHeightAt = null;
    this.candidates = null;
    this.onHit = null;
    this.onWhiff = null;
  }

  number(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  setWeapon(tool) {
    const weapon = tool && tool.weapon ? tool.weapon : null;
    const punch = PLAYER_BASE.punch || {};
    const stats = this.weaponStats(tool);
    this.weaponAnim = weapon ? weapon.anim : null;
    this.hitSound = (weapon && weapon.hitSound) || punch.hitSound || null;
    this.attack = stats.attack;
    this.damage = stats.damage;
    this.cooldownSeconds = this.number(weapon ? weapon.cooldown : punch.cooldown);
    this.reach = this.number(weapon && Number.isFinite(weapon.reach) ? weapon.reach : punch.reach);
    this.arc = this.number(weapon && Number.isFinite(weapon.arc) ? weapon.arc : punch.arc) * Math.PI / 180;
  }

  weaponStats(tool) {
    const weapon = tool && tool.weapon ? tool.weapon : null;
    const punch = PLAYER_BASE.punch || {};
    return {
      attack: this.baseAttack + this.number(weapon ? weapon.attack : 0),
      damage: normalizeRange(weapon ? weapon.damage : punch.damage),
    };
  }

  bodyRadius(creature) {
    return creatureLength(creature && creature.type) * BODY_SHARE;
  }

  levelOk(creature, player) {
    const root = player.root;
    const ground = this.groundHeightAt ? this.groundHeightAt(creature.x, creature.z) : root.position.y;
    return Math.abs(root.position.y - ground) <= this.heightLimit;
  }

  canHit(creature, player) {
    if (!creature || !player || !player.root) return false;
    const root = player.root;
    const distance = Math.hypot(creature.x - root.position.x, creature.z - root.position.z);
    if (distance - this.bodyRadius(creature) > this.reach) return false;
    return this.levelOk(creature, player);
  }

  inArc(creature, player) {
    if (!this.canHit(creature, player)) return false;
    const root = player.root;
    const dx = creature.x - root.position.x;
    const dz = creature.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    const body = this.bodyRadius(creature);
    if (distance <= body) return true;
    const turn = Math.abs(angleGap(player.facing, Math.atan2(dx, dz)));
    return turn <= this.arc / 2 + Math.asin(Math.min(1, body / distance));
  }

  canSwing() {
    return this.cooldown <= 0 && !this.pending;
  }

  swingAt(x, z, player) {
    if (!this.canSwing() || !player) return false;
    if (player.faceTo) player.faceTo(x, z);
    const animKey = this.weaponAnim || this.nextUnarmed;
    if (!this.weaponAnim) this.nextUnarmed = animKey === 'punch' ? 'kick' : 'punch';
    player.strike(animKey);
    this.pending = { player, damage: this.damage };
    this.impactTimer = 0;
    this.impactDelay = player.strikeImpactTime();
    this.cooldown = this.cooldownSeconds;
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
    const creature = this.struck(pending.player);
    if (!creature) {
      if (this.onWhiff) this.onWhiff();
      return;
    }
    const defense = creatureStat(creature.type, creature.tier, 'defense');
    const quality = rollQuality(this.attack, defense);
    const scale = quality === 'crit' ? CRIT_MULTIPLIER : quality === 'graze' ? GRAZE_MULTIPLIER : 1;
    if (this.onHit) this.onHit(creature, rollDamage(pending.damage) * scale, quality === 'crit', quality === 'graze');
  }

  struck(player) {
    if (!player || !player.root || !this.candidates) return null;
    const root = player.root;
    let best = null;
    let bestDistance = Infinity;
    for (const creature of this.candidates()) {
      if (!this.inArc(creature, player)) continue;
      const distance = Math.hypot(creature.x - root.position.x, creature.z - root.position.z);
      if (distance >= bestDistance) continue;
      best = creature;
      bestDistance = distance;
    }
    return best;
  }
}
