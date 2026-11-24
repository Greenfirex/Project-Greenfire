// Panel v pravém dolním rohu — nahoře na co hráč míří myší (jméno a údaje pod sebou),
// pod tím co teď udělá levé, pravé a prostřední tlačítko a pár kláves. Sám nic nehledá, jen kreslí, co dostane.
const BUTTONS = ['left', 'right', 'middle'];
const LINE_SEPARATOR = ' · ';

export default class TooltipPanel {

  constructor() {
    this.root = null;
    this.targetEl = null;
    this.titleEl = null;
    this.detailEl = null;
    this.mouseEl = null;
    this.rows = {};
    this.keysEl = null;
    this.shown = false;
    this.lastTitle = null;
    this.lastDetail = null;
    this.lastMouse = '';
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-panel hud-panel--corner hud-tooltip';
    root.id = 'hud-tooltip';
    root.innerHTML = `
      <div class="hud-tooltip__target">
        <span class="hud-tooltip__title"></span>
        <div class="hud-tooltip__detail"></div>
      </div>
      <div class="hud-tooltip__mouse is-hidden"></div>
    `;
    this.targetEl = root.querySelector('.hud-tooltip__target');
    this.titleEl = root.querySelector('.hud-tooltip__title');
    this.detailEl = root.querySelector('.hud-tooltip__detail');
    this.mouseEl = root.querySelector('.hud-tooltip__mouse');
    for (const button of BUTTONS) {
      const row = document.createElement('div');
      row.className = 'mouse-hint__row';
      const icon = document.createElement('span');
      icon.className = `mouse-hint__icon mouse-hint__icon--${button}`;
      const text = document.createElement('span');
      row.append(icon, text);
      this.mouseEl.appendChild(row);
      this.rows[button] = { row, text };
    }
    this.keysEl = document.createElement('div');
    this.keysEl.className = 'mouse-hint__keys';
    this.mouseEl.appendChild(this.keysEl);
    const layer = document.getElementById('hud-layer');
    (layer || document.body).appendChild(root);
    this.root = root;
    this.refreshOpen();
    return root;
  }

  show(title, detail) {
    this.mount();
    const nextTitle = title || '';
    const nextDetail = detail || '';
    if (nextTitle !== this.lastTitle) {
      this.titleEl.textContent = nextTitle;
      this.lastTitle = nextTitle;
    }
    if (nextDetail !== this.lastDetail) {
      const lines = nextDetail.split(LINE_SEPARATOR).filter(Boolean).map((text) => {
        const line = document.createElement('div');
        line.textContent = text;
        return line;
      });
      this.detailEl.replaceChildren(...lines);
      this.lastDetail = nextDetail;
    }
    if (this.shown) return;
    this.shown = true;
    this.refreshOpen();
  }

  hide() {
    if (!this.shown || !this.root) return;
    this.shown = false;
    this.refreshOpen();
  }

  setMouse(view) {
    this.mount();
    const key = JSON.stringify(view || null);
    if (key === this.lastMouse) return;
    this.lastMouse = key;
    this.mouseEl.classList.toggle('is-hidden', !view);
    this.refreshOpen();
    if (!view) return;
    for (const button of BUTTONS) {
      const entry = view[button] || null;
      const { row, text } = this.rows[button];
      text.textContent = entry ? entry.text : '—';
      row.classList.toggle('is-idle', !entry);
      row.classList.toggle('is-off', Boolean(entry && entry.off));
    }
    this.keysEl.replaceChildren();
    for (const [keyName, label] of view.keys || []) {
      const item = document.createElement('span');
      item.className = 'mouse-hint__key-item';
      const badge = document.createElement('span');
      badge.className = 'hud-key';
      badge.textContent = keyName;
      item.append(badge, ` ${label}`);
      this.keysEl.appendChild(item);
    }
  }

  refreshOpen() {
    if (!this.root) return;
    const mouse = !this.mouseEl.classList.contains('is-hidden');
    this.targetEl.classList.toggle('is-hidden', !this.shown);
    this.root.classList.toggle('is-open', this.shown || mouse);
  }
}
