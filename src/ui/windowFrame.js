// Společný rám oken nad hrou — hlavička s názvem, křížek, tažení a zavírání.
// Okno si dodá jen svůj obsah; rámu stačí říct jméno a titulek.
import { makeDraggable } from './draggable.js';

export default class WindowFrame {

  constructor({ id, className, title, closeTitle }) {
    this.id = id;
    this.className = className || '';
    this.title = title;
    this.closeTitle = closeTitle || 'Zavřít';
    this.root = null;
    this.body = null;
    this.open = false;
    this.onClose = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = `side-window ${this.className}`.trim();
    root.id = this.id;
    root.innerHTML = `
      <div class="side-window__head">
        <span class="side-window__title">${this.title}</span>
        <button type="button" class="side-window__close" title="${this.closeTitle}">×</button>
      </div>
      <div class="side-window__body"></div>
    `;
    this.body = root.querySelector('.side-window__body');
    root.querySelector('.side-window__close').addEventListener('click', () => this.close());
    const layer = document.getElementById('hud-layer') || document.body;
    layer.appendChild(root);
    this.root = root;
    makeDraggable(root, root.querySelector('.side-window__head'));
    return root;
  }

  show() {
    this.mount();
    this.open = true;
    this.root.classList.add('is-open');
  }

  close() {
    if (!this.root) return;
    this.open = false;
    this.root.classList.remove('is-open');
    if (this.onClose) this.onClose();
  }
}
