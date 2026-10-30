// Okno s batohem — co hráč nese a co z toho jde vyrobit.
// Otevírá se tlačítkem u lišty s předměty; obsah jen čte, do hry nezasahuje.
import { ITEM_TYPES, RECIPES } from '../data/catalogs/items.js';
import { itemIcon } from './itemIcons.js';

export default class InventoryWindow {

  constructor() {
    this.root = null;
    this.itemsEl = null;
    this.recipeEl = null;
    this.lastSignature = '';
    this.open = false;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'side-window inv-window';
    root.id = 'hud-inventory';
    root.innerHTML = `
      <div class="side-window__head">
        <span class="side-window__title">Batoh</span>
        <button type="button" class="side-window__close" title="Zavřít (I)">×</button>
      </div>
      <div class="inv-list"></div>
      <div class="inv-craft"><span class="inv-craft__label">Vyrobit lze</span><div class="inv-recipes"></div></div>
    `;
    this.itemsEl = root.querySelector('.inv-list');
    this.recipeEl = root.querySelector('.inv-recipes');
    root.querySelector('.side-window__close').addEventListener('click', () => this.close());
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    return root;
  }

  show() {
    this.mount();
    this.open = true;
    this.root.classList.add('is-open');
  }

  close() {
    this.open = false;
    if (this.root) this.root.classList.remove('is-open');
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
      icon.textContent = itemIcon(key);
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
      chip.textContent = `${itemIcon(key)} ${recipe.displayName}`;
      this.recipeEl.appendChild(chip);
    }
  }
}
