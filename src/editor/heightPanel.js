// Plovoucí okénko režimu Výška — předvolby, jemný krok, soupis naskládaných výšek a potvrzení.
// Otevírá se při přepnutí na Výšku; samo nic negeneruje ani nemění.
import { HEIGHT_PRESETS, HEIGHT_STEP, MAX_HEIGHT, MIN_HEIGHT } from '../data/maps/layoutStore.js';
import { formatLevel, heightRampColor, heightRampGradientCss } from './heightRamp.js';
import { makeDraggable } from '../ui/draggable.js';

function zeroRatio() {
  const span = MAX_HEIGHT - MIN_HEIGHT;
  return span ? (0 - MIN_HEIGHT) / span : 0.5;
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
    this.onPickLevel = null;
    this.onBrushSize = null;
    this.onStepMode = null;
    this.onJitter = null;
    this.heightLevel = 0;
    this.brushSize = 0;
    this.stepSign = 0;
    this.jitter = 0;
    this.countValue = 0;
    this.undoEnabled = false;
    this.stagedEntries = [];
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'area-panel height-panel';
    const fine = formatLevel(1);
    const wide = formatLevel(2);
    const zeroPct = `${zeroRatio() * 100}%`;
    root.innerHTML = `
      <div class="area-panel__head">
        <span class="area-panel__title">Výška</span>
        <button type="button" class="area-panel__close" title="Zavřít okénko">×</button>
      </div>
      <div class="height-panel__value">0 m</div>
      <div class="height-panel__scale">
        <span class="height-panel__scale-zero" style="left: ${zeroPct}"></span>
        <span class="height-panel__marker"></span>
      </div>
      <div class="height-panel__scale-labels"><span>${formatLevel(MIN_HEIGHT)}</span><span class="height-panel__scale-zero-label" style="left: ${zeroPct}">0</span><span>+${formatLevel(MAX_HEIGHT)}</span></div>
      <div class="height-panel__presets"></div>
      <div class="height-panel__staged is-hidden"></div>
      <div class="height-panel__step-label">Jemný krok</div>
      <div class="height-panel__steps">
        <button type="button" data-step="1" title="Přidat ${fine}">+${fine}</button>
        <button type="button" data-step="-1" title="Ubrat ${fine}">−${fine}</button>
      </div>
      <div class="height-panel__step-label">Velikost štětce</div>
      <div class="height-panel__steps height-panel__steps--four">
        <button type="button" data-size="0" title="Jedna buňka">1×1</button>
        <button type="button" data-size="1" title="Čtverec 3×3">3×3</button>
        <button type="button" data-size="2" title="Čtverec 5×5">5×5</button>
        <button type="button" data-size="3" title="Čtverec 7×7">7×7</button>
      </div>
      <div class="height-panel__step-label">Krok po buňce</div>
      <div class="height-panel__steps height-panel__steps--three">
        <button type="button" data-krok="0" title="Všechny buňky stejně">vyp</button>
        <button type="button" data-krok="-1" title="Každý další otisk o ${fine} níž">−${fine}</button>
        <button type="button" data-krok="1" title="Každý další otisk o ${fine} výš">+${fine}</button>
      </div>
      <div class="height-panel__step-label">Nepravidelnost</div>
      <div class="height-panel__steps height-panel__steps--three">
        <button type="button" data-jitter="0" title="Všechny buňky přesně na zvolené výšce">vyp</button>
        <button type="button" data-jitter="1" title="Každá buňka náhodně ±${fine}">±${fine}</button>
        <button type="button" data-jitter="2" title="Každá buňka náhodně ±${wide}">±${wide}</button>
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

    for (const btn of root.querySelectorAll('[data-size]')) {
      btn.addEventListener('click', () => {
        this.setBrushSize(Number(btn.dataset.size));
        if (this.onBrushSize) this.onBrushSize(this.brushSize);
      });
    }

    for (const btn of root.querySelectorAll('[data-krok]')) {
      btn.addEventListener('click', () => {
        this.setStepMode(Number(btn.dataset.krok));
        if (this.onStepMode) this.onStepMode(this.stepSign);
      });
    }

    for (const btn of root.querySelectorAll('[data-jitter]')) {
      btn.addEventListener('click', () => {
        this.setJitter(Number(btn.dataset.jitter));
        if (this.onJitter) this.onJitter(this.jitter);
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

  setBrushSize(size) {
    const value = Number(size);
    if (!Number.isFinite(value)) return;
    this.brushSize = Math.max(0, Math.min(3, Math.round(value)));
    if (this.root) this.refresh();
  }

  setStepMode(sign) {
    const value = Number(sign);
    if (!Number.isFinite(value)) return;
    this.stepSign = value < 0 ? -1 : value > 0 ? 1 : 0;
    if (this.root) this.refresh();
  }

  setJitter(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    this.jitter = Math.max(0, Math.min(2, Math.round(n)));
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
    for (const btn of this.root.querySelectorAll('[data-size]')) {
      btn.classList.toggle('is-active', Number(btn.dataset.size) === this.brushSize);
    }
    for (const btn of this.root.querySelectorAll('[data-krok]')) {
      btn.classList.toggle('is-active', Number(btn.dataset.krok) === this.stepSign);
    }
    for (const btn of this.root.querySelectorAll('[data-jitter]')) {
      btn.classList.toggle('is-active', Number(btn.dataset.jitter) === this.jitter);
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
    if (Number.isFinite(options.brushSize)) this.brushSize = Math.max(0, Math.min(3, Math.round(options.brushSize)));
    if (Number.isFinite(options.stepSign)) this.stepSign = Math.sign(options.stepSign);
    if (Number.isFinite(options.jitter)) this.jitter = Math.max(0, Math.min(2, Math.round(options.jitter)));
    this.countValue = options.count || 0;
    this.undoEnabled = Boolean(options.undoEnabled);
    this.stagedEntries = options.staged || [];
    this.root.classList.add('is-open');
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
