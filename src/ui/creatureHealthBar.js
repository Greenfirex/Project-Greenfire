// Proužky zdraví nad tvory — dostane hotové obrazové pozice a poměr zdraví.
// Sám nic nepočítá a o scéně neví; proužky jen zobrazuje, posouvá a schovává.
const LOW_PERCENT = 34;
const HURT_PERCENT = 66;

export default class CreatureHealthBar {

  constructor() {
    this.layer = null;
    this.bars = new Map();
  }

  mount() {
    if (this.layer) return this.layer;
    this.layer = document.getElementById('hud-layer') || document.body;
    return this.layer;
  }

  update(items) {
    this.mount();
    const seen = new Set();
    for (const item of items || []) {
      if (!item || item.key === undefined || item.key === null) continue;
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
      const key = String(item.key);
      const bar = this.barFor(key);
      seen.add(key);
      this.show(bar);
      bar.root.style.transform = `translate(-50%, -50%) translate(${item.x}px, ${item.y}px)`;
      const ratio = Number.isFinite(item.ratio) ? Math.max(0, Math.min(1, item.ratio)) : 1;
      const percent = Math.round(ratio * 100);
      if (bar.percent !== percent) {
        bar.percent = percent;
        bar.fill.style.width = `${percent}%`;
        bar.root.classList.toggle('is-hurt', percent <= HURT_PERCENT && percent > LOW_PERCENT);
        bar.root.classList.toggle('is-low', percent <= LOW_PERCENT);
      }
    }
    for (const [key, bar] of this.bars) {
      if (!seen.has(key)) this.hide(bar);
    }
  }

  barFor(key) {
    const existing = this.bars.get(key);
    if (existing) return existing;
    const root = document.createElement('div');
    root.className = 'hud-creature-health';
    root.innerHTML = '<div class="hud-creature-health__fill"></div>';
    root.style.display = 'none';
    this.layer.appendChild(root);
    const bar = {
      root,
      fill: root.querySelector('.hud-creature-health__fill'),
      percent: -1,
      visible: false,
    };
    this.bars.set(key, bar);
    return bar;
  }

  show(bar) {
    if (bar.visible) return;
    bar.visible = true;
    bar.root.style.display = '';
  }

  hide(bar) {
    if (!bar.visible) return;
    bar.visible = false;
    bar.root.style.display = 'none';
  }
}
