// Panel v pravém dolním rohu — ukazuje, na co hráč právě míří myší.
// Sám nic nehledá; dostane jméno a doplněk, a buď je ukáže, nebo se schová.
export default class TooltipPanel {

  constructor() {
    this.root = null;
    this.titleEl = null;
    this.detailEl = null;
    this.shown = false;
    this.lastTitle = null;
    this.lastDetail = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-panel hud-panel--corner hud-tooltip';
    root.id = 'hud-tooltip';
    root.innerHTML = '<span class="hud-tooltip__title"></span><span class="hud-tooltip__detail"></span>';
    this.titleEl = root.querySelector('.hud-tooltip__title');
    this.detailEl = root.querySelector('.hud-tooltip__detail');
    const layer = document.getElementById('hud-layer');
    (layer || document.body).appendChild(root);
    this.root = root;
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
      this.detailEl.textContent = nextDetail;
      this.lastDetail = nextDetail;
    }
    if (this.shown) return;
    this.root.classList.add('is-open');
    this.shown = true;
  }

  hide() {
    if (!this.shown || !this.root) return;
    this.root.classList.remove('is-open');
    this.shown = false;
  }
}