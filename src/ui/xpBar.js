// Proužek zkušeností na dolní liště — číslo úrovně a kolik zbývá do další.
// Sám nic nepočítá — dostane úroveň, zkušenosti, kolik je jich na další úroveň potřeba, a volné body.
import { dockArea } from './dock.js';

export default class XpBar {

  constructor() {
    this.root = null;
    this.fill = null;
    this.levelEl = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-xp';
    root.innerHTML = `
      <span class="hud-xp__level"></span>
      <div class="hud-xp__bar"><div class="hud-xp__fill"></div></div>
    `;
    dockArea('center').appendChild(root);
    this.root = root;
    this.fill = root.querySelector('.hud-xp__fill');
    this.levelEl = root.querySelector('.hud-xp__level');
    return root;
  }

  set(level, xp, needed, points) {
    this.mount();
    const share = needed > 0 ? Math.max(0, Math.min(1, xp / needed)) : 0;
    this.fill.style.width = `${(share * 100).toFixed(1)}%`;
    this.levelEl.textContent = String(level);
    this.root.classList.toggle('has-points', points > 0);
    const extra = points > 0 ? ` · body k rozdělení: ${points} (okno postavy)` : '';
    this.root.title = `Úroveň ${level} · ${Math.floor(xp)} / ${needed} zkušeností${extra}`;
  }
}
