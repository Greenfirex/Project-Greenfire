// Panel vpravo nahoře se statistikami tvora, kterého si hráč klikem vybral.
// Sám nic nepočítá: dostane hotové řádky, vykreslí je a kliknutí na křížek ohlásí přes onClose.
export default class CreaturePanel {

  constructor() {
    this.root = null;
    this.titleEl = null;
    this.subtitleEl = null;
    this.barEl = null;
    this.rowsEl = null;
    this.hintEl = null;
    this.shown = false;
    this.lastRows = null;
    this.onClose = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-panel hud-panel--corner hud-creature';
    root.id = 'hud-creature';
    root.innerHTML = [
      '<div class="hud-creature__head">',
      '<span class="hud-creature__title"></span>',
      '<button type="button" class="hud-creature__close" title="Zavřít">×</button>',
      '</div>',
      '<span class="hud-creature__subtitle"></span>',
      '<div class="hud-creature__bar"><div class="hud-creature__fill"></div></div>',
      '<div class="hud-creature__rows"></div>',
      '<span class="hud-creature__hint"></span>',
    ].join('');
    this.titleEl = root.querySelector('.hud-creature__title');
    this.subtitleEl = root.querySelector('.hud-creature__subtitle');
    this.barEl = root.querySelector('.hud-creature__fill');
    this.rowsEl = root.querySelector('.hud-creature__rows');
    this.hintEl = root.querySelector('.hud-creature__hint');
    root.querySelector('.hud-creature__close').addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (this.onClose) this.onClose();
    });
    const layer = document.getElementById('hud-layer');
    (layer || document.body).appendChild(root);
    this.root = root;
    return root;
  }

  show(view) {
    if (!view) return;
    this.mount();
    this.titleEl.textContent = view.title || '';
    this.subtitleEl.textContent = view.subtitle || '';
    const ratio = view.total > 0 ? Math.max(0, Math.min(1, view.left / view.total)) : 0;
    this.barEl.style.width = `${Math.round(ratio * 100)}%`;
    this.hintEl.textContent = view.hint || '';
    this.renderRows(view.rows || []);
    if (this.shown) return;
    this.root.classList.add('is-open');
    this.shown = true;
  }

  renderRows(rows) {
    const key = JSON.stringify(rows);
    if (key === this.lastRows) return;
    this.lastRows = key;
    this.rowsEl.replaceChildren();
    for (const row of rows) {
      const line = document.createElement('div');
      line.className = row.locked ? 'hud-row hud-creature__row is-locked' : 'hud-row hud-creature__row';
      const label = document.createElement('span');
      label.textContent = row.label;
      const value = document.createElement('strong');
      value.textContent = row.value;
      line.append(label, value);
      this.rowsEl.append(line);
    }
  }

  hide() {
    if (!this.shown || !this.root) return;
    this.root.classList.remove('is-open');
    this.shown = false;
  }
}
