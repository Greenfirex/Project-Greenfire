// Plovoucí okénko režimu Výška — předvolby, jemný krok, soupis naskládaných výšek a potvrzení.
// Otevírá se při přepnutí na Výšku; samo nic negeneruje ani nemění.
import { HEIGHT_PRESETS, HEIGHT_STEP, MAX_HEIGHT, MIN_HEIGHT } from '../data/maps/layoutStore.js';
import { formatLevel, heightRampColor, heightRampGradientCss } from './heightRamp.js';
import { makeDraggable } from '../ui/draggable.js';

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
    this.onPickLevel = null;
    this.onToggleHeights = null;
    this.heightLevel = 0;
    this.countValue = 0;
    this.undoEnabled = false;
    this.showHeights = true;
    this.stagedEntries = [];
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'area-panel height-panel';
    const fine = formatLevel(1);
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
      <label class="height-panel__toggle">
        <input type="checkbox" checked>
        <span>Výšky terénu</span>
      </label>
      <div class="height-panel__staged is-hidden"></div>
      <div class="height-panel__step-label">Jemný krok</div>
      <div class="height-panel__steps">
        <button type="button" data-step="1" title="Přidat ${fine}">+${fine}</button>
        <button type="button" data-step="-1" title="Ubrat ${fine}">−${fine}</button>
      </div>
      <div class="area-panel__count">Vybráno: 0 buněk</div>
      <div class="area-panel__tools area-panel__undo-row">
        <button type="button" class="area-panel__undo" title="Vrátit poslední úpravu (Z)">Zpět</button>
      </div>
      <div class="area-panel__actions">
        <button type="button" class="area-panel__apply" title="Zapsat všechny naskládané výšky (Enter)">Aplikovat</button>
        <button type="button" class="area-panel__clear" title="Zahodit výběr">Zahodit</button>
      </div>
      <small class="area-panel__note">Zvol výšku a maluj — každá buňka si drží svou. Přepnutím výšky pokračuješ jinam, Aplikovat zapíše všechno naráz a výběr zruší.</small>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);
    this.value = root.querySelector('.height-panel__value');
    this.marker = root.querySelector('.height-panel__marker');
    this.count = root.querySelector('.area-panel__count');
    this.presets = root.querySelector('.height-panel__presets');
    this.staged = root.querySelector('.height-panel__staged');
    const colorBar = root.querySelector('.height-panel__scale');
    if (colorBar) colorBar.style.background = heightRampGradientCss();
    const toggle = root.querySelector('.height-panel__toggle input');
    if (toggle) {
      toggle.addEventListener('change', () => {
        this.showHeights = toggle.checked;
        if (this.onToggleHeights) this.onToggleHeights(this.showHeights);
      });
    }

    for (const level of HEIGHT_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.level = String(level);
      btn.textContent = formatLevel(level);
      btn.title = formatLevel(level);
      const meters = level * HEIGHT_STEP;
      btn.classList.add(meters < 0 ? 'is-negative' : meters > 0 ? 'is-positive' : 'is-zero');
      const rgb = heightRampColor(meters).map((channel) => Math.round(channel * 255));
      btn.style.borderColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.55)`;
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

  setStaged(entries) {
    this.stagedEntries = entries || [];
    if (this.root) this.refresh();
  }

  refresh() {
    if (!this.root) return;
    const meters = this.heightLevel * HEIGHT_STEP;
    this.root.classList.toggle('is-negative', meters < -0.0001);
    this.root.classList.toggle('is-positive', meters > 0.0001);
    this.root.classList.toggle('is-zero', Math.abs(meters) < 0.0001);
    if (this.value) this.value.textContent = formatLevel(this.heightLevel);
    if (this.marker) {
      const span = MAX_HEIGHT - MIN_HEIGHT;
      const ratio = span ? (this.heightLevel - MIN_HEIGHT) / span : 0;
      const pct = Math.max(0, Math.min(100, ratio * 100));
      this.marker.style.left = `${pct}%`;
    }
    for (const btn of this.presets.querySelectorAll('[data-level]')) {
      btn.classList.toggle('is-active', Number(btn.dataset.level) === this.heightLevel);
    }
    this.refreshStaged();
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

  refreshStaged() {
    if (!this.staged) return;
    const entries = this.stagedEntries || [];
    this.staged.classList.toggle('is-hidden', entries.length === 0);
    this.staged.textContent = '';
    for (const entry of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'height-panel__staged-row';
      btn.dataset.level = String(entry.level);
      btn.textContent = `${entry.count}× ${formatLevel(entry.level)}`;
      btn.title = `Přepnout na ${formatLevel(entry.level)}`;
      const meters = entry.level * HEIGHT_STEP;
      btn.classList.add(meters < 0 ? 'is-negative' : meters > 0 ? 'is-positive' : 'is-zero');
      btn.classList.toggle('is-active', entry.level === this.heightLevel);
      const rgb = heightRampColor(meters).map((channel) => Math.round(channel * 255));
      btn.style.borderLeftColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      btn.addEventListener('click', () => {
        if (this.onPickLevel) this.onPickLevel(entry.level);
      });
      this.staged.appendChild(btn);
    }
  }

  open(options = {}) {
    this.mount();
    this.heightLevel = Number.isFinite(options.level) ? options.level : 0;
    this.countValue = options.count || 0;
    this.undoEnabled = Boolean(options.undoEnabled);
    this.stagedEntries = options.staged || [];
    this.showHeights = options.showHeights === undefined ? true : Boolean(options.showHeights);
    if (this.root) {
      const toggle = this.root.querySelector('.height-panel__toggle input');
      if (toggle) toggle.checked = this.showHeights;
    }
    this.root.classList.add('is-open');
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
