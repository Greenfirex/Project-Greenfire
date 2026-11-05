// Katalog brushů — deklarace „co se má na zóně vyplnit“.
// Povrchový štětec se skládá ze seznamu podkladů, takže nový povrch stačí přidat v katalogu dekorací.
import { surfaceEntries } from './decorations.js';
import { FLOWER_KEYS } from './flowers.js';
import { GRASS_MIXES } from './grass.js';
import { CREATURE_KEYS, CREATURE_TYPES } from './creatures/index.js';
import { HEIGHT_STEP } from '../maps/layoutStore.js';

const SURFACES = surfaceEntries();
const surfaceStyle = (entry) => entry.key.replace(/^floor_/, '');

const SIZE_OPTION = { key: 'radius', label: 'Velikost', kind: 'range', min: 0, max: 3, step: 1, display: 'square' };
const RANDOM_OPTION = { key: 'random', label: 'Náhodně střídat varianty', default: true };
const GRASS_MIX_VALUES = Object.entries(GRASS_MIXES).map(([value, mix]) => ({ value, label: mix.label }));
const GRASS_LAYER_VALUES = [
  { value: 'both', label: 'Obojí' },
  { value: 'plants', label: 'Jen trsy' },
  { value: 'cover', label: 'Jen koberec' },
];

export const PAINT_TERRAIN = 'terrain';
export const PAINT_DECORATIONS = 'decorations';
export const PAINT_CREATURES = 'creatures';
export const PAINT_FISH = 'fish';
export const PAINT_ALL = [PAINT_TERRAIN, PAINT_DECORATIONS];
const PAINT_DECO_ONLY = [PAINT_DECORATIONS];
const PAINT_CREATURE_ONLY = [PAINT_CREATURES];
const PAINT_FISH_ONLY = [PAINT_FISH];
const PAINT_NOTHING = [];

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
      group: 'Povrch',
      note: 'Přebarví povrch země (tráva, písek, hlína, štěrk), výšku nemění. Tažením označíš obdélník.',
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

const CREATURE_GROUP = 'Tvorové';

function creatureBrush(kind) {
  const type = CREATURE_TYPES[kind];
  const tierKeys = type && type.tiers ? Object.keys(type.tiers) : [];
  return {
    label: type.label,
    group: CREATURE_GROUP,
    note: 'Položí tvora na buňku. V panelu zvolíš, jak je starý; toulá se pak kolem místa, kam ho dáš.',
    shape: 'blob',
    creature: true,
    creatureKind: kind,
    style: type.defaultTier,
    styles: tierKeys,
    styleLabels: Object.fromEntries(tierKeys.map((key) => [key, type.tiers[key].label])),
  };
}

const CREATURE_BRUSHES = Object.fromEntries(CREATURE_KEYS.map((kind) => [`creature_${kind}`, creatureBrush(kind)]));

const ERASER_GROUP = 'Ostatní';

function eraserBrush(erase, group, label, note) {
  return {
    label,
    group,
    note,
    shape: 'blob',
    erase,
  };
}

const ERASER_BRUSHES = {
  erase_plants: eraserBrush('plants', 'Rostliny', 'Guma: rostliny', 'Smaže stromy, keře, houby, květiny i trávu.'),
  erase_objects: eraserBrush('objects', 'Objekty', 'Guma: objekty', 'Smaže kameny, dřevo, suť, mušle, korály a táborák.'),
  erase_path: eraserBrush('path', 'Povrch', 'Guma: cesta', 'Smaže jen vrstvu cesty.'),
  erase_terrain: eraserBrush('terrain', 'Terén', 'Guma: terén', 'Srovná zem na nulu, zruší označení útesu a smaže most.'),
  erase_creatures: eraserBrush('creatures', 'Tvorové', 'Guma: tvorové', 'Smaže tvora nebo hejno ryb z buňky.'),
  erase_all: eraserBrush('all', ERASER_GROUP, 'Guma: všechno', 'Smaže, co na buňce stojí — dekorace, trávu, cestu, tvora i rybu. Dlaždici nechá.'),
};

