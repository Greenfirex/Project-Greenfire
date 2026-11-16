// Malé tlačítko vpravo v dolní liště — ikona s písmenem klávesy v rohu, otevírá okno; jméno ukáže při najetí.
// Jen hlásí kliknutí scéně; stav otevřeného okna si drží scéna.
import { dockArea } from './dock.js';

export default class DockButton {

  constructor({ icon, label, key, slot }) {
    this.icon = icon;
    this.label = label;
    this.key = key || '';
    this.slot = slot || 'panel';
    this.btn = null;
    this.onClick = null;
  }

  mount() {
    if (this.btn) return this.btn;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dock-panel dock-panel--${this.slot}`;
    btn.title = this.key ? `${this.label} (${this.key})` : this.label;
    btn.innerHTML = `<span class="dock-panel__icon">${this.icon}</span><span class="dock-panel__key">${this.key}</span>`;
    btn.addEventListener('mousedown', (evt) => evt.preventDefault());
    btn.addEventListener('click', () => {
      if (this.onClick) this.onClick();
    });
    dockArea('buttons').appendChild(btn);
    this.btn = btn;
    return btn;
  }

  setActive(open) {
    if (this.btn) this.btn.classList.toggle('is-active', Boolean(open));
  }
}
