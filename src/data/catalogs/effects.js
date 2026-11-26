// Efekty na postavě (výhody a postihy) — jméno, ikona, popis, kdy platí a co mění.
// Úpravy: obnova zdraví a energie a spotřeba energie během násobí, rána (v procentech) a útok se přičítají.
// Hojení nemá úpravy ani práh: ukazuje se, dokud běží léčení z jídla.
export const EFFECT_MODS = {
  healthRegen: 'multiply',
  staminaRegen: 'multiply',
  sprintCost: 'multiply',
  damage: 'add',
  attack: 'add',
};

export const EFFECTS = {
  well_fed: {
    label: 'Sytý',
    icon: '😋',
    kind: 'buff',
    text: 'Plné břicho. Zdraví se obnovuje rychleji.',
    need: 'hunger',
    above: 80,
    mods: { healthRegen: 2 },
  },
  hungry: {
    label: 'Hladový',
    icon: '🍽',
    kind: 'debuff',
    text: 'Kručí ti v břiše. Energie se obnovuje pomaleji a rány jsou slabší.',
    need: 'hunger',
    below: 30,
    mods: { staminaRegen: 0.75, damage: -10 },
  },
  starving: {
    label: 'Vyhladovělý',
    icon: '🦴',
    kind: 'debuff',
    text: 'Tělo už nemá z čeho brát. Zdraví ubývá, dokud se nenajíš.',
    need: 'hunger',
    below: 0,
    replaces: 'hungry',
    mods: { staminaRegen: 0.5, damage: -25, healthRegen: 0 },
    drainPerSecond: 0.3,
  },
  thirsty: {
    label: 'Žíznivý',
    icon: '💧',
    kind: 'debuff',
    text: 'Sucho v puse. Energie se obnovuje pomaleji a běh víc unavuje.',
    need: 'thirst',
    below: 30,
    mods: { staminaRegen: 0.75, sprintCost: 1.25 },
  },
  dehydrated: {
    label: 'Dehydratovaný',
    icon: '🥵',
    kind: 'debuff',
    text: 'Bez vody to dlouho nepůjde. Zdraví ubývá, dokud se nenapiješ.',
    need: 'thirst',
    below: 0,
    replaces: 'thirsty',
    mods: { staminaRegen: 0.5, sprintCost: 1.5, healthRegen: 0 },
    drainPerSecond: 0.5,
  },
  healing: {
    label: 'Hojení',
    icon: '💚',
    kind: 'buff',
    text: 'Jídlo se tráví a postupně doplňuje zdraví.',
  },
};

export function needEffects(needs) {
  const active = Object.keys(EFFECTS).filter((key) => {
    const def = EFFECTS[key];
    const value = needs ? needs[def.need] : undefined;
    if (!Number.isFinite(value)) return false;
    return Number.isFinite(def.above) ? value >= def.above : value <= def.below;
  });
  const replaced = new Set(active.map((key) => EFFECTS[key].replaces).filter(Boolean));
  return active.filter((key) => !replaced.has(key));
}

export function combineEffects(keys) {
  const total = Object.fromEntries(Object.entries(EFFECT_MODS).map(([mod, how]) => [mod, how === 'multiply' ? 1 : 0]));
  let drainPerSecond = 0;
  for (const key of keys) {
    const def = EFFECTS[key];
    if (!def) continue;
    for (const [mod, value] of Object.entries(def.mods || {})) {
      if (!Number.isFinite(value) || !(mod in total)) continue;
      if (EFFECT_MODS[mod] === 'multiply') total[mod] *= value;
      else total[mod] += value;
    }
    if (Number.isFinite(def.drainPerSecond)) drainPerSecond += def.drainPerSecond;
  }
  return { ...total, drainPerSecond };
}
