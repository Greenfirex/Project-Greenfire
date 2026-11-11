// Okno s inventářem — mřížka políček s tím, co hráč nese.
// Předměty jde přesouvat mezi políčky a táhnout na lištu dole; změny jen hlásí callbacky.
import { ITEM_TYPES, toolForItem } from '../data/catalogs/items.js';
import { itemIcon } from './itemIcons.js';
import WindowFrame from './windowFrame.js';
import { wearDragType, SLOT_DRAG_TYPE, BAG_DRAG_TYPE, HAND_DRAG_TYPE, BAR_DRAG_TYPE } from './dragTypes.js';

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
    this.hoverKey = null;
    this.lastSignature = '';
    this.onClose = null;
    this.onUnequip = null;
    this.onMove = null;
    this.onClearBar = null;
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
    `;
    this.itemsEl = this.frame.body.querySelector('.inv-grid');
    this.detailEl = this.frame.body.querySelector('.inv-detail');
    this.itemsEl.addEventListener('pointerleave', () => this.clearDetail());
    this.watchGridDrop(this.itemsEl);
    this.clearDetail();
    return root;
  }

  watchGridDrop(target) {
    target.addEventListener('dragover', (evt) => {
      const types = evt.dataTransfer.types;
      if (!types.includes(SLOT_DRAG_TYPE) && !types.includes(BAR_DRAG_TYPE)) return;
      evt.preventDefault();
      target.classList.add('is-drop');
    });
    target.addEventListener('dragleave', () => target.classList.remove('is-drop'));
    target.addEventListener('drop', (evt) => {
      target.classList.remove('is-drop');
      const slot = evt.dataTransfer.getData(SLOT_DRAG_TYPE);
      const bar = evt.dataTransfer.getData(BAR_DRAG_TYPE);
      if (!slot && bar === '') return;
      evt.preventDefault();
      if (slot && this.onUnequip) this.onUnequip(slot);
      if (bar !== '' && this.onClearBar) this.onClearBar(Number(bar));
    });
  }

  watchMoveDrop(cell, index) {
    cell.addEventListener('dragover', (evt) => {
      if (!evt.dataTransfer.types.includes(BAG_DRAG_TYPE)) return;
      evt.preventDefault();
      cell.classList.add('is-drop');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('is-drop'));
    cell.addEventListener('drop', (evt) => {
      cell.classList.remove('is-drop');
      const from = evt.dataTransfer.getData(BAG_DRAG_TYPE);
      if (from === '') return;
      evt.preventDefault();
      if (this.onMove) this.onMove(Number(from), index);
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

  emptyCell(index) {
    const cell = document.createElement('div');
    cell.className = 'inv-cell is-empty';
    cell.innerHTML = '<span class="inv-cell__icon"></span><span class="inv-cell__name">&nbsp;</span>';
    this.watchMoveDrop(cell, index);
    return cell;
  }

  itemCell(key, amount, index) {
    const label = ITEM_TYPES[key] ? ITEM_TYPES[key].displayName : key;
    const cell = document.createElement('div');
    cell.className = 'inv-cell';
    cell.draggable = true;
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
    const tool = toolForItem(key);
    cell.title = `${label} × ${amount}`;
    if (slot) cell.title = `${label} — přetáhni na postavu (C) pro nasazení`;
    if (tool) cell.title = `${label} — přetáhni na lištu dole`;
    cell.addEventListener('dragstart', (evt) => {
      evt.dataTransfer.setData(BAG_DRAG_TYPE, String(index));
      if (slot) evt.dataTransfer.setData(wearDragType(slot), key);
      if (tool) evt.dataTransfer.setData(HAND_DRAG_TYPE, tool);
      evt.dataTransfer.effectAllowed = 'move';
    });
    this.watchMoveDrop(cell, index);
    return cell;
  }

  update(inventory) {
    this.mount();
    const layout = inventory ? inventory.layout() : [];
    const signature = layout.map((entry) => (entry ? entry.join(':') : '')).join(',');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.itemsEl.innerHTML = '';
    layout.forEach((entry, index) => {
      this.itemsEl.appendChild(entry ? this.itemCell(entry[0], entry[1], index) : this.emptyCell(index));
    });
    if (this.hoverKey) {
      const still = layout.find((entry) => entry && entry[0] === this.hoverKey);
      if (still) this.showDetail(still[0], still[1]);
      else this.clearDetail();
    }
  }
}
