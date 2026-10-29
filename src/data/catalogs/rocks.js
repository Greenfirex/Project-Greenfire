// Recepty na kameny — tvar, rozměry, hrubost a odstín, ze kterých se ve hře skládá geometrie.
// Kámen nevzniká v modelovém souboru, ale rozkouskováním koule, takže se dá ladit jedním číslem.
const LIGHT_STONE = { texture: 'Rock030_1K-JPG_Color.jpg', normal: 'Rock030_1K-JPG_NormalGL.jpg' };
const WARM_STONE = { texture: 'Rock023_1K-JPG_Color.jpg', normal: 'Rock023_1K-JPG_NormalGL.jpg' };
const JAGGED_STONE = { texture: 'Rock045_1K-JPG_Color.jpg', normal: 'Rock045_1K-JPG_NormalGL.jpg' };

export const ROCK_RECIPES = {
  boulder_small: {
    ...LIGHT_STONE,
    seed: 1201,
    size: [0.42, 0.32, 0.4],
    detail: 2,
    roughness: 0.22,
    uvScale: 0.9,
    tint: [0.96, 0.95, 0.92],
  },
  boulder_flat: {
    ...LIGHT_STONE,
    seed: 4477,
    size: [0.52, 0.16, 0.46],
    detail: 2,
    roughness: 0.18,
    uvScale: 0.8,
    tint: [0.9, 0.89, 0.86],
  },
  boulder_large: {
    ...JAGGED_STONE,
    seed: 8811,
    size: [0.8, 0.58, 0.72],
    detail: 2,
    roughness: 0.28,
    uvScale: 0.4,
    tint: [0.92, 0.92, 0.9],
  },
  boulder_large_c: {
    ...WARM_STONE,
    seed: 3179,
    size: [0.72, 0.6, 0.68],
    detail: 2,
    roughness: 0.32,
    uvScale: 0.42,
    tint: [0.98, 0.95, 0.9],
  },
  boulder_tall: {
    ...WARM_STONE,
    seed: 5591,
    size: [0.38, 0.8, 0.38],
    detail: 2,
    roughness: 0.26,
    uvScale: 0.55,
    tint: [0.94, 0.92, 0.88],
  },
  cluster_pair: {
    ...LIGHT_STONE,
    seed: 9137,
    detail: 2,
    roughness: 0.24,
    uvScale: 0.8,
    tint: [0.95, 0.94, 0.9],
    parts: [
      { seed: 1011, size: [0.4, 0.3, 0.36], offset: [-0.24, 0, -0.06] },
      { seed: 2022, size: [0.3, 0.24, 0.28], offset: [0.26, 0, 0.12] },
    ],
  },
  cluster_jagged: {
    ...JAGGED_STONE,
    seed: 4411,
    detail: 2,
    roughness: 0.28,
    uvScale: 0.45,
    tint: [0.92, 0.92, 0.9],
    parts: [
      { seed: 3033, size: [0.42, 0.4, 0.4], offset: [0.12, 0, 0] },
      { seed: 4044, size: [0.26, 0.22, 0.24], offset: [-0.42, 0, 0.22] },
      { seed: 5055, size: [0.2, 0.18, 0.2], offset: [0.36, 0, -0.32] },
    ],
  },
  pebbles: {
    ...WARM_STONE,
    seed: 7717,
    detail: 2,
    roughness: 0.2,
    uvScale: 1.2,
    tint: [0.97, 0.94, 0.88],
    parts: [
      { seed: 6061, size: [0.17, 0.12, 0.16], offset: [-0.34, 0, -0.22] },
      { seed: 6062, size: [0.13, 0.1, 0.14], offset: [0.05, 0, -0.34] },
      { seed: 6063, size: [0.16, 0.11, 0.15], offset: [0.36, 0, -0.1] },
      { seed: 6064, size: [0.14, 0.1, 0.13], offset: [-0.12, 0, 0.3] },
      { seed: 6065, size: [0.12, 0.09, 0.12], offset: [0.3, 0, 0.28] },
    ],
  },
};

export function getRockRecipe(key) {
  return ROCK_RECIPES[key] || null;
}
