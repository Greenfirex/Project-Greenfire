// Katalog brushů — deklarace „co se má na zóně vyplnit“.
// Povrchový štětec se skládá ze seznamu podkladů, takže nový povrch stačí přidat v katalogu dekorací.
import { surfaceEntries } from './decorations.js';
import { FLOWER_KEYS } from './flowers.js';
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
      group: 'Povrchy',
      note: 'Přebarví povrch země na trávu nebo písek, výšku nemění. Maluje se tažením.',
      shape: 'blob',
      surfaceOnly: true,
      radius: 1,
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
    group: 'Rostliny',
    note: 'Nasadí hustý les ze všech druhů stromů.',
    shape: 'blob',
    pool: [
      'tree_pine_a', 'tree_pine_b', 'tree_pine_c', 'tree_pine_d', 'tree_pine_e',
      'tree_seagrape', 'tree_almond',
    ],
    deco: true,
  },
  saplings: {
    label: 'Borovice',
    group: 'Rostliny',
    note: 'Nasadí jen borovice, bez ostatních stromů.',
    shape: 'blob',
    pool: ['tree_pine_a', 'tree_pine_b', 'tree_pine_c', 'tree_pine_d', 'tree_pine_e'],
    deco: true,
  },
  palms: {
    label: 'Palmy',
    group: 'Rostliny',
    note: 'Nasadí palmy, vhodné k písku a vodě.',
    shape: 'blob',
    pool: ['tree_palm_a', 'tree_palm_b'],
    deco: true,
  },
  broadleaf: {
    label: 'Listnáče',
    group: 'Rostliny',
    note: 'Nasadí listnaté stromy (mořské hrozno, mandlovník).',
    shape: 'blob',
    pool: ['tree_seagrape', 'tree_almond'],
    deco: true,
  },
  rocks: {
    label: 'Kameny',
    group: 'Objekty',
    note: 'Nasadí velké i malé kameny a balvany.',
    shape: 'blob',
    pool: [
      'rock_large', 'rock_large_c', 'rock_small', 'rock_small_flat', 'rock_tall',
      'rock_pair', 'rock_jagged', 'rock_pebbles',
    ],
    deco: true,
  },
  stumps: {
    label: 'Pařezy a dřevo',
    group: 'Objekty',
    note: 'Nasadí pařezy, kmeny a skládky dřeva.',
    shape: 'blob',
    pool: ['stump', 'stump_old', 'log', 'log_stack'],
    deco: true,
  },
  mushrooms: {
    label: 'Houby',
    group: 'Rostliny',
    note: 'Nasadí houby a drobné keře.',
    shape: 'blob',
    pool: ['mushroom_red', 'mushroom_tan', 'bush_small'],
    deco: true,
  },
  grass: {
    label: 'Tráva',
    group: 'Rostliny',
    note: 'Zaseje stébla trávy; volitelně mezi ně přisype květiny.',
    shape: 'blob',
    flora: true,
    option: { key: 'flowers', label: 'Květiny mezi stébly', default: true },
    scatter: { pool: FLOWER_KEYS, chance: 0.12, min: 1, max: 2, spread: 0.9, scaleMin: 0.7, scaleMax: 1 },
  },
  ...(SURFACE_BRUSH ? { surface: SURFACE_BRUSH } : {}),
  trail: {
    label: 'Cesta',
    group: 'Terén',
    note: 'Nakreslí cestu, která kopíruje terén (hlína, kámen, dřevo).',
    shape: 'line',
    style: 'dirt',
    styles: ['dirt', 'stone', 'wood'],
  },
  hill: {
    label: 'Kopec',
    group: 'Terén',
    note: 'Vyzdvihne zem do kopce se svahem, výšku volíš v panelu.',
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
    group: 'Terén',
    note: 'Sníží zem do prohlubně se svahem.',
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
    group: 'Voda',
    note: 'Vykope břeh do zvolené hloubky a nasype písek.',
    shape: 'blob',
    style: 'shallow',
    styles: ['shallow', 'mid', 'deep', 'deeper', 'abyss'],
    heights: { shallow: -5, mid: -8, deep: -10, deeper: -13, abyss: -17 },
    styleLabels: {
      shallow: depthMeters(5),
      mid: depthMeters(8),
      deep: depthMeters(10),
      deeper: depthMeters(13),
      abyss: depthMeters(17),
    },
    falloff: true,
    surface: 'floor_sand',
    option: { key: 'smoothEdge', label: 'Plynulý okraj' },
  },
  shore: {
    label: 'Pobřeží',
    group: 'Voda',
    note: 'Rozsype lastury po písku u vody.',
    shape: 'blob',
    pool: ['shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup'],
    deco: true,
  },
  reef: {
    label: 'Koraly',
    group: 'Voda',
    note: 'Nasype shluky koralů na dno, jen pod vodou.',
    shape: 'blob',
    pool: ['coral_fan', 'coral_branch', 'coral_brain'],
    deco: true,
    cluster: { min: 8, max: 14, spread: 0.85, scaleMin: 0.45, scaleMax: 0.75 },
  },
  fish: {
    label: 'Ryby',
    group: 'Voda',
    note: 'Vypustí hejno rybek zvolené barvy; na suché buňce se neuloží.',
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
    group: 'Terén',
    note: 'Označí buňky jako plošinu, kde je skok, vznikne svislá stěna.',
    shape: 'blob',
    style: 'stone',
    styles: ['stone', 'dirt'],
    cliff: true,
  },
  ore: {
    label: 'Ruda',
    group: 'Objekty',
    note: 'Nasadí ložisko rudy — železo nebo měď.',
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
    group: 'Objekty',
    note: 'Postaví tábor: stan, táborák, bedny a sudy.',
    shape: 'blob',
    pool: ['tent', 'campfire', 'crate', 'barrel'],
    deco: true,
  },
};

export const BRUSH_KEYS = Object.keys(BRUSHES);

export const BRUSH_GROUPS = ['Povrchy', 'Terén', 'Voda', 'Rostliny', 'Objekty', 'Ostatní'];

export function brushesOf(group) {
  return BRUSH_KEYS.filter((key) => (BRUSHES[key].group || 'Ostatní') === group);
}

export function getBrush(brushKey) {
  return BRUSHES[brushKey] || null;
}
