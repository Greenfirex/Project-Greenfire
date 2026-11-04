// Proužky stavu postavy — zdraví a výdrž vedle sebe a červené bliknutí při zásahu.
// Sám nic nepočítá — dostane hodnoty s maximem, nebo pokyn bliknout.
export default class VitalsBar {

  constructor() {
    this.root = null;
    this.healthFill = null;
    this.healthValue = null;
    this.staminaFill = null;
    this.staminaValue = null;
    this.flashEl = null;
    this.lastHealthText = '';
    this.lastStaminaText = '';
  }

  mount() {
    if (this.root) return this.root;
    const layer = document.getElementById('hud-layer') || document.body;
    const root = document.createElement('div');
    root.className = 'hud-vitals';
    root.innerHTML = `
      <div class="hud-vitals__group">
        <div class="hud-vitals__bar"><div class="hud-vitals__fill hud-vitals__fill--health"></div></div>
        <span class="hud-vitals__value hud-vitals__value--health"></span>
      </div>
      <div class="hud-vitals__group">
        <div class="hud-vitals__bar"><div class="hud-vitals__fill hud-vitals__fill--stamina"></div></div>
        <span class="hud-vitals__value hud-vitals__value--stamina"></span>
      </div>
    `;
    layer.appendChild(root);
    this.root = root;
    this.healthFill = root.querySelector('.hud-vitals__fill--health');
    this.healthValue = root.querySelector('.hud-vitals__value--health');
    this.staminaFill = root.querySelector('.hud-vitals__fill--stamina');
    this.staminaValue = root.querySelector('.hud-vitals__value--stamina');
    const flash = document.createElement('div');
    flash.className = 'hud-damage-flash';
    layer.appendChild(flash);
    this.flashEl = flash;
    return root;
  }

  setHealth(health, maxHealth) {
    this.mount();
    const { value, top } = this.measure(health, maxHealth);
    this.healthFill.style.width = `${((value / top) * 100).toFixed(1)}%`;
    this.root.classList.toggle('is-low-health', value / top <= 0.34);
    const text = `${Math.ceil(value)} / ${Math.round(top)}`;
    if (text === this.lastHealthText) return;
    this.lastHealthText = text;
    this.healthValue.textContent = text;
  }

  setStamina(stamina, maxStamina) {
    this.mount();
    const { value, top } = this.measure(stamina, maxStamina);
    this.staminaFill.style.width = `${((value / top) * 100).toFixed(1)}%`;
    this.root.classList.toggle('is-empty-stamina', value <= 0);
    const text = `${Math.ceil(value)} / ${Math.round(top)}`;
    if (text === this.lastStaminaText) return;
    this.lastStaminaText = text;
    this.staminaValue.textContent = text;
  }

  measure(value, max) {
    const top = Number.isFinite(max) && max > 0 ? max : 1;
    const clamped = Number.isFinite(value) ? Math.max(0, Math.min(top, value)) : top;
    return { value: clamped, top };
  }

  flash() {
    this.mount();
    if (typeof this.flashEl.animate !== 'function') return;
    this.flashEl.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
  }
}