export const BRUSHES = {
  ...CREATURE_BRUSHES,
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
  deadwood: {
    label: 'Mrtvé dřevo',
    group: 'Objekty',
    note: 'Nasadí padlé kmeny a suché větve na lesní půdu.',
    shape: 'blob',
    pool: [
      'fallen_log_pine_a', 'fallen_log_pine_b', 'fallen_log_pine_c', 'fallen_log_pine_d',
      'fallen_log_palm_a', 'fallen_log_palm_b', 'fallen_log_palm_c',
      'dead_branch_a', 'dead_branch_b',
    ],
    options: [RANDOM_OPTION],
    deco: true,
  },
  driftwood: {
    label: 'Naplavené dřevo',
    group: 'Objekty',
    note: 'Nasadí vybledlé kmeny a větve na pláž a k vodě.',
    shape: 'blob',
    pool: ['driftwood_palm_a', 'driftwood_palm_b'],
    options: [RANDOM_OPTION],
    deco: true,
  },
  cliffDebris: {
    label: 'Suť z útesu',
    group: 'Objekty',
    note: 'Nasadí sesunuté skalní desky, hromady a rozsypané kamení. Náhodně střídá tvary i tmavé varianty.',
    shape: 'blob',
    pool: [
      'rockfall_slab', 'rockfall_pile', 'rockfall_spire', 'rockfall_scatter',
      'rockfall_mass_a', 'rockfall_mass_b', 'rockfall_dark_pile', 'rockfall_dark_slab',
      'rockfall_dark_mass', 'rockfall_dark_spire', 'rockfall_black_pile', 'rockfall_black_mass',
    ],
    options: [RANDOM_OPTION],
    deco: true,
  },
  mushrooms: {
    label: 'Houby',
    group: 'Rostliny',
    note: 'Nasadí houby na lesní půdu.',
    shape: 'blob',
    pool: ['mushroom_red', 'mushroom_tan'],
    deco: true,
  },
  bushes: {
    label: 'Keře',
    group: 'Rostliny',
    note: 'Nasadí keře; hustota říká, kolik jich na buňce vyroste, kolísání to nechá houpat o ±1. Skvrny = druh se střídá sám po plochách kolem sedmi buněk.',
    shape: 'blob',
    pool: ['bush', 'bush_round', 'bush_dense', 'bush_wide', 'bush_bramble', 'bush_small'],
    options: [
      { key: 'density', label: 'Hustota', kind: 'range', default: 2, min: 1, max: 5, step: 1 },
      { key: 'jitter', label: 'Kolísání ±1', default: true },
      { key: 'patch', label: 'Střídat druhy samo (skvrny)', default: true },
    ],
    patch: 7,
    cluster: { spread: 0.65, scaleMin: 0.7, scaleMax: 1.3 },
    deco: true,
  },
  grass: {
    label: 'Tráva',
    group: 'Rostliny',
    note: 'Zaseje porost; Směs určí, co na ploše vyroste, a Automaticky se řídí polohou (písek, stromy, skvrny).',
    shape: 'blob',
    flora: true,
    options: [
      { key: 'flowers', label: 'Květiny mezi stébly', default: true },
      { key: 'mix', label: 'Směs', kind: 'choice', default: 'auto', values: GRASS_MIX_VALUES },
      { key: 'layer', label: 'Vrstva', kind: 'choice', default: 'both', values: GRASS_LAYER_VALUES },
    ],
    scatterGate: 'flowers',
    scatter: { pool: FLOWER_KEYS, chance: 0.12, min: 1, max: 2, spread: 0.9, scaleMin: 0.7, scaleMax: 1 },
  },
  ...(SURFACE_BRUSH ? { surface: SURFACE_BRUSH } : {}),
  trail: {
    label: 'Cesta',
    group: 'Povrch',
    note: 'Nakreslí cestu, která kopíruje terén (hlína, kámen, dřevo).',
    shape: 'line',
    style: 'dirt',
    styles: ['dirt', 'stone', 'wood'],
  },
  join: {
    label: 'Spojnice',
    group: 'Terén',
    note: 'Klikni na vrchol a pak na spodek — země se mezi nimi plynule srovná po 0,3 m.',
    shape: 'line',
    join: true,
    options: [
      { key: 'width', label: 'Šířka', kind: 'range', default: 1, min: 1, max: 5, step: 2 },
    ],
  },
  bridge: {
    label: 'Most',
    group: 'Terén',
    note: 'Klikni na jeden břeh a pak na protější — přes propast vznikne skalní most, po kterém se dá chodit.',
    shape: 'line',
    bridge: true,
    style: 'stone',
    styles: ['stone', 'dirt'],
    options: [
      { key: 'width', label: 'Tloušťka', kind: 'range', default: 3, min: 1, max: 5, step: 2 },
    ],
  },
  hill: {
    label: 'Kopec',
    group: 'Terén',
    note: 'Vyzdvihne zem do kopce se svahem, výšku volíš v panelu.',
    shape: 'blob',
    style: 'low',
    styles: ['low', 'mid', 'high', 'higher', 'tall', 'max'],
    heights: { low: 4, mid: 6, high: 8, higher: 12, tall: 24, max: 40 },
    styleLabels: {
      low: levelMeters(4),
      mid: levelMeters(6),
      high: levelMeters(8),
      higher: levelMeters(12),
      tall: levelMeters(24),
      max: levelMeters(40),
    },
    options: [
      { key: 'steep', label: 'Strmý svah (užší)' },
      { key: 'rough', label: 'Nepravidelný svah' },
    ],
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
    options: [
      { key: 'steep', label: 'Strmý svah (užší)' },
      { key: 'rough', label: 'Nepravidelný svah' },
    ],
    falloff: true,
  },
  beach: {
    label: 'Pláž',
    group: 'Terén',
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
    label: 'Mušle',
    group: 'Objekty',
    note: 'Rozsype lastury po písku u vody.',
    shape: 'blob',
    pool: ['shore_shells', 'shore_shells_mid', 'shore_shells_wide', 'shore_shells_cup'],
    deco: true,
  },
  reef: {
    label: 'Koraly',
    group: 'Objekty',
    note: 'Položí na dno hrudu korálů; náhodně střídá variace.',
    shape: 'blob',
    pool: [
      'coral_clump_1', 'coral_clump_2', 'coral_clump_3', 'coral_clump_4', 'coral_clump_5',
      'coral_clump_6', 'coral_clump_7', 'coral_clump_8', 'coral_clump_9', 'coral_clump_10',
    ],
    options: [RANDOM_OPTION],
    deco: true,
  },
  fish: {
    label: 'Ryby',
    group: 'Tvorové',
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
    note: 'Označí buňky jako plošinu, kde je skok, vznikne svislá stěna. Volba Pata přebarví povrch buněk pod stěnou.',
    shape: 'blob',
    style: 'stone',
    styles: ['stone', 'dirt'],
    options: [
      {
        key: 'foot',
        label: 'Pata útesu',
        kind: 'choice',
        default: 'auto',
        values: [
          { value: 'auto', label: 'Podle buňky' },
          ...SURFACES.map((entry) => ({ value: entry.key, label: entry.label })),
        ],
      },
    ],
    cliff: true,
  },
  camp: {
    label: 'Táborák',
    group: 'Objekty',
    note: 'Postaví ohniště s ohněm, které jde zapálit.',
    shape: 'blob',
    pool: ['campfire'],
    deco: true,
  },
  spawn: {
    label: 'Start hráče',
    group: 'Ostatní',
    note: 'Určí buňku, na které hráč začíná. Klikni na jednu buňku a potvrď.',
    shape: 'blob',
    spawn: true,
  },
  ...ERASER_BRUSHES,
};

