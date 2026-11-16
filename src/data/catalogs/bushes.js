// Recepty na keře — tvar, rozměry v metrech, počet karet listí a textura.
// Keř nevzniká v modelovém souboru, takže se dá ladit jedním číslem.
// sprigs = podíly větviček vedle sebe v textuře, leafTint = korekce jen listí (květy zůstanou).
export const BUSH_TYPES = {
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
    tint: [0.5, 0.7, 0.33],
  },
  hibiscus: {
    label: 'Ibišek',
    seed: 1301,
    texture: 'bush_hibiscus.png',
    sprigs: [0.8, 0.2],
    shape: 'dome',
    height: 1.7,
    width: 2.3,
    depth: 2.2,
    cards: 54,
    cardSize: 1.15,
    inner: 1.4,
    lean: 0.6,
    tint: [0.85, 0.85, 0.85],
    leafTint: [0.97, 1.27, 0.3],
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
    tint: [0.65, 0.9, 0.38],
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
    tint: [0.61, 0.9, 0.28],
  },
};

export const BUSH_KEYS = Object.keys(BUSH_TYPES);

export function getBushRecipe(key) {
  return BUSH_TYPES[key] || BUSH_TYPES.round;
}
