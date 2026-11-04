// Okno s postavou — údaje, které hra o hráči opravdu zná.
// Statistiky přibývají postupně; okno se jen překresluje, do hry nezasahuje.
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
    this.root = null;
    this.valueEls = new Map();
    this.lastSignature = '';
    this.open = false;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'side-window character-window';
    root.id = 'hud-character';
    root.innerHTML = `
      <div class="side-window__head">
        <span class="side-window__title">Postava</span>
        <button type="button" class="side-window__close" title="Zavřít (C)">×</button>
      </div>
      <div class="character-rows"></div>
    `;
    const host = root.querySelector('.character-rows');
    for (const row of ROWS) {
      const line = document.createElement('div');
      line.className = 'character-row';
      const label = document.createElement('span');
      label.textContent = row.label;
      const value = document.createElement('strong');
      value.textContent = '—';
      line.append(label, value);
      host.appendChild(line);
      this.valueEls.set(row.key, value);
    }
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
