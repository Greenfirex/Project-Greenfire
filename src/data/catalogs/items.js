// Deklarace typu předmětů (suroviny a produkty).
// Drží jen deklarace a resolve helpery, žádnou herní logiku.
export const ITEM_TYPES = {
  wood: {
    displayName: 'Dřevo',
    stackSize: 100,
    kind: 'raw',
    color: [0.45, 0.32, 0.2],
  },
  stone: {
    displayName: 'Kámen',
    stackSize: 100,
    kind: 'raw',
    color: [0.55, 0.55, 0.58],
  },
  shell: {
    displayName: 'Mušle',
    stackSize: 20,
    kind: 'raw',
    color: [0.93, 0.86, 0.8],
  },
  stick: {
    displayName: 'Klacek',
    stackSize: 100,
    kind: 'product',
    color: [0.52, 0.38, 0.24],
  },
  iron_ore: {
    displayName: 'Železná ruda',
    stackSize: 100,
    kind: 'raw',
    color: [0.55, 0.5, 0.48],
  },
  iron_ingot: {
    displayName: 'Železný ingot',
    stackSize: 100,
    kind: 'product',
    color: [0.72, 0.72, 0.75],
  },
  copper_ore: {
    displayName: 'Měděná ruda',
    stackSize: 100,
    kind: 'raw',
    color: [0.78, 0.45, 0.25],
  },
  copper_ingot: {
    displayName: 'Měděný ingot',
    stackSize: 100,
    kind: 'product',
    color: [0.85, 0.55, 0.3],
  },
};

export const ITEM_KEYS = Object.keys(ITEM_TYPES);

export const RECIPES = {
  stone_axe: {
    displayName: 'Kamenná sekyrka',
    place: 'camp',
    cost: { wood: 2, stone: 3 },
  },
  stone_pickaxe: {
    displayName: 'Kamenný krumpáč',
    place: 'camp',
    cost: { wood: 2, stone: 3 },
  },
  workbench: {
    displayName: 'Výrobní stůl',
    place: 'camp',
    cost: { wood: 10, stone: 4 },
  },
  campfire: {
    displayName: 'Táborák',
    place: 'camp',
    cost: { wood: 4, stone: 6 },
  },
};

export const TOOL_TYPES = {
  plan: {
    displayName: 'Stavební plán',
    shortName: 'Plán',
    icon: '📐',
    kind: 'tool',
    model: 'blueprint',
    mode: 'build',
  },
  axe: {
    displayName: 'Sekyrka',
    shortName: 'Sekyrka',
    icon: '🪓',
    kind: 'tool',
    model: 'axe',
    mode: 'gather',
    harvest: { kinds: ['tree', 'log'], cooldown: 0.95 },
  },
  pickaxe: {
    displayName: 'Krumpáč',
    shortName: 'Krumpáč',
    icon: '⛏',
    kind: 'tool',
    model: 'pickaxe',
    mode: 'gather',
    harvest: { kinds: ['rock', 'ore'], cooldown: 1.4 },
  },
  torch: {
    displayName: 'Pochodeň',
    shortName: 'Pochodeň',
    icon: '🔥',
    kind: 'tool',
    model: 'torch',
    mode: 'light',
  },
};

export const HOTBAR_ITEMS = ['plan', 'axe', 'pickaxe', 'torch'];

export function getTool(toolKey) {
  return TOOL_TYPES[toolKey] || null;
}
