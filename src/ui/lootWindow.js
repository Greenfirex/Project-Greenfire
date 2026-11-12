// Okno kořisti — co je v truhle nebo u uloveného tvora a co si z toho hráč vezme.
// Kliknutí na předmět nebo „Vzít vše" jen ohlásí scéně, co hráč chce; obsah drží hra.
import { ITEM_TYPES } from '../data/catalogs/items.js';
import { itemIconElement } from './itemIcons.js';
import WindowFrame from './windowFrame.js';

export default class LootWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-loot',
      className: 'loot-window',
      title: 'Kořist',
      closeTitle: 'Zavřít (Esc)',
    });
    this.itemsEl = null;
    this.onTake = null;
    this.onTakeAll = null;
    this.onClose = null;
    this.frame.onClose = () => {
      if (this.onClose) this.onClose();
    };
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    const root = this.frame.mount();
    if (this.itemsEl) return root;
    this.frame.body.innerHTML = `
      <div class="loot-grid"></div>
      <button type="button" class="loot-take-all">Vzít vše (E)</button>
    `;
    this.itemsEl = this.frame.body.querySelector('.loot-grid');
    this.frame.body.querySelector('.loot-take-all').addEventListener('click', () => {
      if (this.onTakeAll) this.onTakeAll();
    });
    return root;
  }

  show(title, items) {
    this.mount();
    this.frame.setTitle(title);
    this.update(items);
    this.frame.show();
  }

  close() {
    this.frame.close();
  }

  update(items) {
    this.mount();
    this.itemsEl.innerHTML = '';
    for (const { itemKey, amount } of items || []) {
      const label = ITEM_TYPES[itemKey] ? ITEM_TYPES[itemKey].displayName : itemKey;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'inv-cell loot-cell';
      cell.title = `Vzít: ${label} × ${amount}`;
      const icon = itemIconElement(itemKey, 'inv-cell__icon');
      const count = document.createElement('span');
      count.className = 'inv-cell__count';
      count.textContent = String(amount);
      const name = document.createElement('span');
      name.className = 'inv-cell__name';
      name.textContent = label;
      cell.append(icon, count, name);
      cell.addEventListener('click', () => {
        if (this.onTake) this.onTake(itemKey);
      });
      this.itemsEl.appendChild(cell);
    }
  }
}
