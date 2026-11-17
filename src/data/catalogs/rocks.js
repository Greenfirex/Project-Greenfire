// Kameny pro obklad útesů a rámy jeskyní: buď model ze sady (ROCK_MODELS), nebo recept,
// ze kterého se geometrie složí rozkouskováním koule. Recepty zbývají jen pro kameny bez sady.
import { ASSET_DIRS } from './assetPaths.js';

export const ROCK_MODELS = [
  'cliff_stone_wide', 'cliff_stone_tall', 'cliff_stone_slab', 'cliff_stone_wide_b',
  'cliff_stone_tall_b', 'cliff_stone_block', 'cliff_stone_ledge', 'cliff_stone_stack',
  'boulder_small', 'boulder_large', 'boulder_large_c', 'boulder_tall',
];

export function rockModelUrl(key) {
  return ROCK_MODELS.includes(key) ? `${ASSET_DIRS.rocks}${key}.gltf` : null;
}

const CLAY = { texture: 'Ground071_1K-JPG_Color.jpg', normal: 'Ground071_1K-JPG_NormalGL.jpg' };
const BLACK_STONE = { texture: 'Rock063_1K-JPG_Color.jpg', normal: 'Rock063_1K-JPG_NormalGL.jpg' };

export const ROCK_RECIPES = {
  cliff_clod_round: {
    ...CLAY,
    seed: 6611,
    size: [0.9, 0.7, 0.5],
    detail: 2,
    roughness: 0.16,
    uvScale: 0.45,
    tint: [0.95, 0.92, 0.88],
  },
  cliff_clod_wide: {
    ...CLAY,
    seed: 2087,
    size: [1.05, 0.55, 0.48],
    detail: 2,
    roughness: 0.14,
    uvScale: 0.42,
    tint: [0.9, 0.87, 0.82],
  },
  cliff_clod_tall: {
    ...CLAY,
    seed: 4759,
    size: [0.66, 0.9, 0.46],
    detail: 2,
    roughness: 0.18,
    uvScale: 0.44,
    tint: [1, 0.96, 0.9],
  },
  cliff_clod_pair: {
    ...CLAY,
    seed: 8329,
    detail: 2,
    roughness: 0.15,
    uvScale: 0.44,
    tint: [0.92, 0.89, 0.84],
    parts: [
      { seed: 8329, size: [0.7, 0.5, 0.46], offset: [-0.25, 0, 0] },
      { seed: 1151, size: [0.55, 0.45, 0.42], offset: [0.5, 0.18, 0] },
    ],
  },
  cliff_black_mass: {
    ...BLACK_STONE,
    seed: 7927,
    detail: 2,
    roughness: 0.28,
    uvScale: 0.42,
    tint: [0.3, 0.31, 0.3],
    parts: [
      { seed: 7081, size: [0.8, 0.35, 0.74], offset: [-0.45, 0, -0.4] },
      { seed: 7082, size: [0.66, 0.28, 0.58], offset: [0.44, 0, -0.38] },
      { seed: 7083, size: [0.7, 0.4, 0.62], offset: [-0.34, 0.18, 0.44] },
      { seed: 7084, size: [0.56, 0.32, 0.54], offset: [0.42, 0.2, 0.4] },
      { seed: 7085, size: [0.6, 0.44, 0.62], offset: [0.04, 0.38, -0.04] },
      { seed: 7086, size: [0.5, 0.36, 0.48], offset: [-0.2, 0.62, 0.22] },
      { seed: 7087, size: [0.42, 0.38, 0.4], offset: [0.28, 0.68, -0.14] },
    ],
  },
  cliff_black_pile: {
    ...BLACK_STONE,
    seed: 2749,
    detail: 2,
    roughness: 0.26,
    uvScale: 0.55,
    tint: [0.28, 0.29, 0.28],
    parts: [
      { seed: 7121, size: [0.54, 0.4, 0.5], offset: [-0.3, 0, -0.2] },
      { seed: 7122, size: [0.44, 0.3, 0.4], offset: [0.24, 0, 0.04] },
      { seed: 7123, size: [0.36, 0.28, 0.34], offset: [-0.04, 0.3, 0.3] },
      { seed: 7124, size: [0.28, 0.22, 0.26], offset: [0.36, 0.32, 0.26] },
      { seed: 7125, size: [0.2, 0.2, 0.2], offset: [-0.36, 0.22, 0.32] },
    ],
  },
};

export function getRockRecipe(key) {
  return ROCK_RECIPES[key] || null;
}
