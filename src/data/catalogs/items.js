// Deklarace typu předmětů (suroviny a produkty).
// Drží jen deklarace a resolve helpery, žádnou herní logiku.
import { ASSET_DIRS } from './assetPaths.js';

export const EQUIP_SLOTS = [
  { key: 'head', label: 'Hlava', icon: '⛑', image: `${ASSET_DIRS.equipIcons}head.png` },
  { key: 'chest', label: 'Tělo', icon: '🥋', image: `${ASSET_DIRS.equipIcons}chest.png` },
  { key: 'legs', label: 'Nohy', icon: '👖', image: `${ASSET_DIRS.equipIcons}legs.png` },
  { key: 'hands', label: 'Ruce', icon: '🧤', image: `${ASSET_DIRS.equipIcons}hands.png` },
  { key: 'feet', label: 'Boty', icon: '🥾', image: `${ASSET_DIRS.equipIcons}feet.png` },
  { key: 'weapon', label: 'Zbraň', icon: '⚔', image: `${ASSET_DIRS.equipIcons}weapon.png` },
];

export const ITEM_TAG_LABELS = {
  raw: 'Surovina',
  product: 'Produkt',
  tool: 'Nástroj',
  weapon: 'Zbraň',
  wear: 'Oblečení',
};

export const ITEM_TYPES = {
  wood: {
    displayName: 'Dřevo',
    description: 'Ze dřeva se dá postavit skoro všechno. Skoro.',
    icon: '🪵',
    image: `${ASSET_DIRS.itemIcons}wood.png`,
    stackSize: 100,
    weight: 1,
    kind: 'raw',
    color: [0.45, 0.32, 0.2],
  },
  stone: {
    displayName: 'Kámen',
    description: 'Tvrdý, těžký a ve správné ruce i užitečný.',
    icon: '🪨',
    image: `${ASSET_DIRS.itemIcons}stone.png`,
    stackSize: 100,
    weight: 1.5,
    kind: 'raw',
    color: [0.55, 0.55, 0.58],
  },
  shell: {
    displayName: 'Mušle',
    description: 'Na ucho šumí moře. V batohu zabírá místo.',
    icon: '🐚',
    image: `${ASSET_DIRS.itemIcons}shell.png`,
    stackSize: 20,
    weight: 0.1,
    kind: 'raw',
    color: [0.93, 0.86, 0.8],
  },
  mushroom: {
    displayName: 'Houba',
    description: 'Jíst se dá. Ale nejdřív si buď jistý, že je to ta správná.',
    icon: '🍄',
    image: `${ASSET_DIRS.itemIcons}mushroom.png`,
    stackSize: 100,
    weight: 0.1,
    kind: 'raw',
    color: [0.78, 0.55, 0.42],
  },
  coconut: {
    displayName: 'Kokos',
    description: 'Padá ze stromu jen tehdy, když se díváš jinam.',
    icon: '🥥',
    image: `${ASSET_DIRS.itemIcons}coconut.png`,
    stackSize: 20,
    weight: 0.8,
    kind: 'raw',
    color: [0.5, 0.33, 0.18],
  },
  herb: {
    displayName: 'Léčivá bylina',
    description: 'Neptej se, co je v ní. Prostě to vypij.',
    icon: '🌿',
    image: `${ASSET_DIRS.itemIcons}herb.png`,
    stackSize: 10,
    weight: 0.05,
    kind: 'raw',
    color: [0.72, 0.34, 0.28],
  },
  stick: {
    displayName: 'Klacek',
    description: 'Filozoficky nejstarší zbraň lidstva.',
    icon: '🥢',
    image: `${ASSET_DIRS.itemIcons}stick.png`,
    stackSize: 100,
    weight: 0.6,
    kind: 'product',
    color: [0.52, 0.38, 0.24],
  },
  torch: {
    displayName: 'Pochodeň',
    description: 'Svítí, hřeje a občas zapálí víc, než chceš.',
    icon: '🔥',
    image: `${ASSET_DIRS.itemIcons}torch.png`,
    stackSize: 5,
    weight: 0.7,
    kind: 'tool',
    color: [0.62, 0.36, 0.16],
  },
  meat: {
    displayName: 'Maso',
    description: 'Syrové. Oheň tomu dodá ten správný lesk.',
    icon: '🥩',
    image: `${ASSET_DIRS.itemIcons}meat.png`,
    stackSize: 20,
    weight: 0.5,
    kind: 'raw',
    color: [0.72, 0.25, 0.22],
  },
  turtle_shell: {
    displayName: 'Krunýř',
    description: 'Bývalý majitel už ho nepotřebuje.',
    icon: '🐢',
    image: `${ASSET_DIRS.itemIcons}turtle_shell.png`,
    stackSize: 20,
    weight: 1.2,
    kind: 'raw',
    color: [0.38, 0.42, 0.28],
  },
  pirate_hat: {
    displayName: 'Pirátský klobouk',
    description: 'Nezaručuje loď, posádku ani poklad.',
    icon: '🎩',
    image: `${ASSET_DIRS.itemIcons}pirate_hat.png`,
    stackSize: 1,
    weight: 0.3,
    kind: 'wear',
    slot: 'head',
    bonus: { defense: 1 },
    color: [0.3, 0.2, 0.12],
    wear: { model: `${ASSET_DIRS.props}pirate_hat/pirate_hat.glb`, width: 0.48, seat: 0.62, forward: 0.03, yaw: 0 },
  },
};

