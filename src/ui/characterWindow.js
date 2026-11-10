// Okno s postavou — údaje, které hra o hráči opravdu zná.
// Statistiky přibývají postupně; okno se jen překresluje, do hry nezasahuje.
import WindowFrame from './windowFrame.js';
import { EQUIP_SLOTS, ITEM_TYPES } from '../data/catalogs/items.js';
import { itemIcon } from './itemIcons.js';
import { wearDragType, SLOT_DRAG_TYPE } from './dragTypes.js';

const ROWS = [
  { key: 'health', label: 'Zdraví' },
  { key: 'stamina', label: 'Výdrž' },
  { key: 'cell', label: 'Buňka' },
  { key: 'height', label: 'Výška' },
  { key: 'carrying', label: 'Nese kusů' },
  { key: 'clock', label: 'Herní čas' },
];

export default class CharacterWindow {

  constructor() {
    this.frame = new WindowFrame({
      id: 'hud-character',
      className: 'character-window',
      title: 'Postava',
      closeTitle: 'Zavřít (C)',
    });
    this.valueEls = new Map();
    this.slotEls = new Map();
    this.equipped = {};
    this.lastSignature = '';
    this.onClose = null;
    this.onEquip = null;
    this.frame.onClose = () => {
      if (this.onClose) this.onClose();
    };
  }

  get open() {
    return this.frame.open;
  }

  mount() {
    const root = this.frame.mount();
    if (this.valueEls.size) return root;
    const layout = document.createElement('div');
    layout.className = 'character-layout';

    const doll = document.createElement('div');
    doll.className = 'equip-doll';
    doll.append(
      this.slotColumn(EQUIP_SLOTS.slice(0, 3)),
      this.preview(),
      this.slotColumn(EQUIP_SLOTS.slice(3)),
    );

    const grid = document.createElement('div');
    grid.className = 'character-grid';
    for (const row of ROWS) {
      const card = document.createElement('div');
      card.className = 'character-card';
      const label = document.createElement('span');
      label.className = 'character-card__label';
      label.textContent = row.label;
      const value = document.createElement('strong');
      value.className = 'character-card__value';
      value.textContent = '—';
      card.append(label, value);
      grid.appendChild(card);
      this.valueEls.set(row.key, value);
    }

    layout.append(doll, grid);
    this.frame.body.appendChild(layout);
    return root;
  }

  slotColumn(slots) {
    const column = document.createElement('div');
    column.className = 'equip-col';
    for (const slot of slots) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'equip-slot is-empty';
      btn.title = slot.label;
      btn.dataset.slot = slot.key;
      const icon = document.createElement('span');
      icon.className = 'equip-slot__icon';
      icon.textContent = slot.icon;
      btn.appendChild(icon);
      this.watchSlot(btn, slot);
      this.slotEls.set(slot.key, { btn, icon, slot });
      column.appendChild(btn);
    }
    this.paintSlots();
    return column;
  }

  watchSlot(btn, slot) {
    const wanted = wearDragType(slot.key);
    btn.addEventListener('dragover', (evt) => {
      if (!evt.dataTransfer.types.includes(wanted)) return;
      evt.preventDefault();
      btn.classList.add('is-drop');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('is-drop'));
    btn.addEventListener('drop', (evt) => {
      btn.classList.remove('is-drop');
      const itemKey = evt.dataTransfer.getData(wanted);
      if (!itemKey) return;
      evt.preventDefault();
      if (this.onEquip) this.onEquip(itemKey, slot.key);
    });
    btn.addEventListener('dragstart', (evt) => {
      if (!this.equipped[slot.key]) {
        evt.preventDefault();
        return;
      }
      evt.dataTransfer.setData(SLOT_DRAG_TYPE, slot.key);
      evt.dataTransfer.effectAllowed = 'move';
    });
  }

  setEquipment(slots) {
    this.equipped = { ...(slots || {}) };
    this.paintSlots();
  }

  paintSlots() {
    for (const { btn, icon, slot } of this.slotEls.values()) {
      const itemKey = this.equipped[slot.key];
      const def = itemKey ? ITEM_TYPES[itemKey] : null;
      btn.classList.toggle('is-empty', !itemKey);
      btn.draggable = Boolean(itemKey);
      icon.textContent = itemKey ? itemIcon(itemKey) : slot.icon;
      btn.title = def ? `${slot.label}: ${def.displayName} — přetáhni do batohu pro sundání` : slot.label;
    }
  }

  preview() {
    const box = document.createElement('div');
    box.className = 'equip-preview';
    const note = document.createElement('span');
    note.textContent = 'Náhled postavy připravujeme';
    box.appendChild(note);
    return box;
  }

  show() {
    this.mount();
    this.frame.show();
  }

  close() {
    this.frame.close();
  }

  update(data) {
    this.mount();
    const signature = ROWS.map((row) => String(data[row.key] ?? '')).join('|');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    for (const row of ROWS) {
      const el = this.valueEls.get(row.key);
      if (!el) continue;
      const value = data[row.key];
      el.textContent = value === undefined || value === null || value === '' ? '—' : String(value);
    }
  }
}