export const BRUSH_KEYS = Object.keys(BRUSHES);

export const BRUSH_GROUPS = ['Povrch', 'Terén', 'Rostliny', 'Objekty', 'Tvorové', 'Ostatní'];

export function brushesOf(group) {
  return BRUSH_KEYS.filter((key) => (BRUSHES[key].group || 'Ostatní') === group);
}

export function getBrush(brushKey) {
  return BRUSHES[brushKey] || null;
}

export function brushPaintParts(brushKey) {
  const brush = BRUSHES[brushKey];
  if (!brush) return PAINT_ALL;
  if (brush.spawn) return PAINT_NOTHING;
  if (brush.erase === 'terrain') return PAINT_ALL;
  if (brush.erase === 'creatures') return [PAINT_CREATURES, PAINT_FISH];
  if (brush.erase === 'all') return [PAINT_DECORATIONS, PAINT_CREATURES, PAINT_FISH];
  if (brush.erase) return PAINT_DECO_ONLY;
  if (brush.creature) return PAINT_CREATURE_ONLY;
  if (brush.fish) return PAINT_FISH_ONLY;
  if (brush.height || brush.heights || brush.cliff || brush.join || brush.bridge || brush.surface || brush.surfaceOnly) return PAINT_ALL;
  return PAINT_DECO_ONLY;
}

export function brushOptions(brush) {
  if (!brush) return [];
  const list = Array.isArray(brush.options) ? brush.options : (brush.option ? [brush.option] : []);
  if (brush.join || brush.bridge || brush.creature || brush.spawn) return list;
  const size = Number.isFinite(brush.radius) ? Math.max(0, Math.min(SIZE_OPTION.max, Math.round(brush.radius))) : 0;
  return [...list, { ...SIZE_OPTION, default: size }];
}