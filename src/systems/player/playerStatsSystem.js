// Stavy postavy — úroveň, zkušenosti, vlastnosti, zdraví, obrana, zbroj, resistity a energie hráče.
// Čísla bere z katalogu postavy a přičte k nim, co dávají vlastnosti a efekty; scéně jen hlásí změnu zdraví, energie a postupu.
import { PLAYER_BASE, PLAYER_LEVELS, ATTRIBUTE_KEYS, attributeBonus, startAttributes, xpForNextLevel } from '../../data/catalogs/player.js';
import { DAMAGE_TYPES, DAMAGE_TYPE_KEYS, clampResistance, damageBreakdown } from '../../data/catalogs/damage.js';

export default class PlayerStatsSystem {

  constructor() {
    this.attributes = startAttributes();
    this.level = 1;
    this.xp = 0;
    this.points = 0;
    this.gear = {};
    this.maxHealth = 0;
    this.maxStamina = 0;
    this.health = 0;
    this.stamina = 0;
    this.lastHit = null;
    this.immunity = 0;
    this.heals = [];
    this.mods = { healthRegen: 1, staminaRegen: 1, sprintCost: 1, attack: 0, damage: 0 };
    const stamina = PLAYER_BASE.stamina || {};
    this.sprintDrainPerSecond = this.amount(stamina.sprintPerSecond, 0, 0);
    this.gatherCost = this.amount(stamina.gatherCost, 0, 0);
    this.staminaRegenDelay = this.amount(stamina.regenDelaySeconds, 0, 0);
    this.staminaRegenPerSecond = this.amount(stamina.regenPerSecond, 0, 0);
    this.sinceEffort = 0;
    this.sprintLocked = false;
    this.onChange = null;
    this.onStamina = null;
    this.onExhausted = null;
    this.onProgress = null;
    this.applyAttributes();
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
  }

  amount(value, fallback, min) {
    if (Number.isFinite(value) && value >= min) return value;
    return fallback;
  }

