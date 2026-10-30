// Ikony předmětů na jednom místě — používají je batoh i log.
export const ITEM_ICONS = {
  wood: '🪵',
  stone: '🪨',
  shell: '🐚',
  stick: '🥢',
  iron_ore: '⛏',
  iron_ingot: '⬜',
  copper_ore: '🟠',
  copper_ingot: '🟧',
  mushroom: '🍄',
  stone_axe: '🪓',
  stone_pickaxe: '🎯',
  workbench: '🎪',
  campfire: '🔥',
};

export function itemIcon(key) {
  return ITEM_ICONS[key] || '•';
}
