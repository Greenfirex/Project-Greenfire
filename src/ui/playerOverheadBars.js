// Malé proužky zdraví a výdrže nad hlavou postavy — stejně jako u tvorů, jen dva nad sebou.
// Sám nic nepočítá; dostane obrazovou pozici a poměry, nebo pokyn se schovat.
export default class PlayerOverheadBars {

  constructor() {
    this.root = null;
    this.health = null;
    this.stamina = null;
    this.visible = false;
    this.last = { health: -1, stamina: -1 };
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hud-player-bars';
    root.innerHTML = [
      '<div class="hud-player-bars__bar"><div class="hud-player-bars__fill hud-player-bars__fill--health"></div></div>',
      '<div class="hud-player-bars__bar"><div class="hud-player-bars__fill hud-player-bars__fill--stamina"></div></div>',
    ].join('');
    root.style.display = 'none';
    (document.getElementById('hud-layer') || document.body).appendChild(root);
    this.health = root.querySelector('.hud-player-bars__fill--health');
    this.stamina = root.querySelector('.hud-player-bars__fill--stamina');
    this.root = root;
    return root;
  }

  update(view) {
    this.mount();
    const show = Boolean(view) && Number.isFinite(view.x) && Number.isFinite(view.y);
    if (show !== this.visible) {
      this.visible = show;
      this.root.style.display = show ? '' : 'none';
    }
    if (!show) return;
    this.root.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px)`;
    this.setFill('health', this.health, view.health);
    this.setFill('stamina', this.stamina, view.stamina);
  }

  setFill(key, el, ratio) {
    const percent = Math.round((Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 1) * 100);
    if (this.last[key] === percent) return;
    this.last[key] = percent;
    el.style.width = `${percent}%`;
  }
}
