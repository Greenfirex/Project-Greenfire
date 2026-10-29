// Panel v levém dolním rohu — co hráč nese a co z toho jde vyrobit.
// Jen čte batoh a překresluje seznamy; do scény nijak nezasahuje.
import { ITEM_TYPES, RECIPES } from '../data/catalogs/items.js';

const ICONS = {
  wood: '🪵',
  stone: '🪨',
  shell: '🐚',
  stick: '🥢',
  iron_ore: '⛏',
  iron_ingot: '⬜',
  copper_ore: '🟠',
  copper_ingot: '🟧',
  stone_axe: '🪓',
  stone_pickaxe: '🎯',
  workbench: '🎪',
  campfire: '🔥',
};

export default class InventoryPanel {

  constructor() {
    this.root = null;
    this.itemsEl = null;
    this.recipeEl = null;
    this.lastSignature = '';
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-panel inventory-panel';
    root.id = 'hud-inventory';
    root.innerHTML = '<h2>Batoh</h2><div class="inv-list"></div><div class="inv-craft"><span class="inv-craft__label">Vyrobit lze</span><div class="inv-recipes"></div></div>';
    this.itemsEl = root.querySelector('.inv-list');
    this.recipeEl = root.querySelector('.inv-recipes');
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    return root;
  }

  update(inventory) {
    this.mount();
    const entries = inventory ? inventory.entries() : [];
    const craftable = inventory ? inventory.craftableKeys() : [];
    const signature = entries.map(([k, n]) => `${k}:${n}`).join(',') + '|' + craftable.join(',');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.itemsEl.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Zatím nic — buš do stromu nebo kamene.';
      this.itemsEl.appendChild(empty);
    }
    for (const [key, amount] of entries) {
      const row = document.createElement('div');
      row.className = 'inv-row';
      const icon = document.createElement('span');
      icon.className = 'inv-row__icon';
      icon.textContent = ICONS[key] || '•';
      const name = document.createElement('span');
      name.className = 'inv-row__name';
      name.textContent = ITEM_TYPES[key] ? ITEM_TYPES[key].displayName : key;
      const count = document.createElement('strong');
      count.textContent = String(amount);
      row.append(icon, name, count);
      this.itemsEl.appendChild(row);
    }

    this.recipeEl.innerHTML = '';
    if (craftable.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'inv-empty';
      hint.textContent = 'Na nic zatím nemáš dost surovin.';
      this.recipeEl.appendChild(hint);
      return;
    }
    for (const key of craftable) {
      const recipe = RECIPES[key];
      if (!recipe) continue;
      const chip = document.createElement('span');
      chip.className = 'inv-recipe';
      chip.textContent = `${ICONS[key] || '•'} ${recipe.displayName}`;
      this.recipeEl.appendChild(chip);
    }
  }
}
