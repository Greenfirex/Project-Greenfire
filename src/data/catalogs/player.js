// Co je hráč zač — výchozí čísla postavy na jednom místě; systém stavů je jen čte.
// Útok a obrana rozhodují o zásahu, zdraví o přežití; další vlastnosti přibudou později.
export const PLAYER_BASE = {
  maxHealth: 100,
  attack: 12,
  defense: 10,
  regenDelaySeconds: 8,
  regenPerSecond: 1.5,
  reviveImmunitySeconds: 2,
  punch: {
    damage: 6,
    cooldown: 1.0,
    reach: 1.8,
    heightLimit: 0.9,
  },
};
