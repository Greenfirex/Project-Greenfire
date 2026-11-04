// Nápověda u kurzoru — co se stane, když hráč na to místo klikne.
// Sám nic nehledá; dostane text a pozici, nebo pokyn se schovat.
export default class HoverHint {

  constructor() {
    this.root = null;
    this.textEl = null;
    this.shown = false;
    this.lastText = '';
    this.lastX = null;
    this.lastY = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-hint';
    root.id = 'hud-hint';
    this.textEl = document.createElement('span');
    root.appendChild(this.textEl);
    const layer = document.getElementById('hud-layer') || document.body;
    layer.appendChild(root);
    this.root = root;
    return root;
  }

  show(text) {
    const value = text || '';
    if (!value) {
      this.hide();
      return;
    }
    this.mount();
    if (value !== this.lastText) {
      this.textEl.textContent = value;
      this.lastText = value;
    }
    if (this.shown) return;
    this.root.classList.add('is-open');
    this.shown = true;
  }

  follow(x, y) {
    if (!this.shown || !this.root) return;
    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    const left = Math.round(Math.max(10, Math.min(window.innerWidth - width - 10, x + 18)));
    const top = Math.round(Math.max(10, Math.min(window.innerHeight - height - 10, y + 16)));
    if (left === this.lastX && top === this.lastY) return;
    this.lastX = left;
    this.lastY = top;
    this.root.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  hide() {
    if (!this.shown || !this.root) return;
    this.root.classList.remove('is-open');
    this.shown = false;
  }
}
