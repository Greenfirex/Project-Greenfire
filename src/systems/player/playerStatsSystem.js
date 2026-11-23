// Stavy postavy — zdraví, obrana, zbroj, resistity a výdrž hráče, doplňování a chvilka klidu po probuzení.
// Čísla bere z katalogu postavy; scéně jen hlásí změnu zdraví a výdrže.
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import { DAMAGE_TYPE_KEYS, MAX_RESISTANCE, mitigateDamage } from '../../data/catalogs/damage.js';

export default class PlayerStatsSystem {

  constructor() {
    this.maxHealth = this.amount(PLAYER_BASE.maxHealth, 100, 1);
    this.health = this.maxHealth;
    this.baseDefense = this.amount(PLAYER_BASE.defense, 0, 0);
    this.baseArmor = this.amount(PLAYER_BASE.armor, 0, 0);
    this.defense = this.baseDefense;
    this.armor = this.baseArmor;
    this.carryWeight = this.amount(PLAYER_BASE.carryWeight, 0, 0);
    this.resistances = this.readResistances(PLAYER_BASE.resistances);
    this.immunity = 0;
    this.heals = [];
    const stamina = PLAYER_BASE.stamina || {};
    this.maxStamina = this.amount(stamina.max, 100, 1);
    this.stamina = this.maxStamina;
    this.sprintDrainPerSecond = this.amount(stamina.sprintPerSecond, 0, 0);
    this.gatherCost = this.amount(stamina.gatherCost, 0, 0);
    this.staminaRegenDelay = this.amount(stamina.regenDelaySeconds, 0, 0);
    this.staminaRegenPerSecond = this.amount(stamina.regenPerSecond, 0, 0);
    const resumeShare = this.amount(stamina.sprintResumeShare, 0.2, 0);
    this.sprintResume = this.maxStamina * Math.min(1, resumeShare);
    this.sinceEffort = 0;
    this.sprintLocked = false;
    this.onChange = null;
    this.onStamina = null;
    this.onExhausted = null;
  }

  amount(value, fallback, min) {
    if (Number.isFinite(value) && value >= min) return value;
    return fallback;
  }

  gearStats(bonus) {
    const extra = bonus || {};
    return {
      defense: Math.max(0, this.baseDefense + (Number(extra.defense) || 0)),
      armor: Math.max(0, this.baseArmor + (Number(extra.armor) || 0)),
    };
  }

  setGear(bonus) {
    const stats = this.gearStats(bonus);
    this.defense = stats.defense;
    this.armor = stats.armor;
  }

  readResistances(source) {
    const out = {};
    for (const key of DAMAGE_TYPE_KEYS) {
      const value = source && Number.isFinite(source[key]) ? source[key] : 0;
      out[key] = Math.max(0, Math.min(MAX_RESISTANCE, value));
    }
    return out;
  }

  mitigate(points, damageType) {
    return mitigateDamage(points, damageType, this.resistances, this.armor);
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
    this.stamina = Math.max(0, this.stamina - this.sprintDrainPerSecond * dt);
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
    const next = Math.min(this.maxStamina, this.stamina + this.staminaRegenPerSecond * dt);
    if (next === this.stamina) return;
    this.stamina = next;
    this.refreshSprintLock();
    this.notifyStamina();
  }

  hurt(points, damageType) {
    if (!Number.isFinite(points) || points <= 0) return 0;
    if (this.immunity > 0 || this.health <= 0) return 0;
    const dealt = this.mitigate(points, damageType);
    this.health = Math.max(0, this.health - dealt);
    this.sinceEffort = 0;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    return dealt;
  }

  healOverTime(points, perSecond) {
    if (!Number.isFinite(points) || points <= 0 || this.health <= 0) return;
    const rate = Number.isFinite(perSecond) && perSecond > 0 ? perSecond : points;
    this.heals.push({ left: points, rate });
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
    const rate = this.amount(PLAYER_BASE.regenPerSecond, 0, 0);
    if (rate <= 0 && healed <= 0) return;
    const next = Math.min(this.maxHealth, this.health + rate * dt + healed);
    if (next === this.health) return;
    this.health = next;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
  }

  serialize() {
    return { health: this.health, stamina: this.stamina };
  }

  apply(data) {
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
  }

  defaultState() {
    return { health: this.maxHealth, stamina: this.maxStamina };
  }
}
