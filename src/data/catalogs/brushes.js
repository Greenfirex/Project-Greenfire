// Katalog brushů — deklarace „co se má na zóně vyplnit“.
// Povrchový štětec se skládá ze seznamu podkladů, takže nový povrch stačí přidat v katalogu dekorací.
import { surfaceEntries } from './decorations.js';
import { FLOWER_KEYS } from './flowers.js';
import { GRASS_MIXES } from './grass.js';
import { CREATURE_KEYS, CREATURE_TYPES } from './creatures/index.js';
import { HEIGHT_STEP, formatMeters } from '../maps/layoutStore.js';
import { FISH_KEYS, FISH_TYPES } from './fish.js';

const SURFACES = surfaceEntries();
const surfaceStyle = (entry) => entry.key.replace(/^floor_/, '');

const SIZE_OPTION = { key: 'radius', label: 'Velikost', kind: 'range', min: 0, max: 3, step: 1, display: 'square' };
const ROTATION_OPTION = { key: 'rotation', label: 'Natočení', kind: 'range', min: 0, max: 7, step: 1, display: 'angle' };
const RANDOM_OPTION = { key: 'random', label: 'Náhodně střídat varianty', default: true };
const LIGHT_ROCKS = [
  'rock_large', 'rock_large_c', 'rock_small', 'rock_small_flat', 'rock_tall',
  'rock_pair', 'rock_jagged', 'rock_pebbles',
];
const DARK_ROCKS = [
  'rock_dark_wide', 'rock_dark_wide_b', 'rock_dark_tall', 'rock_dark_tall_b',
  'rock_dark_slab', 'rock_dark_block', 'rock_dark_ledge', 'rock_dark_stack',
];
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
export const PAINT_CRABS = 'crabs';
export const PAINT_ALL = [PAINT_TERRAIN, PAINT_DECORATIONS];
const PAINT_DECO_ONLY = [PAINT_DECORATIONS];
const PAINT_CREATURE_ONLY = [PAINT_CREATURES];
const PAINT_FISH_ONLY = [PAINT_FISH];
const PAINT_CRABS_ONLY = [PAINT_CRABS];
const PAINT_NOTHING = [];

function levelMeters(level) {
  return formatMeters(Math.abs(level) * HEIGHT_STEP);
}

function depthMeters(level) {
  return `−${levelMeters(level)}`;
}

