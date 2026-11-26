// Přežití — hlad a žízeň hráče. Pomalu ubývají (během rychleji), jídlo a pití je doplní.
// Z hladu a žízně skládá efekty a jejich součet úprav; scéně jen hlásí změnu.
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import { needEffects, combineEffects } from '../../data/catalogs/effects.js';

export default class SurvivalSystem {

  constructor() {
    const config = PLAYER_BASE.survival || {};
    this.max = Number.isFinite(config.max) && config.max > 0 ? config.max : 100;
    this.hungerRate = Math.max(0, Number(config.hungerPerSecond) || 0);
    this.thirstRate = Math.max(0, Number(config.thirstPerSecond) || 0);
    this.sprintFactor = Math.max(1, Number(config.sprintFactor) || 1);
    this.reviveAt = Number.isFinite(config.reviveAt) ? config.reviveAt : this.max;
    this.hunger = this.max;
    this.thirst = this.max;
    this.effects = [];
    this.onNeeds = null;
    this.onEffects = null;
    this.refreshEffects();
  }

  clamp(value) {
    return Math.max(0, Math.min(this.max, value));
  }

  tick(dt, sprinting) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const pace = sprinting ? this.sprintFactor : 1;
    this.hunger = this.clamp(this.hunger - this.hungerRate * pace * dt);
    this.thirst = this.clamp(this.thirst - this.thirstRate * pace * dt);
    this.changed();
  }

  feed(hunger, thirst) {
    const food = Number.isFinite(hunger) && hunger > 0 ? hunger : 0;
    const water = Number.isFinite(thirst) && thirst > 0 ? thirst : 0;
    if (!food && !water) return false;
    this.hunger = this.clamp(this.hunger + food);
    this.thirst = this.clamp(this.thirst + water);
    this.changed();
    return true;
  }

  changed() {
    if (this.onNeeds) this.onNeeds(this.hunger, this.thirst, this.max);
    this.refreshEffects();
  }

  refreshEffects() {
    const next = needEffects({ hunger: this.hunger, thirst: this.thirst });
    if (next.length === this.effects.length && next.every((key, index) => key === this.effects[index])) return;
    this.effects = next;
    if (this.onEffects) this.onEffects(this.effects);
  }

  mods() {
    return combineEffects(this.effects);
  }

  revive() {
    this.hunger = this.clamp(Math.max(this.hunger, this.reviveAt));
    this.thirst = this.clamp(Math.max(this.thirst, this.reviveAt));
    this.changed();
  }

  serialize() {
    return { hunger: this.hunger, thirst: this.thirst };
  }

  apply(data) {
    const source = data || {};
    this.hunger = Number.isFinite(source.hunger) ? this.clamp(source.hunger) : this.max;
    this.thirst = Number.isFinite(source.thirst) ? this.clamp(source.thirst) : this.max;
    this.changed();
  }

  defaultState() {
    return { hunger: this.max, thirst: this.max };
  }
}
