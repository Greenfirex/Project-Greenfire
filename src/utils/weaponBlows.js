// Primární a sekundární rána zbraně (bez zbraně pěsti) — dosah, úhel výseče, prodleva, cena v energii a poškození.
// Sekundární rána je vždy o stejný násobek silnější; co v ní zbraň neurčí, převezme z primární.
import { PLAYER_BASE } from '../data/catalogs/player.js';
import { normalizeRange } from './combatRoll.js';

export const SECONDARY_DAMAGE_SCALE = 1.5;

function amount(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function blowOf(data, damage, cost, base) {
  const source = data || {};
  return {
    anim: source.anim || (base ? base.anim : null),
    damage,
    reach: amount(source.reach, base ? base.reach : 0),
    arc: amount(source.arc, base ? base.arc : 0),
    cooldown: amount(source.cooldown, base ? base.cooldown : 0),
    cost: amount(source.cost, cost),
  };
}

export function weaponBlows(weapon) {
  const source = weapon || PLAYER_BASE.punch || {};
  const [low, high] = normalizeRange(source.damage);
  const attackCost = amount((PLAYER_BASE.stamina || {}).attackCost, 0);
  const primary = blowOf(source.primary, [low, high], attackCost, null);
  const strong = [Math.round(low * SECONDARY_DAMAGE_SCALE), Math.round(high * SECONDARY_DAMAGE_SCALE)];
  const secondary = blowOf(source.secondary, strong, primary.cost, primary);
  return { primary, secondary };
}
