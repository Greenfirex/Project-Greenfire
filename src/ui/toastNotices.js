// Zlatá oznámení uprostřed obrazovky — to nejdůležitější, co hráč nemá přehlédnout (nová úroveň, nové recepty).
// Ukazují se po jednom za sebou; zmizí kliknutím nebo samy po chvíli. Do hry nezasahují, zvuk pustí scéna přes onShow.
const SHOW_MS = 5000;
const FADE_MS = 450;

export default class ToastNotices {

  constructor() {
    this.root = null;
    this.titleEl = null;
    this.textEl = null;
    this.queue = [];
    this.busy = false;
    this.held = true;
    this.timer = 0;
    this.onShow = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-toast';
    root.title = 'Kliknutím zavřeš';
    root.innerHTML = '<div class="hud-toast__title"></div><div class="hud-toast__text"></div>';
    this.titleEl = root.querySelector('.hud-toast__title');
    this.textEl = root.querySelector('.hud-toast__text');
    root.addEventListener('mousedown', (evt) => evt.preventDefault());
    root.addEventListener('click', () => this.dismiss());
    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    return root;
  }

  push(title, text = '') {
    if (!title) return;
    this.queue.push({ title, text });
    this.next();
  }

  release() {
    this.held = false;
    this.next();
  }

  next() {
    if (this.held || this.busy || !this.queue.length) return;
    this.mount();
    const toast = this.queue.shift();
    this.busy = true;
    this.titleEl.textContent = toast.title;
    this.textEl.textContent = toast.text;
    this.textEl.hidden = !toast.text;
    this.root.classList.add('is-on');
    if (this.onShow) this.onShow(toast);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), SHOW_MS);
  }

  dismiss() {
    if (!this.root || !this.root.classList.contains('is-on')) return;
    clearTimeout(this.timer);
    this.root.classList.remove('is-on');
    this.timer = setTimeout(() => {
      this.busy = false;
      this.next();
    }, FADE_MS);
  }

  clear() {
    clearTimeout(this.timer);
    this.queue = [];
    this.busy = false;
    if (this.root) this.root.classList.remove('is-on');
  }
}
