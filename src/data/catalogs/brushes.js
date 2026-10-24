// Katalog brushů — deklarace „co se má na zóně vyplnit“.
// Editor je bere do palety a podle typu vyplní buňku dlaždicí nebo objektem; přidání brushu = jeden záznam.
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
    deco: true,
  },
  meadow: {
    label: 'Louka',
    shape: 'blob',
    pool: ['flower', 'flower_red', 'bush_small'],
    deco: true,
  },
  rocks: {
    label: 'Kameny',
    shape: 'blob',
    pool: ['rock_large', 'rock_large_c', 'rock_small', 'rock_small_flat', 'rock_tall'],
    deco: true,
  },
  stumps: {
    label: 'Pařezy a dřevo',
    shape: 'blob',
    pool: ['stump', 'stump_old', 'log', 'log_stack'],
    deco: true,
  },
  mushrooms: {
    label: 'Houby',
    shape: 'blob',
    pool: ['mushroom_red', 'mushroom_tan', 'bush_small'],
    deco: true,
  },
  grass: {
    label: 'Tráva',
    shape: 'blob',
    flora: true,
  },
  trail: {
    label: 'Cesta',
    shape: 'line',
    style: 'dirt',
    styles: ['dirt', 'stone', 'wood'],
  },
  cliff_rim: {
    label: 'Rám útesů',
    shape: 'perimeter',
    stack: 2,
    pool: ['cliff_large', 'cliff_half'],
    deco: true,
  },
  hill_low: {
    label: 'Kopec 2 m',
    shape: 'blob',
    height: 2,
    tile: 'floor_grass',
  },
  hill_mid: {
    label: 'Kopec 3 m',
    shape: 'blob',
    height: 3,
    tile: 'floor_grass',
  },
  hill_high: {
    label: 'Kopec 4 m',
    shape: 'blob',
    height: 4,
    tile: 'floor_grass',
  },
  hollow_shallow: {
    label: 'Prohlubeň 1 m',
    shape: 'blob',
    height: -1,
    tile: 'floor_grass',
  },
  hollow_deep: {
    label: 'Hlubší prohlubeň 2 m',
    shape: 'blob',
    height: -2,
    tile: 'floor_grass',
  },
  ore: {
    label: 'Ruda',
    shape: 'blob',
    style: 'iron',
    styles: ['iron', 'copper'],
    poolByStyle: {
      iron: ['ore_iron'],
      copper: ['ore_copper'],
    },
    deco: true,
  },
  camp: {
    label: 'Tábor',
    shape: 'blob',
    pool: ['tent', 'campfire', 'crate', 'barrel'],
    deco: true,
  },
};

export const BRUSH_KEYS = Object.keys(BRUSHES);

export function getBrush(brushKey) {
  return BRUSHES[brushKey] || null;
}
