// Log dole vlevo — poslední události ve hře, nejnovější nahoře.
// Jen vypisuje, co mu scéna předá; do hry nijak nezasahuje.
const VISIBLE = 8;
const MEMORY = 100;

export default class LogPanel {

  constructor() {
    this.root = null;
    this.listEl = null;
    this.entries = [];
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-panel hud-log';
    root.id = 'hud-log';
    root.innerHTML = '<h2>Děje se</h2><div class="log-list"></div>';
    this.listEl = root.querySelector('.log-list');
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.render();
    return root;
  }

  add(text, tone = 'info') {
    if (!text) return;
    this.mount();
    this.entries.unshift({ text, tone });
    if (this.entries.length > MEMORY) this.entries.length = MEMORY;
    this.render();
  }

  clear() {
    this.entries = [];
    this.render();
  }

  render() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    if (!this.entries.length) {
      const empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = 'Zatím se nic neděje.';
      this.listEl.appendChild(empty);
      return;
    }
    for (const entry of this.entries.slice(0, VISIBLE)) {
      const row = document.createElement('div');
      row.className = `log-row log-row--${entry.tone}`;
      row.textContent = entry.text;
      this.listEl.appendChild(row);
    }
  }
}
