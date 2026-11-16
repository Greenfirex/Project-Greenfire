// Hod v boji — porovná útok s obranou a rozhodne, jestli rána sedla, škrábla, nebo minula.
// Stejné pravidlo pro hráče i tvory: čím větší převaha, tím víc ran sedne a tím častěji kriticky.

const MIN_CHANCE = 0.05;
const MAX_CHANCE = 0.95;
const CRIT_SHARE = 0.75;
const MAX_CRIT = 0.4;
const GRAZE_SHARE = 0.5;

export const CRIT_MULTIPLIER = 2;
export const GRAZE_MULTIPLIER = 0.5;

export function normalizeRange(value) {
  if (Array.isArray(value)) {
    const low = Number(value[0]);
    const high = Number(value[1]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return low <= high ? [low, high] : [high, low];
    }
  }
  const fixed = Number(value);
  return Number.isFinite(fixed) ? [fixed, fixed] : [0, 0];
}

export function rollDamage(value) {
  const [low, high] = normalizeRange(value);
  if (high <= low) return low;
  return Math.floor(low + Math.random() * (high - low + 1));
}

export function damageText(value) {
  const [low, high] = normalizeRange(value);
  return low === high ? String(low) : `${low}–${high}`;
}

function chanceOf(attack, defense) {
  const a = Number.isFinite(attack) && attack > 0 ? attack : 0;
  const d = Number.isFinite(defense) && defense > 0 ? defense : 0;
  if (a === 0 && d === 0) return 0.5;
  const share = (a * a) / (a * a + d * d);
  return Math.min(MAX_CHANCE, Math.max(MIN_CHANCE, share));
}

function critChanceOf(chance) {
  const extra = (chance - 0.5) * CRIT_SHARE;
  return Math.min(MAX_CRIT, Math.max(0, extra));
}

export function strikeChances(attack, defense) {
  const hit = chanceOf(attack, defense);
  const graze = (1 - hit) * GRAZE_SHARE;
  return { hit, graze, miss: 1 - hit - graze, crit: critChanceOf(hit) };
}

export function rollQuality(attack, defense) {
  const { hit, graze, crit } = strikeChances(attack, defense);
  const roll = Math.random();
  if (roll >= hit) return roll < hit + graze ? 'graze' : 'miss';
  return Math.random() < crit ? 'crit' : 'normal';
}
