// Katalog brushů — deklarace „co se má na zóně vyplnit".
// Editor je bere do palety a generátor podle nich plní zóny; přidání brushu = jeden záznam.
export const BRUSHES = {
  forest_exact: {
    label: 'Les',
    shape: 'blob',
    pool: [
      'tree_pine_tall', 'tree_pine_tall_b', 'tree_pine_tall_c',
      'tree_pine_round', 'tree_pine_round_c', 'tree_pine_small',
      'tree_default', 'tree_oak', 'tree_thin', 'tree_fat',
      'tree_cone', 'tree_detailed', 'tree_blocks', 'tree_plateau',
      'tree_simple', 'tree_small', 'tree_tall',
    ],
  },
  meadow: {
    label: 'Louka',
    shape: 'blob',
    pool: ['grass', 'grass', 'grass_leafs', 'grass_leafs', 'flower', 'flower_red', 'bush_small'],
  },
  rocks: {
    label: 'Kameny',
    shape: 'blob',
    pool: ['rock_large', 'rock_large_c', 'rock_small', 'rock_small_flat', 'rock_tall'],
  },
  stumps: {
    label: 'Pařezy a dřevo',
    shape: 'blob',
    pool: ['stump', 'stump_old', 'log', 'log_stack'],
  },
  mushrooms: {
    label: 'Houby',
    shape: 'blob',
    pool: ['mushroom_red', 'mushroom_tan', 'bush_small'],
  },
  grass: {
    label: 'Tráva',
    shape: 'blob',
    pool: [],
  },
  trail: {
    label: 'Cesta',
    shape: 'line',
    style: 'dirt',
    styles: ['dirt', 'stone', 'wood'],
    poolByStyle: {
      dirt: [
        'ground_pathStraight', 'ground_pathBend', 'ground_pathCorner', 'ground_pathCornerSmall',
        'ground_pathCross', 'ground_pathEnd', 'ground_pathEndClosed', 'ground_pathSplit',
        'ground_pathOpen', 'ground_pathSide', 'ground_pathSideOpen', 'ground_pathTile',
        'ground_pathRocks', 'ground_pathBendBank',
      ],
      stone: ['path_stone', 'path_stoneCircle', 'path_stoneCorner', 'path_stoneEnd'],
      wood: ['path_wood', 'path_woodCorner', 'path_woodEnd'],
    },
  },
  cliff_rim: {
    label: 'Rám útesů',
    shape: 'perimeter',
    stack: 2,
    pool: ['cliff_large', 'cliff_half'],
  },
  hill_low: {
    label: 'Kopec 2 m',
    shape: 'blob',
    height: 2,
  },
  hill_mid: {
    label: 'Kopec 3 m',
    shape: 'blob',
    height: 3,
  },
  hill_high: {
    label: 'Kopec 4 m',
    shape: 'blob',
    height: 4,
  },
  pond: {
    label: 'Jezírko',
    shape: 'outline_fill',
    bed: { pool: ['river_open'], liftY: 0 },
    inner: { pool: ['water_pool'], liftY: 0.005 },
    edge: { pool: ['river_side_open'], rotateToDry: true, liftY: 0.005 },
    scatter: { pool: ['lily_large', 'lily_small'], fill: 0.25, liftY: 0.02 },
  },
  stream: {
    label: 'Potok',
    shape: 'outline_fill',
    bed: { pool: ['river_open'], liftY: 0 },
    inner: { pool: ['water_pool'], liftY: 0.005 },
    edge: { pool: ['river_side_open'], rotateToDry: true, liftY: 0.005 },
  },
  camp: {
    label: 'Tábor',
    shape: 'blob',
    pool: ['tent', 'campfire', 'crate', 'barrel'],
  },
};

export const BRUSH_KEYS = Object.keys(BRUSHES);

export function getBrush(brushKey) {
  return BRUSHES[brushKey] || null;
}
