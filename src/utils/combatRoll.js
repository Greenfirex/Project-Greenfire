// Hod v boji — porovná útok s obranou a rozhodne, jestli rána vyšla a jestli byla citlivá.
// Stejné pravidlo pro hráče i tvory: čím větší převaha, tím víc ran vyjde a tím častěji kriticky.

const MIN_CHANCE = 0.05;
const MAX_CHANCE = 0.95;
const CRIT_SHARE = 0.75;
const MAX_CRIT = 0.4;

export const CRIT_MULTIPLIER = 2;

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

export function rollStrike(attack, defense) {
  const chance = chanceOf(attack, defense);
  if (Math.random() >= chance) return { hit: false, crit: false };
  return { hit: true, crit: Math.random() < critChanceOf(chance) };
}