export const ITEM_KEYS = Object.keys(ITEM_TYPES);

export const RECIPES = {
  stone_axe: {
    displayName: 'Kamenná sekyrka',
    icon: '🪓',
    place: 'camp',
    cost: { wood: 2, stone: 3 },
  },
  stone_pickaxe: {
    displayName: 'Kamenný krumpáč',
    icon: '🎯',
    place: 'camp',
    cost: { wood: 2, stone: 3 },
  },
  workbench: {
    displayName: 'Výrobní stůl',
    icon: '🎪',
    place: 'camp',
    cost: { wood: 10, stone: 4 },
  },
  campfire: {
    displayName: 'Táborák',
    icon: '🔥',
    place: 'camp',
    cost: { wood: 4, stone: 6 },
  },
};

export const TOOL_TYPES = {
  torch: {
    item: 'torch',
    kind: 'tool',
    model: 'torch',
    file: `${ASSET_DIRS.props}torch/torch.glb`,
    grip: { scale: 0.6, upright: true, lean: 0.3, outward: 0.15, palm: 0.08, raise: -0.5, bend: -0.9, curl: 1.1, slide: -0.07, toThumb: 0.3 },
  },
  club: {
    item: 'stick',
    kind: 'weapon',
    model: 'stick',
    file: `${ASSET_DIRS.props}club/stick.glb`,
    grip: { scale: 1.6, fist: 1, curl: 1.1, tilt: -0.3, hold: 0.07, wrist: 1 },
    weapon: { damage: [10, 14], attack: 1, damageType: 'blunt', cooldown: 1.1, anim: 'chop' },
  },
};

export const HOTBAR_SLOTS = 5;
export const INVENTORY_SLOTS = 30;

export function getTool(toolKey) {
  const tool = TOOL_TYPES[toolKey];
  if (!tool) return null;
  const item = ITEM_TYPES[tool.item] || {};
  return { displayName: item.displayName, shortName: item.displayName, icon: item.icon, ...tool };
}

export function toolForItem(itemKey) {
  return Object.keys(TOOL_TYPES).find((key) => TOOL_TYPES[key].item === itemKey) || null;
}

export function itemWeapon(itemKey) {
  const toolKey = toolForItem(itemKey);
  const tool = toolKey ? TOOL_TYPES[toolKey] : null;
  return tool && tool.weapon ? tool.weapon : null;
}

export function itemWeight(itemKey) {
  const def = ITEM_TYPES[itemKey];
  return def && Number.isFinite(def.weight) && def.weight > 0 ? def.weight : 0;
}

export function gearBonus(itemKeys) {
  const total = {};
  for (const itemKey of itemKeys) {
    const def = ITEM_TYPES[itemKey];
    for (const [stat, value] of Object.entries((def && def.bonus) || {})) {
      if (Number.isFinite(value)) total[stat] = (total[stat] || 0) + value;
    }
  }
  return total;
}

export function itemTags(itemKey) {
  const def = ITEM_TYPES[itemKey];
  if (!def) return [];
  const keys = [];
  if (def.kind) keys.push(def.kind);
  const toolKey = toolForItem(itemKey);
  const tool = toolKey ? TOOL_TYPES[toolKey] : null;
  if (tool && tool.kind) keys.push(tool.kind);
  return [...new Set(keys)].map((key) => ({ key, label: ITEM_TAG_LABELS[key] || key }));
}
