// Stavy postavy — zdraví, obrana, zbroj, resistity a výdrž hráče, doplňování a chvilka klidu po probuzení.
// Čísla bere z katalogu postavy; scéně jen hlásí změnu zdraví a výdrže.
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import { DAMAGE_TYPES, DAMAGE_TYPE_KEYS, MAX_RESISTANCE } from '../../data/catalogs/damage.js';

export default class PlayerStatsSystem {

  constructor() {
    this.maxHealth = this.amount(PLAYER_BASE.maxHealth, 100, 1);
    this.health = this.maxHealth;
    this.defense = this.amount(PLAYER_BASE.defense, 0, 0);
    this.armor = this.amount(PLAYER_BASE.armor, 0, 0);
    this.resistances = this.readResistances(PLAYER_BASE.resistances);
    this.sinceHurt = 0;
    this.immunity = 0;
    const stamina = PLAYER_BASE.stamina || {};
    this.maxStamina = this.amount(stamina.max, 100, 1);
    this.stamina = this.maxStamina;
    this.sprintDrainPerSecond = this.amount(stamina.sprintPerSecond, 0, 0);
    this.attackCost = this.amount(stamina.attackCost, 0, 0);
    this.gatherCost = this.amount(stamina.gatherCost, 0, 0);
    this.staminaRegenDelay = this.amount(stamina.regenDelaySeconds, 0, 0);
    this.staminaRegenPerSecond = this.amount(stamina.regenPerSecond, 0, 0);
    const resumeShare = this.amount(stamina.sprintResumeShare, 0.2, 0);
    this.sprintResume = this.maxStamina * Math.min(1, resumeShare);
    this.sinceEffort = 0;
    this.sprintLocked = false;
    this.onChange = null;
    this.onStamina = null;
  }

  amount(value, fallback, min) {
    if (Number.isFinite(value) && value >= min) return value;
    return fallback;
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
    const damage = Number(points);
    if (!Number.isFinite(damage) || damage <= 0) return 0;
    const type = DAMAGE_TYPES[damageType] || null;
    const rawShare = type && Number.isFinite(this.resistances[damageType]) ? this.resistances[damageType] : 0;
    const share = Math.max(0, Math.min(MAX_RESISTANCE, rawShare));
    const afterResistance = damage * (1 - share / 100);
    const armor = type && type.group === 'physical' ? this.armor : 0;
    return Math.max(1, Math.round(afterResistance - armor));
  }

  notifyStamina() {
    if (this.onStamina) this.onStamina(this.stamina, this.maxStamina);
  }

  refreshSprintLock() {
    if (this.stamina <= 0) this.sprintLocked = true;
    else if (this.sprintLocked && this.stamina >= this.sprintResume) this.sprintLocked = false;
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

  spendAttack() {
    return this.spendStamina(this.attackCost);
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
    this.sinceHurt = 0;
    this.sinceEffort = 0;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    return dealt;
  }

  resurrect() {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.sinceHurt = 0;
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
    if (this.health >= this.maxHealth) return;
    this.sinceHurt += dt;
    if (this.sinceHurt < this.amount(PLAYER_BASE.regenDelaySeconds, Infinity, 0)) return;
    const rate = this.amount(PLAYER_BASE.regenPerSecond, 0, 0);
    if (rate <= 0) return;
    const next = Math.min(this.maxHealth, this.health + rate * dt);
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
    this.sinceHurt = 0;
    this.sinceEffort = 0;
    this.immunity = 0;
    this.refreshSprintLock();
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    this.notifyStamina();
  }

  defaultState() {
    return { health: this.maxHealth, stamina: this.maxStamina };
  }
}
