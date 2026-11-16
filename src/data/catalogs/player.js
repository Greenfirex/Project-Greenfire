// Co je hráč zač — výchozí čísla postavy na jednom místě; systém stavů je jen čte.
// Útok a obrana rozhodují o zásahu, zdraví o přežití; další vlastnosti přibudou později.
import { zeroResistances } from './damage.js';

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
    distance: 1.2,
    seconds: 0.18,
    cooldown: 0.4,
    cost: 20,
    immunity: 0.25,
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
