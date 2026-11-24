// Co je hráč zač — výchozí čísla postavy, její vlastnosti (síla, obratnost, výdrž, inteligence) a úrovně na jednom místě.
// Čísla postavy platí pro průměrné vlastnosti; každý bod nad průměrem přidá, pod ním ubere.
import { zeroResistances } from './damage.js';

export const PLAYER_ATTRIBUTES = {
  average: 10,
  list: [
    { key: 'strength', start: 10, effects: { damage: 5, carry: 3 } },
    { key: 'agility', start: 10, effects: { attack: 1, defense: 1 } },
    { key: 'endurance', start: 10, effects: { health: 5, stamina: 5 } },
    { key: 'intelligence', start: 10, effects: { magicResist: 2 } },
  ],
};

export const ATTRIBUTE_KEYS = PLAYER_ATTRIBUTES.list.map((entry) => entry.key);

export const PLAYER_LEVELS = {
  firstLevelXp: 100,
  extraXpPerLevel: 50,
  pointsPerLevel: 3,
};

export function xpForNextLevel(level) {
  const current = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return PLAYER_LEVELS.firstLevelXp + (current - 1) * PLAYER_LEVELS.extraXpPerLevel;
}

export function startAttributes() {
  return Object.fromEntries(PLAYER_ATTRIBUTES.list.map((entry) => [entry.key, entry.start]));
}

export function attributeBonus(attributes) {
  const total = {};
  for (const entry of PLAYER_ATTRIBUTES.list) {
    const value = attributes && Number.isFinite(attributes[entry.key]) ? attributes[entry.key] : entry.start;
    const points = value - PLAYER_ATTRIBUTES.average;
    for (const [effect, perPoint] of Object.entries(entry.effects)) {
      total[effect] = (total[effect] || 0) + points * perPoint;
    }
  }
  return total;
}

export const PLAYER_BASE = {
  maxHealth: 100,
  attack: 12,
  defense: 10,
  armor: 0,
  carryWeight: 60,
  resistances: zeroResistances(),
  regenPerSecond: 0.2,
  reviveImmunitySeconds: 2,
  handReach: {
    distance: 2.6,
    heightLimit: 1,
  },
  punch: {
    damage: [1, 3],
    damageType: 'blunt',
    hitSound: 'hitPunch',
    heightLimit: 0.9,
    primary: { reach: 1.4, arc: 50, cooldown: 1.0, anim: 'punch' },
    secondary: { reach: 1.6, arc: 50, cooldown: 1.5, cost: 16, anim: 'heavyKick' },
  },
  dodge: {
    distance: 3.0,
    seconds: 0.75,
    cooldown: 0.4,
    cost: 20,
    immunity: 0.5,
  },
  stamina: {
    max: 100,
    sprintPerSecond: 18,
    attackCost: 4,
    gatherCost: 6,
    regenDelaySeconds: 1.2,
    regenPerSecond: 14,
    sprintResumeShare: 0.2,
  },
};
