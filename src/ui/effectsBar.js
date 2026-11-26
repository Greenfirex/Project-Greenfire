// Řada ikonek efektů na postavě (výhody zeleně, postihy červeně) nad proužky zdraví a energie.
// Sám nic nepočítá — dostane seznam efektů a po najetí myší ukáže jméno a popis.
import { dockArea } from './dock.js';

export default class EffectsBar {

  constructor() {
    this.root = null;
    this.tip = null;
    this.signature = '';
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
    this.root.replaceChildren();
    for (const effect of list) this.root.appendChild(this.icon(effect));
  }

  icon(effect) {
    const icon = document.createElement('div');
    icon.className = `hud-effects__icon is-${effect.kind === 'buff' ? 'buff' : 'debuff'}`;
    icon.textContent = effect.icon || '•';
    icon.addEventListener('mouseenter', () => this.showTip(icon, effect));
    icon.addEventListener('mouseleave', () => this.tip.classList.add('is-hidden'));
    return icon;
  }

  showTip(icon, effect) {
    const title = document.createElement('strong');
    title.textContent = effect.label || effect.key;
    this.tip.replaceChildren(title, document.createTextNode(effect.text || ''));
    icon.appendChild(this.tip);
    this.tip.classList.remove('is-hidden');
  }
}
