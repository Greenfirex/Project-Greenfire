// Registr tvorů — jediné místo, které ví, jací tvorové ve hře existují.
// Každý tvor má vlastní soubor; tady se jen poskládají do mapy a přidají pomocné funkce.
import { SNAPPING_TURTLE } from './snappingTurtle.js';
import { SAND_DEVIL } from './sandDevil.js';
import { KOA_TIKI } from './koaTiki.js';
import { zeroResistances } from '../damage.js';

export const CREATURE_TYPES = {
  snapping_turtle: SNAPPING_TURTLE,
  sand_devil: SAND_DEVIL,
  koa_tiki: KOA_TIKI,
};

export const CREATURE_KEYS = Object.keys(CREATURE_TYPES);

export function getCreatureType(key) {
  return CREATURE_TYPES[key] || null;
}

export function getCreatureTier(type, key) {
  if (!type || !type.tiers) return null;
  return type.tiers[key] || type.tiers[type.defaultTier] || Object.values(type.tiers)[0];
}

export function creatureResistances(type, tier) {
  const merged = zeroResistances();
  for (const source of [type && type.resistances, tier && tier.resistances]) {
    for (const [key, value] of Object.entries(source || {})) {
      if (Object.hasOwn(merged, key) && Number.isFinite(value)) merged[key] = value;
    }
  }
  return merged;
}

export function creatureLength(type) {
  return Number.isFinite(type && type.length) ? type.length : 1;
}

export function creatureStat(type, tier, key) {
  const tierValue = tier ? tier[key] : undefined;
  if (Number.isFinite(tierValue)) return tierValue;
  const baseValue = type ? type[key] : undefined;
  return Number.isFinite(baseValue) ? baseValue : 0;
}

export function tierTint(tier) {
  const tint = tier && Array.isArray(tier.tint) ? tier.tint : [1, 1, 1];
  return { r: tint[0], g: tint[1], b: tint[2] };
}

export function creatureScale(type, tier) {
  const base = type && Number.isFinite(type.scale) ? type.scale : 1;
  const tierScale = tier && Number.isFinite(tier.scale) ? tier.scale : 1;
  return base * tierScale;
}
