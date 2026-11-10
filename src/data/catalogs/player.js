// Co je hráč zač — výchozí čísla postavy na jednom místě; systém stavů je jen čte.
// Útok a obrana rozhodují o zásahu, zdraví o přežití; další vlastnosti přibudou později.
export const PLAYER_BASE = {
  maxHealth: 100,
  attack: 12,
  defense: 10,
  regenDelaySeconds: 8,
  regenPerSecond: 1.5,
  reviveImmunitySeconds: 2,
  handReach: {
    distance: 2.6,
    heightLimit: 1,
  },
  punch: {
    damage: 6,
    cooldown: 1.0,
    reach: 1.8,
    heightLimit: 0.9,
  },
  stamina: {
    max: 100,
    sprintPerSecond: 18,
    attackCost: 8,
    gatherCost: 6,
    regenDelaySeconds: 1.2,
    regenPerSecond: 14,
    sprintResumeShare: 0.2,
  },
};
