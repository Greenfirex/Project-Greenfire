// Typy poškození a odolností — jediné místo, které zná jejich klíče, názvy a skupiny.
// Výchozí odolnost je nula; strop 75 % a odečtení zbroje platí stejně pro hráče i tvory.
// Záporná odolnost je slabina: rána se zvětší, nejvýš na dvojnásobek (−100 %).
export const DAMAGE_TYPES = {
  blunt: {
    label: 'Tupé poškození',
    short: 'Tupé',
    group: 'physical',
    icon: '🔨',
    description: 'Snižuje tupé poškození, třeba z klacku nebo pěsti.',
  },
  slashing: {
    label: 'Sečné poškození',
    short: 'Sečné',
    group: 'physical',
    icon: '🗡',
    description: 'Snižuje sečné poškození, třeba z drápů a čepelí.',
  },
  piercing: {
    label: 'Bodné poškození',
    short: 'Bodné',
    group: 'physical',
    icon: '🏹',
    description: 'Snižuje bodné poškození, třeba z kousnutí a šípů.',
  },
  fire: {
    label: 'Oheň',
    short: 'Oheň',
    group: 'magic',
    icon: '🔥',
    description: 'Snižuje ohnivé poškození. Strop je 75 %.',
  },
  ice: {
    label: 'Led',
    short: 'Led',
    group: 'magic',
    icon: '❄',
    description: 'Snižuje ledové poškození. Strop je 75 %.',
  },
  lightning: {
    label: 'Blesk',
    short: 'Blesk',
    group: 'magic',
    icon: '⚡',
    description: 'Snižuje bleskové poškození. Strop je 75 %.',
  },
};

export const DAMAGE_TYPE_KEYS = Object.keys(DAMAGE_TYPES);

export const DAMAGE_GROUPS = [
  { key: 'physical', label: 'Fyzické' },
  { key: 'magic', label: 'Magické' },
].map((group) => ({
  ...group,
  types: DAMAGE_TYPE_KEYS.filter((key) => DAMAGE_TYPES[key].group === group.key),
}));

export const MAX_RESISTANCE = 75;
export const MIN_RESISTANCE = -100;

export function zeroResistances() {
  return Object.fromEntries(DAMAGE_TYPE_KEYS.map((key) => [key, 0]));
}

export function clampResistance(value) {
  return Number.isFinite(value) ? Math.max(MIN_RESISTANCE, Math.min(MAX_RESISTANCE, value)) : 0;
}

export function damageBreakdown(points, damageType, resistances, armor) {
  const damage = Number(points);
  if (!Number.isFinite(damage) || damage <= 0) return { damage: 0, resistance: 0, afterResist: 0, armor: 0, dealt: 0, damageType };
  const type = DAMAGE_TYPES[damageType] || null;
  const resistance = type && resistances ? clampResistance(resistances[damageType]) : 0;
  const afterResist = damage * (1 - resistance / 100);
  const flat = type && type.group === 'physical' && Number.isFinite(armor) && armor > 0 ? armor : 0;
  const dealt = Math.max(1, Math.round(afterResist - flat));
  return { damage, resistance, afterResist, armor: flat, dealt, damageType };
}
