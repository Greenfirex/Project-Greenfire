// Log dole vlevo — poslední události ve hře jako chat: nejnovější dole, starší kolečkem myši.
// Záznam může mít pod sebou šedý řádek s podrobnostmi (výpočet zásahu); filtry nahoře ukážou vše, nebo jen bitvu.
// Do hry nijak nezasahuje.
const MEMORY = 100;
const BOTTOM_SLACK = 4;
const FILTERS = [
  { key: 'all', label: 'Vše', empty: 'Zatím se nic neděje.' },
  { key: 'combat', label: 'Bitva', empty: 'Zatím žádný boj.' },
];

export default class LogPanel {

  constructor() {
    this.root = null;
    this.listEl = null;
    this.entries = [];
    this.filter = FILTERS[0];
    this.filterEls = [];
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-panel hud-log';
    root.id = 'hud-log';
    root.innerHTML = '<h2>Log</h2><div class="log-filters"></div><div class="log-list"></div>';
    this.listEl = root.querySelector('.log-list');
    const filtersEl = root.querySelector('.log-filters');
    this.filterEls = FILTERS.map((filter) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'log-filter';
      btn.textContent = filter.label;
      btn.tabIndex = -1;
      btn.addEventListener('mousedown', (evt) => evt.preventDefault());
      btn.addEventListener('click', () => this.setFilter(filter));
      filtersEl.appendChild(btn);
      return btn;
    });
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.render();
    return root;
  }

  add(text, tone = 'info', detail = null, topic = null) {
    if (!text) return;
    this.mount();
    this.entries.push({ text, tone, detail, topic });
    if (this.entries.length > MEMORY) this.entries.splice(0, this.entries.length - MEMORY);
    this.render();
  }

  combat(text, tone = 'info', detail = null) {
    this.add(text, tone, detail, 'combat');
  }

  setFilter(filter) {
    if (filter === this.filter) return;
    this.filter = filter;
    this.render();
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  clear() {
    this.entries = [];
    this.render();
  }

  render() {
    if (!this.listEl) return;
    const list = this.listEl;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= BOTTOM_SLACK;
    list.innerHTML = '';
    FILTERS.forEach((filter, index) => this.filterEls[index].classList.toggle('is-active', filter === this.filter));
    const shown = this.filter.key === 'all' ? this.entries : this.entries.filter((entry) => entry.topic === this.filter.key);
    if (!shown.length) {
      const empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = this.filter.empty;
      list.appendChild(empty);
      return;
    }
    for (const entry of shown) {
      const row = document.createElement('div');
      row.className = `log-row log-row--${entry.tone}`;
      row.textContent = entry.text;
      list.appendChild(row);
      if (!entry.detail) continue;
      const detail = document.createElement('div');
      detail.className = 'log-row log-row--detail';
      detail.textContent = entry.detail;
      list.appendChild(detail);
    }
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
}
