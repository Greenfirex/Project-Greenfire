// Typy rybek — rozměry, barvy a podoba hejna, ze kterých se ve hře skládá roj.
// Rybka nevzniká v modelovém souboru, takže se dá ladit jedním číslem.
const PROPORTION = { height: 0.38, width: 0.17 };
export const FISH_SWIM_DEPTH = 0.8;

export const FISH_TYPES = {
  fish_blue: {
    label: 'Stříbrné',
    length: 0.42,
    bodyTint: [0.5, 0.64, 0.76],
    bellyTint: [0.94, 0.96, 0.97],
    finTint: [0.42, 0.56, 0.68],
    radius: 6,
    count: 16,
    speed: 1,
    depth: 0.42,
  },
  fish_gold: {
    label: 'Zlaté',
    length: 0.36,
    bodyTint: [1.05, 0.62, 0.12],
    bellyTint: [1, 0.9, 0.55],
    finTint: [0.95, 0.5, 0.05],
    radius: 5,
    count: 14,
    speed: 1.1,
    depth: 0.3,
  },
  fish_green: {
    label: 'Zelené',
    length: 0.4,
    bodyTint: [0.25, 0.72, 0.42],
    bellyTint: [0.85, 0.95, 0.7],
    finTint: [0.2, 0.6, 0.34],
    radius: 6,
    count: 16,
    speed: 0.9,
    depth: 0.34,
  },
  fish_red: {
    label: 'Červené',
    length: 0.38,
    bodyTint: [1.05, 0.35, 0.25],
    bellyTint: [1, 0.82, 0.7],
    finTint: [0.9, 0.25, 0.18],
    radius: 5,
    count: 14,
    speed: 1.05,
    depth: 0.32,
  },
  fish_micro: {
    label: 'Drobné',
    length: 0.15,
    bodyTint: [0.62, 0.74, 0.82],
    bellyTint: [0.97, 0.98, 0.96],
    finTint: [0.52, 0.64, 0.74],
    radius: 4,
    count: 30,
    speed: 1.35,
    depth: 0.22,
  },
};

export const FISH_KEYS = Object.keys(FISH_TYPES);

export function getFishType(key) {
  return FISH_TYPES[key] || FISH_TYPES.fish_blue;
}

export function fishSize(type) {
  return {
    length: type.length,
    height: type.length * PROPORTION.height,
    width: type.length * PROPORTION.width,
  };
}