const SURFACE_BRUSH = SURFACES.length
  ? {
      label: 'Povrch',
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

function creatureBrush(kind) {
  const type = CREATURE_TYPES[kind];
  const tierKeys = type && type.tiers ? Object.keys(type.tiers) : [];
  return {
    label: type.label,
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

function eraserBrush(erase, label, note) {
  return {
    label,
    note,
    shape: 'blob',
    erase,
  };
}

const ERASER_BRUSHES = {
  erase_plants: eraserBrush('plants', 'Guma: rostliny', 'Smaže stromy, keře, houby, květiny i trávu.'),
  erase_objects: eraserBrush('objects', 'Guma: objekty', 'Smaže kameny, dřevo, suť, mušle, korály, táborák, truhly a kostlivce.'),
  erase_path: eraserBrush('path', 'Guma: cesta', 'Smaže jen vrstvu cesty.'),
  erase_terrain: eraserBrush('terrain', 'Guma: terén', 'Srovná zem na nulu, zruší označení útesu a smaže most.'),
  erase_creatures: eraserBrush('creatures', 'Guma: tvorové', 'Smaže tvora nebo hejno ryb z buňky.'),
  erase_all: eraserBrush('all', 'Guma: všechno', 'Smaže, co na buňce stojí — dekorace, trávu, cestu, tvora i rybu. Dlaždici nechá.'),
};

export const BRUSHES = {
  ...CREATURE_BRUSHES,
  forest_exact: {
    label: 'Les',
    note: 'Nasadí hustý les ze všech druhů stromů.',
    shape: 'blob',
    pool: [
      'tree_araucaria_a', 'tree_araucaria_b', 'tree_araucaria_young_a', 'tree_araucaria_young_b',
      'tree_seagrape', 'tree_almond',
    ],
    deco: true,
  },
  araucarias: {
    label: 'Araukárie',
    note: 'Nasadí araukárie, velké i mladé. Náhoda střídá tvary a k tomu i natočení, posun na buňce a velikost.',
    shape: 'blob',
    pool: ['tree_araucaria_a', 'tree_araucaria_b', 'tree_araucaria_young_a', 'tree_araucaria_young_b'],
    options: [RANDOM_OPTION],
    rotate: true,
    jumble: true,
    deco: true,
  },
  pandans: {
    label: 'Pandány',
    note: 'Nasadí pandány, hodí se na přechod mezi pláží a vnitrozemím. Náhoda střídá oba tvary a k tomu i natočení, posun na buňce a velikost.',
    shape: 'blob',
    pool: ['tree_pandan_a', 'tree_pandan_b'],
    options: [RANDOM_OPTION],
    rotate: true,
    jumble: true,
    deco: true,
  },
  palms: {
    label: 'Palmy',
    note: 'Nasadí palmy, vhodné k písku a vodě. Tlačítky vybereš rovnou nebo prohnutou, náhoda střídá všechny. S volbou Kokosy kolem leží u zhruba třetiny palem na sousedních buňkách kokosy, které jde sebrat.',
    shape: 'blob',
    style: 'palm_a',
    styles: ['palm_a', 'palm_b', 'palm_c', 'palm_curved_a', 'palm_curved_b', 'palm_curved_c'],
    styleLabels: {
      palm_a: 'Kokosová',
      palm_b: 'Vysoká',
      palm_c: 'Nízká',
      palm_curved_a: 'Prohnutá',
      palm_curved_b: 'Vysoká prohnutá',
      palm_curved_c: 'Nízká prohnutá',
    },
    poolByStyle: {
      palm_a: ['tree_palm_a'],
      palm_b: ['tree_palm_b'],
      palm_c: ['tree_palm_c'],
      palm_curved_a: ['tree_palm_curved_a'],
      palm_curved_b: ['tree_palm_curved_b'],
      palm_curved_c: ['tree_palm_curved_c'],
    },
    options: [RANDOM_OPTION, { key: 'coconuts', label: 'Kokosy kolem', default: true }, { key: 'leaves', label: 'Listy kolem', default: true }],
    rotate: true,
    deco: true,
  },
  bananas: {
    label: 'Banánovníky',
    note: 'Nasadí banánovníky, jdou pokácet sekerou. Náhoda střídá oba tvary a k tomu i natočení, posun na buňce a velikost.',
    shape: 'blob',
    pool: ['tree_banana_a', 'tree_banana_b'],
    options: [RANDOM_OPTION],
    rotate: true,
    jumble: true,
    deco: true,
  },
  broadleaf: {
    label: 'Listnáče',
    note: 'Nasadí listnaté stromy (mořské hrozno, mandlovník).',
    shape: 'blob',
    pool: ['tree_seagrape', 'tree_almond'],
    deco: true,
  },
  herbs: {
    label: 'Květiny',
    note: 'Nasadí léčivé byliny, které jde utrhnout rukou. Předmět pak leží v batohu.',
    shape: 'blob',
    style: 'plant_healing',
    styles: ['plant_healing'],
    styleLabels: { plant_healing: 'Léčivá bylina' },
    poolByStyle: { plant_healing: ['plant_healing'] },
    deco: true,
  },
  rocks: {
    label: 'Kameny',
    note: 'Nasadí velké i malé kameny a balvany. Tlačítky vybereš světlé, tmavé nebo všechny, náhoda střídá tvary ve vybrané skupině.',
    shape: 'blob',
    style: 'all',
    styles: ['all', 'light', 'dark'],
    styleLabels: { all: 'Všechny', light: 'Světlé', dark: 'Tmavé' },
    poolByStyle: {
      all: [...LIGHT_ROCKS, ...DARK_ROCKS],
      light: LIGHT_ROCKS,
      dark: DARK_ROCKS,
    },
    randomInStyle: true,
    options: [RANDOM_OPTION],
    deco: true,
  },
  deadwood: {
    label: 'Mrtvé dřevo',
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
    note: 'Nasadí vybledlé kmeny a větve na pláž a k vodě.',
    shape: 'blob',
    pool: ['driftwood_palm_a', 'driftwood_palm_b'],
    options: [RANDOM_OPTION],
    deco: true,
  },
  clubs: {
    label: 'Klacky',
    note: 'Rozhodí klacky, které jde sebrat a vzít do ruky jako zbraň. Náhoda střídá osm tvarů, světlé i tmavé.',
    shape: 'blob',
    pool: ['club_a', 'club_b', 'club_c', 'club_d', 'club_e', 'club_f', 'club_g', 'club_h'],
    options: [RANDOM_OPTION],
    deco: true,
  },
  planks: {
    label: 'Prkna',
    note: 'Rozhodí prkna, která odpadla z rozpadlých staveb; jdou sebrat rukou jako dřevo. Náhoda střídá čtyři tvary.',
    shape: 'blob',
    pool: ['loose_plank_a', 'loose_plank_b', 'loose_plank_c', 'loose_plank_d'],
    options: [RANDOM_OPTION],
    deco: true,
  },
  palmLeaves: {
    label: 'Palmové listy',
    note: 'Rozhodí spadlé palmové listy, které jde sebrat rukou. Náhoda střídá zelený a suchý list.',
    shape: 'blob',
    pool: ['palm_frond_green', 'palm_frond_dry'],
    options: [RANDOM_OPTION],
    deco: true,
  },
  cliffDebris: {
    label: 'Suť z útesu',
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
    note: 'Nasadí houby na lesní půdu.',
    shape: 'blob',
    pool: ['mushroom_red', 'mushroom_tan'],
    deco: true,
  },
  bushes: {
    label: 'Keře',
    note: 'Nasadí keře; hustota říká, kolik jich na buňce vyroste, kolísání to nechá houpat o ±1. Skvrny = druh se střídá sám po plochách kolem sedmi buněk.',
    shape: 'blob',
    pool: ['bush', 'bush_round', 'bush_bramble', 'bush_small'],
    options: [
      { key: 'density', label: 'Hustota', kind: 'range', default: 2, min: 1, max: 5, step: 1 },
      { key: 'jitter', label: 'Kolísání ±1', default: true },
      { key: 'patch', label: 'Střídat druhy samo (skvrny)', default: true },
    ],
    patch: 7,
    cluster: { spread: 0.65, scaleMin: 0.7, scaleMax: 1.3 },
    deco: true,
  },
  moss: {
    label: 'Mech',
    note: 'Rozhází mechové polštáře: zhruba na dvě třetiny buněk jeden až tři shluky, různě velké a různě natočené. Náhoda střídá malý, střední a rozlezlý shluk.',
    shape: 'blob',
    pool: ['moss_small', 'moss_mid', 'moss_wide'],
    options: [RANDOM_OPTION],
    fill: 0.65,
    cluster: { min: 1, max: 3, spread: 0.85, scaleMin: 0.7, scaleMax: 1.4 },
    deco: true,
  },
  monsteras: {
    label: 'Monstery',
    note: 'Rozhází monstery po ploše: zhruba na polovinu buněk, na buňku jednu nebo dvě, každou jinak natočenou a jinak velkou.',
    shape: 'blob',
    pool: ['bush_monstera', 'bush_monstera_small', 'bush_monstera_large'],
    options: [RANDOM_OPTION],
    fill: 0.5,
    cluster: { min: 1, max: 2, spread: 0.8, scaleMin: 0.75, scaleMax: 1.3 },
    deco: true,
  },
  grass: {
    label: 'Tráva',
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
    note: 'Nakreslí cestu, která kopíruje terén (hlína, kámen, dřevo).',
    shape: 'line',
    style: 'dirt',
    styles: ['dirt', 'stone', 'wood'],
  },
  join: {
    label: 'Spojnice',
    note: 'Klikni na vrchol a pak na spodek — země se mezi nimi plynule srovná po krocích výšky.',
    shape: 'line',
    join: true,
    options: [
      { key: 'width', label: 'Šířka', kind: 'range', default: 1, min: 1, max: 5, step: 2 },
    ],
  },
  bridge: {
    label: 'Most',
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
  lake: {
    label: 'Jezero',
    note: 'Klikni do prohlubně — voda ji naplní až po okraj. Klik na jezero hladinu zvedne, pravé tlačítko ji sníží, v režimu Mazat jezero zmizí.',
    shape: 'blob',
    lake: true,
  },
  river: {
    label: 'Řeka',
    note: 'Táhni od pramene k ústí a potvrď Aplikovat — řeka si vyhloubí koryto a poteče ve směru tahu, nikdy do kopce. Tah přes existující řeku ji v tom úseku nahradí. Pravé tlačítko nebo režim Mazat řeku smaže i s korytem.',
    shape: 'blob',
    river: true,
    options: [
      { key: 'width', label: 'Šířka', kind: 'range', default: 1, min: 1, max: 3, step: 2 },
      {
        key: 'depth',
        label: 'Hloubka',
        kind: 'choice',
        default: 'shallow',
        values: [
          { value: 'shallow', label: 'Mělká (přebrodí se)' },
          { value: 'deep', label: 'Hluboká (nepřejde se)' },
        ],
      },
      { key: 'shallowMin', label: 'Hloubka od', kind: 'range', default: 0.5, min: 0.25, max: 0.5, step: 0.25, display: 'meters', showWhen: { key: 'depth', value: 'shallow' } },
      { key: 'shallowMax', label: 'Hloubka do', kind: 'range', default: 0.5, min: 0.25, max: 0.5, step: 0.25, display: 'meters', showWhen: { key: 'depth', value: 'shallow' } },
      { key: 'deepMin', label: 'Hloubka od', kind: 'range', default: 1.25, min: 0.75, max: 2.5, step: 0.25, display: 'meters', showWhen: { key: 'depth', value: 'deep' } },
      { key: 'deepMax', label: 'Hloubka do', kind: 'range', default: 1.25, min: 0.75, max: 2.5, step: 0.25, display: 'meters', showWhen: { key: 'depth', value: 'deep' } },
    ],
  },
  beach: {
    label: 'Pláž',
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
    note: 'Rozsype lastury po písku u vody.',
    shape: 'blob',
    pool: ['shore_shells', 'shore_shells_mid'],
    deco: true,
  },
  starfish: {
    label: 'Hvězdice',
    note: 'Položí hvězdici na dno v hloubce 0,5–4 m. Na suchu se nepoloží.',
    shape: 'blob',
    pool: ['starfish'],
    waterOnly: true,
    minWaterDepth: 0.5,
    maxWaterDepth: 4,
    deco: true,
  },
  koa_nest: {
    label: "Hnízdo Koa'tiki",
    note: "Postaví hnízdo s vejci. Koa'tiki v okolí ho hlídají a za krádež vejce zaútočí.",
    shape: 'blob',
    pool: ['koa_nest'],
    deco: true,
  },
  reef: {
    label: 'Koraly',
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
    note: 'Vypustí hejno rybek zvolené barvy; na suché buňce se neuloží.',
    shape: 'blob',
    fish: true,
    style: FISH_KEYS[0],
    styles: FISH_KEYS,
    styleLabels: Object.fromEntries(FISH_KEYS.map((key) => [key, FISH_TYPES[key].label])),
  },
  crabs: {
    label: 'Krabi',
    note: 'Vypustí pár krabů navíc. Krabi se sami objevují i na písku u moře; ve vodě se neuloží.',
    shape: 'blob',
    crabs: true,
  },
  cliff: {
    label: 'Útes',
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
    note: 'Postaví ohniště s ohněm, které jde zapálit.',
    shape: 'blob',
    pool: ['campfire'],
    deco: true,
  },
  chest: {
    label: 'Truhla',
    note: 'Postaví truhlu zády ke kraji buňky; jde jednou otevřít a vybrat. Natočením určíš, ke kterému kraji.',
    shape: 'blob',
    pool: ['loot_chest'],
    rotate: true,
    deco: true,
  },
  skeleton: {
    label: 'Kostlivec',
    note: 'Posadí kostlivce zády ke kraji buňky; jde jednou prohledat. Natočením určíš, ke kterému kraji.',
    shape: 'blob',
    pool: ['loot_skeleton'],
    rotate: true,
    deco: true,
  },
  spawn: {
    label: 'Start hráče',
    note: 'Určí buňku, na které hráč začíná. Klikni na jednu buňku a potvrď.',
    shape: 'blob',
    spawn: true,
  },
  ...ERASER_BRUSHES,
};

export const BRUSH_KEYS = Object.keys(BRUSHES);

export function brushShapesTerrain(brushKey) {
  const brush = BRUSHES[brushKey];
  if (!brush) return false;
  return Boolean(brush.height || brush.heights || brush.cliff || brush.join || brush.bridge || brush.lake || brush.river || brush.erase === 'terrain');
}

export function getBrush(brushKey) {
  return BRUSHES[brushKey] || null;
}

export function brushAboveGroundOnly(brushKey) {
  const brush = BRUSHES[brushKey];
  if (!brush || brush.erase) return false;
  return Boolean(brush.height || brush.heights || brush.surface || brush.cliff || brush.join || brush.bridge
    || brush.fish || brush.crabs || brush.spawn || brush.lake || brush.river || brush.flora || brush.waterOnly || brush.shape === 'line');
}

export function brushPaintParts(brushKey) {
  const brush = BRUSHES[brushKey];
  if (!brush) return PAINT_ALL;
  if (brush.spawn || brush.lake || brush.river) return PAINT_NOTHING;
  if (brush.erase === 'terrain') return PAINT_ALL;
  if (brush.erase === 'creatures') return [PAINT_CREATURES, PAINT_FISH, PAINT_CRABS];
  if (brush.erase === 'all') return [PAINT_DECORATIONS, PAINT_CREATURES, PAINT_FISH, PAINT_CRABS];
  if (brush.erase) return PAINT_DECO_ONLY;
  if (brush.creature) return PAINT_CREATURE_ONLY;
  if (brush.fish) return PAINT_FISH_ONLY;
  if (brush.crabs) return PAINT_CRABS_ONLY;
  if (brush.height || brush.heights || brush.cliff || brush.join || brush.bridge || brush.surface || brush.surfaceOnly) return PAINT_ALL;
  return PAINT_DECO_ONLY;
}

export function brushOptions(brush) {
  if (!brush) return [];
  const list = [...(Array.isArray(brush.options) ? brush.options : (brush.option ? [brush.option] : []))];
  if (brush.join || brush.bridge || brush.creature || brush.spawn || brush.lake || brush.river) return list;
  if (brush.rotate) list.push(ROTATION_OPTION);
  const size = Number.isFinite(brush.radius) ? Math.max(0, Math.min(SIZE_OPTION.max, Math.round(brush.radius))) : 0;
  return [...list, { ...SIZE_OPTION, default: size }];
}