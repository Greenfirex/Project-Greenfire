// Řada ikonek efektů na postavě (výhody zeleně, postihy červeně) nad proužky zdraví a energie.
// Sám nic nepočítá — dostane seznam efektů a po najetí myší ukáže jméno a popis; u efektu na čas
// přes ikonku ubíhá tmavá výseč podle toho, kolik ještě zbývá.
import { dockArea } from './dock.js';

export default class EffectsBar {

  constructor() {
    this.root = null;
    this.tip = null;
    this.tipKey = null;
    this.signature = '';
    this.icons = new Map();
    this.effects = new Map();
    this.details = new Map();
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-effects';
    const tip = document.createElement('div');
    tip.className = 'hud-effects__tip is-hidden';
    dockArea('center').prepend(root);
    this.root = root;
    this.tip = tip;
    return root;
  }

  set(effects) {
    this.mount();
    const list = Array.isArray(effects) ? effects : [];
    const signature = list.map((effect) => effect.key).join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.icons.clear();
    this.effects.clear();
    this.tipKey = null;
    this.root.replaceChildren();
    for (const effect of list) {
      const icon = this.icon(effect);
      this.icons.set(effect.key, icon);
      this.effects.set(effect.key, effect);
      this.root.appendChild(icon);
    }
  }

  setProgress(key, left, detail = '') {
    const icon = this.icons.get(key);
    if (!icon) return;
    const spent = 1 - Math.max(0, Math.min(1, left));
    icon.classList.add('is-timed');
    icon.style.setProperty('--spent', spent.toFixed(3));
    if (this.details.get(key) === detail) return;
    this.details.set(key, detail);
    if (this.tipKey === key) this.showTip(icon, this.effects.get(key));
  }

  icon(effect) {
    const icon = document.createElement('div');
    icon.className = `hud-effects__icon is-${effect.kind === 'buff' ? 'buff' : 'debuff'}`;
    icon.textContent = effect.icon || '•';
    icon.addEventListener('mouseenter', () => this.showTip(icon, effect));
    icon.addEventListener('mouseleave', () => {
      this.tipKey = null;
      this.tip.classList.add('is-hidden');
    });
    return icon;
  }

  showTip(icon, effect) {
    const title = document.createElement('strong');
    title.textContent = effect.label || effect.key;
    const parts = [title, document.createTextNode(effect.text || '')];
    const detail = this.details.get(effect.key);
    if (detail) {
      const line = document.createElement('span');
      line.className = 'hud-effects__detail';
      line.textContent = detail;
      parts.push(line);
    }
    this.tip.replaceChildren(...parts);
    this.tipKey = effect.key;
    icon.appendChild(this.tip);
    this.tip.classList.remove('is-hidden');
  }
}
