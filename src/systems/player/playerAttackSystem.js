// Hráčův útok nablízko — kdy máchne, kdy je dopad a koho rána zasáhne.
// Rána míří do výseče: dopadne na všechny tvory v ní a poškození se mezi ně rozdělí.
// Každá zbraň (i pěst) má primární a sekundární ránu; kostka u každého tvora rozhodne, jestli sedla, škrábla, nebo minula.
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import { creatureStat, creatureLength, creatureResistances } from '../../data/catalogs/creatures/index.js';
import { mitigateDamage } from '../../data/catalogs/damage.js';
import { rollQuality, rollDamage, normalizeRange, CRIT_MULTIPLIER, GRAZE_MULTIPLIER } from '../../utils/combatRoll.js';
import { weaponBlows } from '../../utils/weaponBlows.js';
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
    this.groundHeightAt = null;
    this.candidates = null;
    this.onHit = null;
    this.onWhiff = null;
    this.onMiss = null;
    this.onStruck = null;
    this.lastAnims = {};
  }

  number(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  setWeapon(tool) {
    const weapon = tool && tool.weapon ? tool.weapon : null;
    const source = weapon || PLAYER_BASE.punch || {};
    this.hitSound = source.hitSound || (PLAYER_BASE.punch || {}).hitSound || null;
    this.damageType = source.damageType || null;
    this.attack = this.weaponStats(tool).attack;
    const blows = weaponBlows(weapon);
    const inRadians = (blow) => ({ ...blow, arc: blow.arc * Math.PI / 180 });
    this.blows = { primary: inRadians(blows.primary), secondary: inRadians(blows.secondary) };
    this.reach = this.blows.primary.reach;
  }

  blow(kind) {
    return this.blows[kind] || this.blows.primary;
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

  canHit(creature, player, blow = this.blows.primary) {
    if (!creature || !player || !player.root) return false;
    const root = player.root;
    const distance = Math.hypot(creature.x - root.position.x, creature.z - root.position.z);
    if (distance - this.bodyRadius(creature) > blow.reach) return false;
    return this.levelOk(creature, player);
  }

  inArc(creature, player, blow) {
    if (!this.canHit(creature, player, blow)) return false;
    const root = player.root;
    const dx = creature.x - root.position.x;
    const dz = creature.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    const body = this.bodyRadius(creature);
    if (distance <= body) return true;
    const turn = Math.abs(angleGap(player.facing, Math.atan2(dx, dz)));
    return turn <= blow.arc / 2 + Math.asin(Math.min(1, body / distance));
  }

  canSwing() {
    return this.cooldown <= 0 && !this.pending;
  }

  swingAt(x, z, player, kind = 'primary') {
    if (!this.canSwing() || !player) return false;
    const blow = this.blow(kind);
    if (player.faceTo) player.faceTo(x, z);
    player.strike(this.pickAnim(kind, blow.anim));
    this.pending = { player, blow };
    this.impactTimer = 0;
    this.impactDelay = player.strikeImpactTime();
    this.cooldown = blow.cooldown;
    return true;
  }

  pickAnim(kind, anim) {
    const list = Array.isArray(anim) ? anim : [anim];
    const fresh = list.length > 1 ? list.filter((key) => key !== this.lastAnims[kind]) : list;
    const pick = fresh[Math.floor(Math.random() * fresh.length)];
    this.lastAnims[kind] = pick;
    return pick;
  }

  update(dt) {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - step);
    const pending = this.pending;
    if (!pending) return;
    this.impactTimer += step;
    if (this.impactTimer < this.impactDelay) return;
    this.pending = null;
    const struck = this.struckAll(pending.player, pending.blow);
    if (!struck.length) {
      if (this.onWhiff) this.onWhiff();
      return;
    }
    if (this.onStruck) this.onStruck(struck);
    const share = 1 / struck.length;
    for (const creature of struck) {
      const defense = creatureStat(creature.type, creature.tier, 'defense');
      const quality = rollQuality(this.attack, defense);
      if (quality === 'miss') {
        if (this.onMiss) this.onMiss(creature);
        continue;
      }
      const scale = quality === 'crit' ? CRIT_MULTIPLIER : quality === 'graze' ? GRAZE_MULTIPLIER : 1;
      const raw = rollDamage(pending.blow.damage) * scale * share;
      const armor = creatureStat(creature.type, creature.tier, 'armor');
      const dealt = mitigateDamage(raw, this.damageType, creatureResistances(creature.type, creature.tier), armor);
      const absorbed = Math.max(0, Math.round(raw) - dealt);
      if (this.onHit) this.onHit(creature, dealt, quality === 'crit', quality === 'graze', absorbed);
    }
  }

  struckAll(player, blow) {
    if (!player || !player.root || !this.candidates) return [];
    const { x, z } = player.root.position;
    const distance = (creature) => Math.hypot(creature.x - x, creature.z - z);
    return this.candidates()
      .filter((creature) => this.inArc(creature, player, blow))
      .sort((a, b) => distance(a) - distance(b));
  }
}
