// Okno s postavou — údaje, které hra o hráči opravdu zná.
// Statistiky přibývají postupně; okno se jen překresluje, do hry nezasahuje.
import WindowFrame from './windowFrame.js';

const ROWS = [
  { key: 'health', label: 'Zdraví' },
  { key: 'stamina', label: 'Výdrž' },
  { key: 'cell', label: 'Buňka' },
  { key: 'height', label: 'Výška' },
  { key: 'carrying', label: 'Nese kusů' },
  { key: 'clock', label: 'Herní čas' },
];

const SLOTS = [
  { key: 'head', label: 'Hlava', icon: '⛑' },
  { key: 'chest', label: 'Tělo', icon: '🥋' },
  { key: 'legs', label: 'Nohy', icon: '👖' },
  { key: 'hands', label: 'Ruce', icon: '🧤' },
  { key: 'feet', label: 'Boty', icon: '🥾' },
  { key: 'weapon', label: 'Zbraň', icon: '⚔' },
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
    this.lastSignature = '';
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
    if (this.valueEls.size) return root;
    const layout = document.createElement('div');
    layout.className = 'character-layout';

    const doll = document.createElement('div');
    doll.className = 'equip-doll';
    doll.append(
      this.slotColumn(SLOTS.slice(0, 3)),
      this.preview(),
      this.slotColumn(SLOTS.slice(3)),
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
      column.appendChild(btn);
    }
    return column;
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
