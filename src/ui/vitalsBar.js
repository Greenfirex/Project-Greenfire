// Proužky stavu postavy — zdraví a energie, pod nimi sytost a voda nad lištou nástrojů, a červené bliknutí při zásahu.
// Sám nic nepočítá — dostane hodnoty s maximem, nebo pokyn bliknout.
import { dockArea } from './dock.js';

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
    this.needs = {};
  }

  mount() {
    if (this.root) return this.root;
    const layer = document.getElementById('hud-layer') || document.body;
    const root = document.createElement('div');
    root.className = 'hud-vitals';
    root.innerHTML = `
      <div class="hud-vitals__group" title="Zdraví">
        <span class="hud-vitals__icon">♥</span>
        <div class="hud-vitals__bar">
          <div class="hud-vitals__fill hud-vitals__fill--health"></div>
          <span class="hud-vitals__value hud-vitals__value--health"></span>
        </div>
      </div>
      <div class="hud-vitals__group" title="Energie">
        <span class="hud-vitals__icon hud-vitals__icon--stamina">⚡</span>
        <div class="hud-vitals__bar">
          <div class="hud-vitals__fill hud-vitals__fill--stamina"></div>
          <span class="hud-vitals__value hud-vitals__value--stamina"></span>
        </div>
      </div>
      <div class="hud-vitals__group hud-vitals__group--need" title="Sytost">
        <span class="hud-vitals__icon hud-vitals__icon--hunger">🍖</span>
        <div class="hud-vitals__bar">
          <div class="hud-vitals__fill hud-vitals__fill--hunger"></div>
          <span class="hud-vitals__value hud-vitals__value--hunger"></span>
        </div>
      </div>
      <div class="hud-vitals__group hud-vitals__group--need" title="Voda">
        <span class="hud-vitals__icon hud-vitals__icon--thirst">💧</span>
        <div class="hud-vitals__bar">
          <div class="hud-vitals__fill hud-vitals__fill--thirst"></div>
          <span class="hud-vitals__value hud-vitals__value--thirst"></span>
        </div>
      </div>
    `;
    dockArea('center').prepend(root);
    this.root = root;
    this.healthFill = root.querySelector('.hud-vitals__fill--health');
    this.healthValue = root.querySelector('.hud-vitals__value--health');
    this.staminaFill = root.querySelector('.hud-vitals__fill--stamina');
    this.staminaValue = root.querySelector('.hud-vitals__value--stamina');
    for (const key of ['hunger', 'thirst']) {
      this.needs[key] = {
        fill: root.querySelector(`.hud-vitals__fill--${key}`),
        value: root.querySelector(`.hud-vitals__value--${key}`),
        text: '',
      };
    }
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

  setNeeds(hunger, thirst, max) {
    this.mount();
    this.setNeed(this.needs.hunger, hunger, max);
    this.setNeed(this.needs.thirst, thirst, max);
  }

  setNeed(need, amount, max) {
    const { value, top } = this.measure(amount, max);
    need.fill.style.width = `${((value / top) * 100).toFixed(1)}%`;
    const text = `${Math.ceil(value)} / ${Math.round(top)}`;
    if (text === need.text) return;
    need.text = text;
    need.value.textContent = text;
  }

  setVisible(visible) {
    this.mount();
    this.root.classList.toggle('is-hidden', !visible);
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
