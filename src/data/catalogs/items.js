// Deklarace typu předmětů (suroviny a produkty).
// Drží jen deklarace a resolve helpery, žádnou herní logiku.
import { ASSET_DIRS } from './assetPaths.js';

export const EQUIP_SLOTS = [
  { key: 'head', label: 'Hlava', icon: '⛑' },
  { key: 'chest', label: 'Tělo', icon: '🥋' },
  { key: 'legs', label: 'Nohy', icon: '👖' },
  { key: 'hands', label: 'Ruce', icon: '🧤' },
  { key: 'feet', label: 'Boty', icon: '🥾' },
  { key: 'weapon', label: 'Zbraň', icon: '⚔' },
];

export const ITEM_TYPES = {
  wood: {
    displayName: 'Dřevo',
    icon: '🪵',
    stackSize: 100,
    kind: 'raw',
    color: [0.45, 0.32, 0.2],
  },
  stone: {
    displayName: 'Kámen',
    icon: '🪨',
    stackSize: 100,
    kind: 'raw',
    color: [0.55, 0.55, 0.58],
  },
  shell: {
    displayName: 'Mušle',
    icon: '🐚',
    stackSize: 20,
    kind: 'raw',
    color: [0.93, 0.86, 0.8],
  },
  mushroom: {
    displayName: 'Houba',
    icon: '🍄',
    stackSize: 100,
    kind: 'raw',
    color: [0.78, 0.55, 0.42],
  },
  herb: {
    displayName: 'Léčivá bylina',
    stackSize: 10,
    kind: 'raw',
    color: [0.72, 0.34, 0.28],
  },
  stick: {
    displayName: 'Klacek',
    icon: '🥢',
    stackSize: 100,
    kind: 'product',
    color: [0.52, 0.38, 0.24],
  },
  meat: {
    displayName: 'Maso',
    icon: '🥩',
    stackSize: 20,
    kind: 'raw',
    color: [0.72, 0.25, 0.22],
  },
  turtle_shell: {
    displayName: 'Krunýř',
    icon: '🐢',
    stackSize: 20,
    kind: 'raw',
    color: [0.38, 0.42, 0.28],
  },
  pirate_hat: {
    displayName: 'Pirátský klobouk',
    icon: '🎩',
    stackSize: 1,
    kind: 'wear',
    slot: 'head',
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
  axe: {
    displayName: 'Sekyrka',
    shortName: 'Sekyrka',
    icon: '🪓',
    kind: 'tool',
    model: 'axe',
    harvest: { kinds: ['tree', 'log'], cooldown: 0.95 },
  },
  pickaxe: {
    displayName: 'Krumpáč',
    shortName: 'Krumpáč',
    icon: '⛏',
    kind: 'tool',
    model: 'pickaxe',
    harvest: { kinds: ['rock'], cooldown: 1.4 },
  },
  torch: {
    displayName: 'Pochodeň',
    shortName: 'Pochodeň',
    icon: '🔥',
    kind: 'tool',
    model: 'torch',
    file: `${ASSET_DIRS.props}torch/torch.glb`,
    grip: { scale: 0.6, upright: true, lean: 0.3, outward: 0.15, palm: 0.08, raise: -0.5, bend: -0.9, curl: 1.1, slide: -0.07, toThumb: 0.3 },
  },
};

export const HOTBAR_ITEMS = ['axe', 'pickaxe', 'torch'];
export const HOTBAR_SLOTS = 5;

export function getTool(toolKey) {
  return TOOL_TYPES[toolKey] || null;
}
