// Ikony předmětů na jednom místě — používají je inventář i log.
export const ITEM_ICONS = {
  wood: '🪵',
  stone: '🪨',
  shell: '🐚',
  stick: '🥢',
  meat: '🥩',
  turtle_shell: '🐢',
  mushroom: '🍄',
  stone_axe: '🪓',
  stone_pickaxe: '🎯',
  workbench: '🎪',
  campfire: '🔥',
};

export function itemIcon(key) {
  return ITEM_ICONS[key] || '•';
}
