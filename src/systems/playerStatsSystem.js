// Stavy postavy — zdraví hráče, jeho doplňování a chvilka klidu po probuzení.
// Čísla bere z katalogu postavy; scéně jen hlásí změnu zdraví.
import { PLAYER_BASE } from '../data/catalogs/player.js';

export default class PlayerStatsSystem {

  constructor() {
    this.maxHealth = this.amount(PLAYER_BASE.maxHealth, 100, 1);
    this.health = this.maxHealth;
    this.sinceHurt = 0;
    this.immunity = 0;
    this.onChange = null;
  }

  amount(value, fallback, min) {
    if (Number.isFinite(value) && value >= min) return value;
    return fallback;
  }

  hurt(points) {
    if (!Number.isFinite(points) || points <= 0) return false;
    if (this.immunity > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - points);
    this.sinceHurt = 0;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
    return true;
  }

  resurrect() {
    this.health = this.maxHealth;
    this.sinceHurt = 0;
    this.immunity = this.amount(PLAYER_BASE.reviveImmunitySeconds, 0, 0);
    if (this.onChange) this.onChange(this.health, this.maxHealth);
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.immunity > 0) this.immunity = Math.max(0, this.immunity - dt);
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
    return { health: this.health };
  }

  apply(data) {
    const saved = data && Number.isFinite(data.health) ? data.health : this.maxHealth;
    const clamped = Math.max(0, Math.min(this.maxHealth, saved));
    this.health = clamped > 0 ? clamped : this.maxHealth;
    this.sinceHurt = 0;
    this.immunity = 0;
    if (this.onChange) this.onChange(this.health, this.maxHealth);
  }

  defaultState() {
    return { health: this.maxHealth };
  }

  registerState(key, provider) {
    this.saveKey = key;
    this.savedState = provider;
  }
}
