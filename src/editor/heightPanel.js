// Plovoucí okénko režimu Výška — předvolby, jemný krok, počet a potvrzení.
// Otevírá se při přepnutí na Výšku; samo nic negeneruje ani nemění.
import { HEIGHT_PRESETS, HEIGHT_STEP, MAX_HEIGHT, MIN_HEIGHT } from '../data/maps/layoutStore.js';
import { makeDraggable } from '../ui/draggable.js';

function heightLabel(level, suffix = false) {
  const meters = Math.round((Number(level) || 0) * HEIGHT_STEP * 10) / 10;
  const text = String(meters).replace('.', ',').replace('-', '−');
  return suffix ? `${text} m` : text;
}

export default class HeightPanel {

  constructor() {
    this.root = null;
    this.value = null;
    this.count = null;
    this.presets = null;
    this.onLevel = null;
    this.onStep = null;
    this.onApply = null;
    this.onCancel = null;
    this.onUndo = null;
    this.heightLevel = 0;
    this.countValue = 0;
    this.undoEnabled = false;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'area-panel height-panel';
    const fine = heightLabel(1);
    root.innerHTML = `
      <div class="area-panel__head">
        <span class="area-panel__title">Výška</span>
        <button type="button" class="area-panel__close" title="Zavřít okénko">×</button>
      </div>
      <div class="height-panel__value">0 m</div>
      <div class="height-panel__scale">
        <span class="height-panel__scale-zero"></span>
        <span class="height-panel__marker"></span>
      </div>
      <div class="height-panel__scale-labels"><span>−6</span><span>0</span><span>+6</span></div>
      <div class="height-panel__presets"></div>
      <div class="height-panel__step-label">Jemný krok</div>
      <div class="height-panel__steps">
        <button type="button" data-step="1" title="Přidat ${fine} m">+${fine}</button>
        <button type="button" data-step="-1" title="Ubrat ${fine} m">−${fine}</button>
      </div>
      <div class="area-panel__count">Vybráno: 0 buněk</div>
      <div class="area-panel__tools area-panel__undo-row">
        <button type="button" class="area-panel__undo" title="Vrátit poslední úpravu (Z)">Zpět</button>
      </div>
      <div class="area-panel__actions">
        <button type="button" class="area-panel__apply" title="Potvrdit výběr (Enter)">Aplikovat</button>
        <button type="button" class="area-panel__clear" title="Zahodit výběr">Zahodit</button>
      </div>
      <small class="area-panel__note">Levé tlačítko přidá buňky do výběru, pravé je odebere. Předvolba 0 m srovná.</small>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);
    this.value = root.querySelector('.height-panel__value');
    this.marker = root.querySelector('.height-panel__marker');
    this.count = root.querySelector('.area-panel__count');
    this.presets = root.querySelector('.height-panel__presets');

    for (const level of HEIGHT_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.level = String(level);
      btn.textContent = heightLabel(level);
      btn.title = heightLabel(level, true);
      const meters = level * HEIGHT_STEP;
      btn.classList.add(meters < 0 ? 'is-negative' : meters > 0 ? 'is-positive' : 'is-zero');
      btn.addEventListener('click', () => {
        if (this.onLevel) this.onLevel(level);
      });
      this.presets.appendChild(btn);
    }

    for (const btn of root.querySelectorAll('[data-step]')) {
      btn.addEventListener('click', () => {
        if (this.onStep) this.onStep(Number(btn.dataset.step));
      });
    }
    root.querySelector('.area-panel__apply').addEventListener('click', () => {
      if (this.onApply) this.onApply();
    });
    root.querySelector('.area-panel__clear').addEventListener('click', () => {
      if (this.onCancel) this.onCancel();
    });
    root.querySelector('.area-panel__undo').addEventListener('click', () => {
      if (this.onUndo) this.onUndo();
    });
    root.querySelector('.area-panel__close').addEventListener('click', () => this.hide());
    this.refresh();
    return root;
  }

  setHeight(level) {
    const value = Number(level);
    if (!Number.isFinite(value)) return;
    this.heightLevel = value;
    this.refresh();
  }

  setCount(count) {
    this.countValue = count || 0;
    if (this.root) this.refresh();
  }

  setUndoEnabled(on) {
    this.undoEnabled = Boolean(on);
    if (this.root) this.refresh();
  }

  refresh() {
    if (!this.root) return;
    const meters = this.heightLevel * HEIGHT_STEP;
    this.root.classList.toggle('is-negative', meters < -0.0001);
    this.root.classList.toggle('is-positive', meters > 0.0001);
    this.root.classList.toggle('is-zero', Math.abs(meters) < 0.0001);
    if (this.value) this.value.textContent = heightLabel(this.heightLevel, true);
    if (this.marker) {
      const span = MAX_HEIGHT - MIN_HEIGHT;
      const ratio = span ? (this.heightLevel - MIN_HEIGHT) / span : 0;
      const pct = Math.max(0, Math.min(100, ratio * 100));
      this.marker.style.left = `${pct}%`;
    }
    for (const btn of this.presets.querySelectorAll('[data-level]')) {
      btn.classList.toggle('is-active', Number(btn.dataset.level) === this.heightLevel);
    }
    const n = this.countValue || 0;
    const word = n === 1 ? 'buňka' : n < 5 ? 'buňky' : 'buněk';
    if (this.count) this.count.textContent = `Vybráno: ${n} ${word}`;
    const apply = this.root.querySelector('.area-panel__apply');
    if (apply) apply.disabled = n === 0;
    const clear = this.root.querySelector('.area-panel__clear');
    if (clear) clear.disabled = n === 0;
    const undo = this.root.querySelector('.area-panel__undo');
    if (undo) undo.disabled = !this.undoEnabled;
  }

  open(options = {}) {
    this.mount();
    this.heightLevel = Number.isFinite(options.level) ? options.level : 0;
    this.countValue = options.count || 0;
    this.undoEnabled = Boolean(options.undoEnabled);
    this.root.classList.add('is-open');
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
