// Proužek zdraví nad lištou předmětů a červené bliknutí při zásahu.
// Sám nic nepočítá — dostane zdraví s maximem, nebo pokyn bliknout.
export default class HealthBar {

  constructor() {
    this.root = null;
    this.fillEl = null;
    this.valueEl = null;
    this.flashEl = null;
    this.lastText = '';
  }

  mount() {
    if (this.root) return this.root;
    const layer = document.getElementById('hud-layer') || document.body;
    const root = document.createElement('div');
    root.className = 'hud-health';
    root.innerHTML = '<div class="hud-health__bar"><div class="hud-health__fill"></div></div><span class="hud-health__value"></span>';
    layer.appendChild(root);
    this.root = root;
    this.fillEl = root.querySelector('.hud-health__fill');
    this.valueEl = root.querySelector('.hud-health__value');
    const flash = document.createElement('div');
    flash.className = 'hud-damage-flash';
    layer.appendChild(flash);
    this.flashEl = flash;
    return root;
  }

  set(health, maxHealth) {
    this.mount();
    const top = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : 1;
    const value = Number.isFinite(health) ? Math.max(0, Math.min(top, health)) : top;
    const ratio = value / top;
    this.fillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.root.classList.toggle('is-low', ratio <= 0.34);
    this.root.classList.toggle('is-full', ratio >= 0.999);
    const text = `${Math.ceil(value)} / ${Math.round(top)}`;
    if (text === this.lastText) return;
    this.lastText = text;
    this.valueEl.textContent = text;
  }

  flash() {
    this.mount();
    if (typeof this.flashEl.animate !== 'function') return;
    this.flashEl.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
  }
}
