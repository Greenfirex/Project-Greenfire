// Recepty na keře — tvar, rozměry v metrech, počet karet listí a textura.
// Keř nevzniká v modelovém souboru, takže se dá ladit jedním číslem.
export const BUSH_TYPES = {
  laurel: {
    label: 'Vavřínový keř',
    seed: 1301,
    texture: 'bush_broadleaf.png',
    shape: 'dome',
    height: 2.5,
    width: 3,
    depth: 3,
    cards: 52,
    cardSize: 1.5,
    lean: 0.55,
    tint: [0.82, 0.94, 0.74],
  },
  round: {
    label: 'Kulatý keř',
    seed: 1709,
    texture: 'bush_broadleaf2.png',
    shape: 'clump',
    lobes: 3,
    height: 1.9,
    width: 2.6,
    depth: 2.3,
    cards: 44,
    cardSize: 1.25,
    lean: 0.5,
    tint: [0.74, 0.87, 0.68],
  },
  bramble: {
    label: 'Ostružiník',
    seed: 2803,
    texture: 'bush_bramble.png',
    shape: 'clump',
    lobes: 5,
    height: 1.7,
    width: 2.4,
    depth: 2.4,
    cards: 46,
    cardSize: 1.12,
    inner: 2,
    lean: 0.85,
    tint: [0.7, 0.85, 0.66],
  },
  low: {
    label: 'Nízký divoký keř',
    seed: 3121,
    texture: 'bush_bramble2.png',
    shape: 'hedge',
    height: 1.3,
    width: 2.8,
    depth: 2,
    cards: 50,
    cardSize: 1,
    lean: 0.4,
    tint: [0.78, 0.91, 0.73],
  },
};

export const BUSH_KEYS = Object.keys(BUSH_TYPES);

export function getBushRecipe(key) {
  return BUSH_TYPES[key] || BUSH_TYPES.laurel;
}
