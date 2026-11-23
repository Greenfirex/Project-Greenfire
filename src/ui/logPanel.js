// Log dole vlevo — poslední události ve hře jako chat: nejnovější dole, starší kolečkem myši.
// Záznam může mít pod sebou šedý řádek s podrobnostmi (výpočet zásahu). Do hry nijak nezasahuje.
const MEMORY = 100;
const BOTTOM_SLACK = 4;

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
    root.innerHTML = '<h2>Log</h2><div class="log-list"></div>';
    this.listEl = root.querySelector('.log-list');
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    this.render();
    return root;
  }

  add(text, tone = 'info', detail = null) {
    if (!text) return;
    this.mount();
    this.entries.push({ text, tone, detail });
    if (this.entries.length > MEMORY) this.entries.splice(0, this.entries.length - MEMORY);
    this.render();
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
    if (!this.entries.length) {
      const empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = 'Zatím se nic neděje.';
      list.appendChild(empty);
      return;
    }
    for (const entry of this.entries) {
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
