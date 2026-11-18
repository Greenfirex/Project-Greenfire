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
  palm_leaf: {
    displayName: 'Palmový list',
    description: 'Velký, lehký a zatím k ničemu. To se brzy změní.',
    icon: '🌿',
    image: `${ASSET_DIRS.itemIcons}palm_leaf.png`,
    stackSize: 20,
    weight: 0.3,
    kind: 'raw',
    color: [0.56, 0.6, 0.3],
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
    slot: 'weapon',
    color: [0.52, 0.38, 0.24],
  },
  rusty_saber: {
    displayName: 'Rezavá pirátská šavle',
    description: 'Ostří už pamatuje lepší časy. Rez ale řeže taky.',
    icon: '🗡',
    image: `${ASSET_DIRS.itemIcons}rusty_saber.png`,
    stackSize: 1,
    weight: 1.4,
    kind: 'product',
    slot: 'weapon',
    color: [0.6, 0.45, 0.3],
  },
  spear: {
    displayName: 'Kopí',
    description: 'Klacek, který se rozhodl být nebezpečnější. Mušle mu v tom pomohla.',
    icon: '🔱',
    image: `${ASSET_DIRS.itemIcons}spear.png`,
    stackSize: 1,
    weight: 1.1,
    kind: 'product',
    slot: 'weapon',
    color: [0.58, 0.4, 0.26],
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
  koa_egg: {
    displayName: "Vejce Koa'tiki",
    description: 'Těžké, kropenaté a pořád teplé. Matka o něm ví.',
    icon: '🥚',
    image: `${ASSET_DIRS.itemIcons}koa_egg.png`,
    stackSize: 10,
    weight: 0.4,
    kind: 'raw',
    color: [0.9, 0.88, 0.72],
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
  pirate_coat: {
    displayName: 'Pirátský kabát',
    description: 'Kapitán ho už nepotřebuje. Díry jsou v ceně.',
    icon: '🧥',
    image: `${ASSET_DIRS.itemIcons}pirate_coat.png`,
    stackSize: 1,
    weight: 1.5,
    kind: 'wear',
    slot: 'chest',
    bonus: { defense: 2 },
    color: [0.35, 0.12, 0.14],
    wear: { fitted: `${ASSET_DIRS.characters}castaway/outfit/pirate_coat.glb`, hipGap: 0.1, hipTilt: 0.05 },
  },
  pirate_pants: {
    displayName: 'Pirátské kalhoty',
    description: 'Pruhy prý odhánějí žraloky. Nikdo to neověřil.',
    icon: '👖',
    image: `${ASSET_DIRS.itemIcons}pirate_pants.png`,
    stackSize: 1,
    weight: 0.6,
    kind: 'wear',
    slot: 'legs',
    bonus: { defense: 1 },
    color: [0.75, 0.7, 0.6],
    wear: { fitted: `${ASSET_DIRS.characters}castaway/outfit/pirate_pants.glb` },
  },
  pirate_boots: {
    displayName: 'Pirátské boty',
    description: 'Ošoupané, ale pořád lepší než ostré mušle pod bosou nohou.',
    icon: '🥾',
    image: `${ASSET_DIRS.itemIcons}pirate_boots.png`,
    stackSize: 1,
    weight: 1,
    kind: 'wear',
    slot: 'feet',
    bonus: { defense: 1 },
    color: [0.3, 0.2, 0.14],
    wear: { fitted: `${ASSET_DIRS.characters}castaway/outfit/pirate_boots.glb` },
  },
};

export const ITEM_KEYS = Object.keys(ITEM_TYPES);

export const RECIPES = {
  spear: { cost: { stick: 1, shell: 2 } },
};

export const RECIPE_KEYS = Object.keys(RECIPES).filter((key) => ITEM_TYPES[key]);

export const TOOL_TYPES = {
  torch: {
    item: 'torch',
    kind: 'tool',
    model: 'torch',
    file: `${ASSET_DIRS.props}torch/torch.glb`,
    grip: { scale: 0.6, upright: true, lean: 0.3, outward: 0.15, palm: 0.08, raise: -0.5, bend: -0.9, curl: 1.1, slide: -0.07, toThumb: 0.3 },
    offHand: { hand: [0.12, -0.2, 0.32], elbow: [0.16, -0.27, 0.02] },
    stow: { side: 0.95, lift: 0.5, ahead: 0.1 },
  },
  club: {
    item: 'stick',
    kind: 'weapon',
    model: 'stick',
    file: `${ASSET_DIRS.props}club/stick.glb`,
    grip: { scale: 1.6, fist: 1, curl: 1.1, tilt: -0.3, hold: 0.07, wrist: 1, toThumb: 0.4 },
    sheath: { side: -0.95, lift: 0.5, ahead: 0.1, back: 0.15, out: -0.06 },
    guard: { hand: [0.2, -0.36, 0.38], elbow: [0.2, -0.27, -0.02], club: [0.15, 0.75, 0.8], leftHand: [-0.02, -0.32, 0.28], leftElbow: [0.12, -0.28, 0.02] },
    weapon: {
      damage: [3, 5], attack: 1, damageType: 'blunt', hitSound: 'hitClub',
      primary: { reach: 1.7, arc: 70, cooldown: 1.0, anim: ['slash', 'double1', 'triple3'] },
      secondary: { reach: 1.9, arc: 40, cooldown: 1.6, cost: 22, anim: 'smash' },
    },
  },
  saber: {
    item: 'rusty_saber',
    kind: 'weapon',
    model: 'saber',
    file: `${ASSET_DIRS.props}saber/saber.glb`,
    grip: { scale: 0.72, fist: 1, curl: 1.1, tilt: -0.3, hold: 0.15, wrist: 1, toThumb: 0.4, edge: [-1, 0, 0] },
    sheath: { side: -0.95, lift: 0.5, ahead: 0.1, back: 0.15, out: -0.06, edge: -1 },
    guard: { hand: [0.2, -0.36, 0.38], elbow: [0.2, -0.27, -0.02], club: [0.15, 0.75, 0.8], leftHand: [-0.02, -0.32, 0.28], leftElbow: [0.12, -0.28, 0.02] },
    weapon: {
      damage: [4, 6], attack: 1, damageType: 'slashing', hitSound: 'hitClub',
      primary: { reach: 1.8, arc: 80, cooldown: 0.85, anim: ['slash', 'double1', 'triple3'] },
      secondary: { reach: 1.9, arc: 50, cooldown: 1.5, cost: 22, anim: 'smash' },
    },
  },
  spear: {
    item: 'spear',
    kind: 'weapon',
    model: 'spear',
    file: `${ASSET_DIRS.props}spear/spear.glb`,
    grip: { scale: 1.3, fist: 1, curl: 1.1, tilt: -0.3, hold: 0.3, wrist: 1, toThumb: 0.4 },
    sheath: { side: -0.95, lift: 0.5, ahead: -0.3, back: 1.2, out: -0.06 },
    guard: { hand: [0.2, -0.36, 0.38], elbow: [0.2, -0.27, -0.02], club: [0.15, 0.75, 0.8], leftHand: [-0.02, -0.32, 0.28], leftElbow: [0.12, -0.28, 0.02] },
    weapon: {
      damage: [4, 7], attack: 1, damageType: 'piercing', hitSound: 'hitClub',
      primary: { reach: 2.4, arc: 30, cooldown: 1.1, anim: 'thrust' },
      secondary: { reach: 2.2, arc: 360, cooldown: 2.0, cost: 30, anim: 'spin' },
    },
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

export function hotbarTool(toolKey) {
  const tool = TOOL_TYPES[toolKey];
  return Boolean(tool) && tool.kind !== 'weapon';
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