  applyAttributes() {
    const bonus = attributeBonus(this.attributes);
    const stamina = PLAYER_BASE.stamina || {};
    const oldHealth = this.maxHealth;
    const oldStamina = this.maxStamina;
    this.maxHealth = Math.max(1, this.amount(PLAYER_BASE.maxHealth, 100, 1) + (bonus.health || 0));
    this.maxStamina = Math.max(1, this.amount(stamina.max, 100, 1) + (bonus.stamina || 0));
    this.baseDefense = Math.max(0, this.amount(PLAYER_BASE.defense, 0, 0) + (bonus.defense || 0));
    this.baseArmor = this.amount(PLAYER_BASE.armor, 0, 0);
    this.carryWeight = Math.max(0, this.amount(PLAYER_BASE.carryWeight, 0, 0) + (bonus.carry || 0));
    this.resistances = this.readResistances(PLAYER_BASE.resistances, bonus.magicResist || 0);
    this.attributeCombat = { attack: bonus.attack || 0, damage: bonus.damage || 0 };
    this.refreshCombatBonus();
    this.sprintResume = this.maxStamina * Math.min(1, this.amount(stamina.sprintResumeShare, 0.2, 0));
    this.setGear(this.gear);
    if (this.health > 0) this.health = Math.max(1, Math.min(this.maxHealth, this.health + this.maxHealth - oldHealth));
    this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina + this.maxStamina - oldStamina));
  }

  setModifiers(mods) {
    const source = mods || {};
    const factor = (value) => (Number.isFinite(value) && value >= 0 ? value : 1);
    const extra = (value) => (Number.isFinite(value) ? value : 0);
    this.mods = {
      healthRegen: factor(source.healthRegen),
      staminaRegen: factor(source.staminaRegen),
      sprintCost: factor(source.sprintCost),
      attack: extra(source.attack),
      damage: extra(source.damage),
    };
    this.refreshCombatBonus();
  }

  refreshCombatBonus() {
    const base = this.attributeCombat || { attack: 0, damage: 0 };
    this.combatBonus = { attack: base.attack + this.mods.attack, damage: base.damage + this.mods.damage };
  }

  xpNeeded() {
    return xpForNextLevel(this.level);
  }

  notifyProgress() {
    if (this.onProgress) this.onProgress();
  }

  gainXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.xpNeeded()) {
      this.xp -= this.xpNeeded();
      this.level += 1;
      this.points += PLAYER_LEVELS.pointsPerLevel;
      gained += 1;
    }
    this.notifyProgress();
    return gained;
  }

  spendPoint(key) {
    if (this.points <= 0 || !ATTRIBUTE_KEYS.includes(key)) return false;
    this.attributes[key] += 1;
    this.points -= 1;
    this.applyAttributes();
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    this.notifyStamina();
    this.notifyProgress();
    return true;
  }

  gearStats(bonus) {
    const extra = bonus || {};
    return {
      defense: Math.max(0, this.baseDefense + (Number(extra.defense) || 0)),
      armor: Math.max(0, this.baseArmor + (Number(extra.armor) || 0)),
    };
  }

  setGear(bonus) {
    this.gear = bonus || {};
    const stats = this.gearStats(this.gear);
    this.defense = stats.defense;
    this.armor = stats.armor;
  }

  readResistances(source, magicBonus) {
    const out = {};
    for (const key of DAMAGE_TYPE_KEYS) {
      const value = source && Number.isFinite(source[key]) ? source[key] : 0;
      const extra = DAMAGE_TYPES[key].group === 'magic' ? magicBonus : 0;
      out[key] = clampResistance(value + extra);
    }
    return out;
  }

  notifyStamina() {
    if (this.onStamina) this.onStamina(this.stamina, this.maxStamina);
  }

  refreshSprintLock() {
    if (this.stamina <= 0) {
      if (!this.sprintLocked && this.onExhausted) this.onExhausted();
      this.sprintLocked = true;
    } else if (this.sprintLocked && this.stamina >= this.sprintResume) this.sprintLocked = false;
  }

  spendStamina(points) {
    if (!Number.isFinite(points) || points <= 0) return false;
    if (this.stamina <= 0 || this.health <= 0) return false;
    this.stamina = Math.max(0, this.stamina - points);
    this.sinceEffort = 0;
    this.refreshSprintLock();
    this.notifyStamina();
    return true;
  }

  protect(seconds) {
    if (Number.isFinite(seconds) && seconds > 0) this.immunity = Math.max(this.immunity, seconds);
  }

  canSpend(points) {
    if (this.health <= 0) return false;
    return !Number.isFinite(points) || points <= 0 || this.stamina >= points;
  }

  spendGather() {
    return this.spendStamina(this.gatherCost);
  }

  canSprint() {
    if (this.health <= 0) return false;
    if (this.sprintLocked) return false;
    return this.stamina > 0;
  }

  drainSprint(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.sprintDrainPerSecond <= 0 || this.stamina <= 0) return;
    this.stamina = Math.max(0, this.stamina - this.sprintDrainPerSecond * this.mods.sprintCost * dt);
    this.sinceEffort = 0;
    this.refreshSprintLock();
    this.notifyStamina();
  }

  tickStamina(dt, sprinting) {
    if (sprinting) {
      this.drainSprint(dt);
      return;
    }
    if (this.stamina >= this.maxStamina) {
      this.refreshSprintLock();
      return;
    }
    this.sinceEffort += dt;
    if (this.sinceEffort < this.staminaRegenDelay) return;
    if (this.staminaRegenPerSecond <= 0) return;
    const next = Math.min(this.maxStamina, this.stamina + this.staminaRegenPerSecond * this.mods.staminaRegen * dt);
    if (next === this.stamina) return;
    this.stamina = next;
    this.refreshSprintLock();
    this.notifyStamina();
  }

  hurt(points, damageType) {
    if (!Number.isFinite(points) || points <= 0) return 0;
    if (this.immunity > 0 || this.health <= 0) return 0;
    this.lastHit = damageBreakdown(points, damageType, this.resistances, this.armor);
    const dealt = this.lastHit.dealt;
    this.health = Math.max(0, this.health - dealt);
    this.sinceEffort = 0;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    return dealt;
  }

  drain(points) {
    if (!Number.isFinite(points) || points <= 0 || this.health <= 0) return 0;
    const lost = Math.min(this.health, points);
    this.health -= lost;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    return lost;
  }

  healOverTime(points, perSecond) {
    if (!Number.isFinite(points) || points <= 0 || this.health <= 0) return;
    const rate = Number.isFinite(perSecond) && perSecond > 0 ? perSecond : points;
    this.heals.push({ left: points, total: points, rate });
  }

  healState() {
    if (!this.heals.length) return null;
    let left = 0;
    let total = 0;
    let seconds = 0;
    for (const heal of this.heals) {
      left += heal.left;
      total += heal.total;
      seconds = Math.max(seconds, heal.left / heal.rate);
    }
    return { left, total, seconds };
  }

  tickHeals(dt) {
    if (!this.heals.length) return 0;
    let gain = 0;
    for (const heal of this.heals) {
      const step = Math.min(heal.left, heal.rate * dt);
      heal.left -= step;
      gain += step;
    }
    this.heals = this.heals.filter((heal) => heal.left > 0.0001);
    return gain;
  }

  resurrect() {
    this.heals = [];
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.sinceEffort = 0;
    this.sprintLocked = false;
    this.immunity = this.amount(PLAYER_BASE.reviveImmunitySeconds, 0, 0);
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    this.notifyStamina();
  }

  tick(dt, sprinting) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.immunity > 0) this.immunity = Math.max(0, this.immunity - dt);
    this.tickStamina(dt, sprinting);
    const healed = this.health > 0 ? this.tickHeals(dt) : 0;
    if (this.health <= 0) this.heals = [];
    if (this.health >= this.maxHealth) return;
    const rate = this.amount(PLAYER_BASE.regenPerSecond, 0, 0) * this.mods.healthRegen;
    if (rate <= 0 && healed <= 0) return;
    const next = Math.min(this.maxHealth, this.health + rate * dt + healed);
    if (next === this.health) return;
    this.health = next;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
  }

  serialize() {
    return {
      health: this.health,
      stamina: this.stamina,
      level: this.level,
      xp: this.xp,
      points: this.points,
      attributes: { ...this.attributes },
    };
  }

  whole(value, fallback, min) {
    return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
  }

  applyProgress(data) {
    const source = data || {};
    const start = startAttributes();
    const saved = source.attributes || {};
    this.attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, this.whole(saved[key], start[key], 1)]));
    this.level = this.whole(source.level, 1, 1);
    this.xp = Number.isFinite(source.xp) && source.xp >= 0 ? Math.min(source.xp, this.xpNeeded() - 1) : 0;
    this.points = this.whole(source.points, 0, 0);
    this.applyAttributes();
  }

  apply(data) {
    this.applyProgress(data);
    const saved = data && Number.isFinite(data.health) ? data.health : this.maxHealth;
    const clamped = Math.max(0, Math.min(this.maxHealth, saved));
    this.health = clamped > 0 ? clamped : this.maxHealth;
    const savedStamina = data && Number.isFinite(data.stamina) ? data.stamina : this.maxStamina;
    this.stamina = Math.max(0, Math.min(this.maxStamina, savedStamina));
    this.sinceEffort = 0;
    this.immunity = 0;
    this.heals = [];
    this.refreshSprintLock();
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    this.notifyStamina();
    this.notifyProgress();
  }

  defaultState() {
    return { level: 1, xp: 0, points: 0, attributes: startAttributes() };
  }
}
