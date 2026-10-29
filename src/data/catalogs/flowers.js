// Recepty na květiny — výška stonku, velikost květu a barvy.
// Květina nevzniká v modelovém souboru, takže se dá ladit jedním číslem.
export const FLOWER_TYPES = {
  flower_white: {
    label: 'Bílý květ',
    height: 0.26,
    size: 0.055,
    petals: 6,
    stamen: 0.035,
    petalTint: [1.2, 1.18, 1],
    centerTint: [1.3, 1.05, 0.35],
    stemTint: [0.32, 0.5, 0.26],
  },
  flower_yellow: {
    label: 'Žlutý květ',
    height: 0.24,
    size: 0.05,
    petals: 6,
    stamen: 0.03,
    petalTint: [1.25, 1, 0.22],
    centerTint: [0.95, 0.72, 0.16],
    stemTint: [0.32, 0.52, 0.24],
  },
  flower_pink: {
    label: 'Růžový ibišek',
    height: 0.28,
    size: 0.062,
    petals: 5,
    stamen: 0.05,
    petalTint: [1.25, 0.5, 0.72],
    centerTint: [1.2, 0.95, 0.3],
    stemTint: [0.3, 0.48, 0.26],
  },
  flower_coral: {
    label: 'Korálový květ',
    height: 0.25,
    size: 0.058,
    petals: 5,
    stamen: 0.045,
    petalTint: [1.25, 0.36, 0.26],
    centerTint: [1.05, 0.85, 0.25],
    stemTint: [0.32, 0.5, 0.26],
  },
};

export const FLOWER_KEYS = Object.keys(FLOWER_TYPES);

export function getFlowerType(key) {
  return FLOWER_TYPES[key] || FLOWER_TYPES.flower_white;
}
