// Co je hráč zač — výchozí čísla postavy na jednom místě; systém stavů je jen čte.
// Později sem přibudou vlastnosti (síla, obratnost, výdrž) a co z nich pro hráče plyne.
export const PLAYER_BASE = {
  maxHealth: 100,
  regenDelaySeconds: 8,
  regenPerSecond: 1.5,
  reviveImmunitySeconds: 2,
  punch: {
    damage: 6,
    cooldown: 0.65,
    reach: 1.8,
    arcDegrees: 110,
    heightLimit: 0.9,
  },
};
