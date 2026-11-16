// Nápověda myši vlevo v dolní liště — co teď udělá levé, pravé a prostřední tlačítko a pár kláves pod tím.
// Sama nic nezjišťuje; dostane hotové řádky (text, případně ztlumené, když na to není výdrž) a vykreslí je.
import { dockArea } from './dock.js';

const BUTTONS = ['left', 'right', 'middle'];

export default class MouseHint {

  constructor() {
    this.root = null;
    this.rows = {};
    this.keysEl = null;
    this.lastView = '';
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'mouse-hint';
    for (const button of BUTTONS) {
      const row = document.createElement('div');
      row.className = 'mouse-hint__row';
      const icon = document.createElement('span');
      icon.className = `mouse-hint__icon mouse-hint__icon--${button}`;
      const text = document.createElement('span');
      text.className = 'mouse-hint__text';
      row.append(icon, text);
      root.appendChild(row);
      this.rows[button] = { row, text };
    }
    this.keysEl = document.createElement('div');
    this.keysEl.className = 'mouse-hint__keys';
    root.appendChild(this.keysEl);
    dockArea('hint').appendChild(root);
    this.root = root;
    return root;
  }

  update(view) {
    this.mount();
    const key = JSON.stringify(view || null);
    if (key === this.lastView) return;
    this.lastView = key;
    this.root.classList.toggle('is-hidden', !view);
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
}
