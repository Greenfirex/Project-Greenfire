// Bestiář — kolik tvorů kterého druhu hráč zabil a co se o nich díky tomu ví.
// Drží jen počty zabití a prahy odemčení; okno bestiáře a panel tvora se ho ptají, co smí ukázat.
const UNLOCKS = {
  portrait: 1, summary: 1, health: 1, speed: 1,
  habitat: 3, loot: 3, attack: 3, defense: 3, damage: 3,
  notes: 5, sight: 5, armor: 5,
  resistances: 8,
};

export const UNLOCK_STAGES = [...new Set(Object.values(UNLOCKS))].sort((a, b) => a - b);

export default class BestiarySystem {

  constructor() {
    this.kills = {};
    this.revealAll = false;
  }

  record(kind) {
    if (!kind) return { first: false, unlocked: [] };
    const count = this.killsOf(kind) + 1;
    this.kills[kind] = count;
    const unlocked = Object.keys(UNLOCKS).filter((stat) => UNLOCKS[stat] === count);
    return { first: count === 1, unlocked };
  }

  killsOf(kind) {
    const count = Number(this.kills[kind]);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  needed(stat) {
    return Number.isFinite(UNLOCKS[stat]) ? UNLOCKS[stat] : 0;
  }

  known(kind) {
    return this.revealAll || this.killsOf(kind) > 0;
  }

  unlocked(kind, stat) {
    return this.revealAll || this.killsOf(kind) >= this.needed(stat);
  }

  setRevealAll(on) {
    this.revealAll = Boolean(on);
  }

  defaultState() {
    return { kills: {} };
  }

  serialize() {
    return { kills: { ...this.kills } };
  }

  apply(data) {
    this.kills = {};
    const kills = data && data.kills && typeof data.kills === 'object' ? data.kills : {};
    for (const [kind, count] of Object.entries(kills)) {
      const value = Number(count);
      if (Number.isFinite(value) && value > 0) this.kills[kind] = Math.floor(value);
    }
  }
}
