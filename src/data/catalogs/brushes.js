// Katalog brushů — deklarace „co se má na zóně vyplnit“.
// Povrchový štětec se skládá ze seznamu podkladů, takže nový povrch stačí přidat v katalogu dekorací.
import { surfaceEntries } from './decorations.js';
import { HEIGHT_STEP } from '../maps/layoutStore.js';

const SURFACES = surfaceEntries();
const surfaceStyle = (entry) => entry.key.replace(/^floor_/, '');

function levelMeters(level) {
  const n = Math.round(Math.abs(level) * HEIGHT_STEP * 10) / 10;
  return `${String(n).replace('.', ',')} m`;
}

function depthMeters(level) {
  return `−${levelMeters(level)}`;
}

const SURFACE_BRUSH = SURFACES.length
  ? {
      label: 'Povrch',
      shape: 'blob',
      surfaceOnly: true,
      style: surfaceStyle(SURFACES[0]),
      styles: SURFACES.map(surfaceStyle),
      poolByStyle: Object.fromEntries(SURFACES.map((entry) => [surfaceStyle(entry), [entry.key]])),
      texture: Object.fromEntries(SURFACES.map((entry) => [surfaceStyle(entry), entry.texture])),
      styleLabels: Object.fromEntries(SURFACES.map((entry) => [surfaceStyle(entry), entry.label])),
    }
  : null;

export const BRUSHES = {
  forest_exact: {
    label: 'Les',
    shape: 'blob',
    pool: [
      'tree_pine_a', 'tree_pine_b', 'tree_pine_c', 'tree_pine_d', 'tree_pine_e',
      'tree_seagrape', 'tree_almond',
    ],
    deco: true,
  },
  saplings: {
    label: 'Borovice',
    shape: 'blob',
    pool: ['tree_pine_a', 'tree_pine_b', 'tree_pine_c', 'tree_pine_d', 'tree_pine_e'],
    deco: true,
  },
  palms: {
    label: 'Palmy',
    shape: 'blob',
    pool: ['tree_palm_a', 'tree_palm_b'],
    deco: true,
  },
  broadleaf: {
    label: 'Listnáče',
    shape: 'blob',
    pool: ['tree_seagrape', 'tree_almond'],
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
    pool: [
      'rock_large', 'rock_large_c', 'rock_small', 'rock_small_flat', 'rock_tall',
      'rock_pair', 'rock_jagged', 'rock_pebbles',
    ],
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
  ...(SURFACE_BRUSH ? { surface: SURFACE_BRUSH } : {}),
  trail: {
    label: 'Cesta',
    shape: 'line',
    style: 'dirt',
    styles: ['dirt', 'stone', 'wood'],
  },
  hill: {
    label: 'Kopec',
    shape: 'blob',
    style: 'low',
    styles: ['low', 'mid', 'high'],
    heights: { low: 4, mid: 6, high: 8 },
    styleLabels: {
      low: levelMeters(4),
      mid: levelMeters(6),
      high: levelMeters(8),
    },
    falloff: true,
  },
  hollow: {
    label: 'Prohlubeň',
    shape: 'blob',
    style: 'shallow',
    styles: ['shallow', 'deep'],
    heights: { shallow: -2, deep: -4 },
    styleLabels: {
      shallow: levelMeters(2),
      deep: levelMeters(4),
    },
    falloff: true,
  },
  beach: {
    label: 'Pláž',
    shape: 'blob',
    style: 'shallow',
    styles: ['shallow', 'mid', 'deep'],
    heights: { shallow: -5, mid: -8, deep: -10 },
    styleLabels: {
      shallow: depthMeters(5),
      mid: depthMeters(8),
      deep: depthMeters(10),
    },
    falloff: true,
    surface: 'floor_sand',
    option: { key: 'smoothEdge', label: 'Plynulý okraj' },
  },
  shore: {
    label: 'Pobřeží',
    shape: 'blob',
    pool: ['shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup'],
    deco: true,
  },
  reef: {
    label: 'Koraly',
    shape: 'blob',
    pool: ['coral_fan', 'coral_branch', 'coral_brain'],
    deco: true,
    cluster: { min: 8, max: 14, spread: 0.85, scaleMin: 0.45, scaleMax: 0.75 },
  },
  fish: {
    label: 'Ryby',
    shape: 'blob',
    fish: true,
    style: 'fish_blue',
    styles: ['fish_blue', 'fish_gold', 'fish_green', 'fish_red', 'fish_micro'],
    styleLabels: {
      fish_blue: 'Stříbrné',
      fish_gold: 'Zlaté',
      fish_green: 'Zelené',
      fish_red: 'Červené',
      fish_micro: 'Drobné',
    },
  },
  cliff: {
    label: 'Útes',
    shape: 'blob',
    style: 'stone',
    styles: ['stone', 'dirt'],
    cliff: true,
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
