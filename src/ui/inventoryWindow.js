// Okno s inventářem — co hráč nese a co z toho jde vyrobit.
// Otevírá se tlačítkem u lišty s předměty; obsah jen čte, do hry nezasahuje.
import { ITEM_TYPES, RECIPES } from '../data/catalogs/items.js';
import { itemIcon } from './itemIcons.js';
import WindowFrame from './windowFrame.js';
import { wearDragType, SLOT_DRAG_TYPE } from './dragTypes.js';

const KIND_LABELS = {
  raw: 'Surovina',
  product: 'Produkt',
  tool: 'Nástroj',
  wear: 'Oblečení',
};

export default class InventoryWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-inventory',
      className: 'inv-window',
      title: 'Inventář',
      closeTitle: 'Zavřít (I)',
    });
    this.itemsEl = null;
    this.detailEl = null;
    this.recipeEl = null;
    this.hoverKey = null;
    this.lastSignature = '';
    this.onClose = null;
    this.onUnequip = null;
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
      <div class="inv-layout">
        <div class="inv-grid"></div>
        <div class="inv-detail"></div>
      </div>
      <div class="inv-craft">
        <span class="inv-craft__label">Vyrobit lze</span>
        <div class="inv-recipes"></div>
      </div>
    `;
    this.itemsEl = this.frame.body.querySelector('.inv-grid');
    this.detailEl = this.frame.body.querySelector('.inv-detail');
    this.recipeEl = this.frame.body.querySelector('.inv-recipes');
    this.itemsEl.addEventListener('pointerleave', () => this.clearDetail());
    this.watchUnequipDrop(this.itemsEl);
    this.clearDetail();
    return root;
  }

  watchUnequipDrop(target) {
    target.addEventListener('dragover', (evt) => {
      if (!evt.dataTransfer.types.includes(SLOT_DRAG_TYPE)) return;
      evt.preventDefault();
      target.classList.add('is-drop');
    });
    target.addEventListener('dragleave', () => target.classList.remove('is-drop'));
    target.addEventListener('drop', (evt) => {
      target.classList.remove('is-drop');
      const slot = evt.dataTransfer.getData(SLOT_DRAG_TYPE);
      if (!slot) return;
      evt.preventDefault();
      if (this.onUnequip) this.onUnequip(slot);
    });
  }

  show() {
    this.mount();
    this.frame.show();
  }

  close() {
    this.frame.close();
  }

  showDetail(key, amount) {
    if (!this.detailEl) return;
    this.hoverKey = key;
    const def = ITEM_TYPES[key] || null;
    this.detailEl.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'inv-detail__icon';
    icon.textContent = itemIcon(key);
    const name = document.createElement('div');
    name.className = 'inv-detail__name';
    name.textContent = def ? def.displayName : key;
    this.detailEl.append(icon, name);
    this.detailRow('Druh', KIND_LABELS[def ? def.kind : ''] || 'Předmět');
    this.detailRow('Neseš', `${amount} ks`);
    if (def && Number.isFinite(def.stackSize) && def.stackSize > 0) {
      this.detailRow('Stoh', `${def.stackSize} ks`);
    }
  }

  detailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'inv-detail__row';
    const left = document.createElement('span');
    left.textContent = label;
    const right = document.createElement('strong');
    right.textContent = value;
    row.append(left, right);
    this.detailEl.appendChild(row);
  }

  clearDetail() {
    this.hoverKey = null;
    if (!this.detailEl) return;
    this.detailEl.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'inv-detail__hint';
    hint.textContent = 'Najeď na předmět';
    this.detailEl.appendChild(hint);
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
      const label = ITEM_TYPES[key] ? ITEM_TYPES[key].displayName : key;
      const cell = document.createElement('div');
      cell.className = 'inv-cell';
      cell.title = `${label} × ${amount}`;
      const icon = document.createElement('span');
      icon.className = 'inv-cell__icon';
      icon.textContent = itemIcon(key);
      const count = document.createElement('span');
      count.className = 'inv-cell__count';
      count.textContent = String(amount);
      const name = document.createElement('span');
      name.className = 'inv-cell__name';
      name.textContent = label;
      cell.append(icon, count, name);
      cell.addEventListener('pointerenter', () => this.showDetail(key, amount));
      const slot = ITEM_TYPES[key] ? ITEM_TYPES[key].slot : null;
      if (slot) {
        cell.draggable = true;
        cell.classList.add('is-wearable');
        cell.title = `${label} — přetáhni na postavu (C) pro nasazení`;
        cell.addEventListener('dragstart', (evt) => {
          evt.dataTransfer.setData(wearDragType(slot), key);
          evt.dataTransfer.effectAllowed = 'move';
        });
      }
      this.itemsEl.appendChild(cell);
    }
    if (this.hoverKey) {
      const still = entries.find(([key]) => key === this.hoverKey);
      if (still) this.showDetail(still[0], still[1]);
      else this.clearDetail();
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
