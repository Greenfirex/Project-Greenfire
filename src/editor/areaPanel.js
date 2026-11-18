// Plovoucí okénko režimu Plocha — volba podkladu a výšky, počítadlo a potvrzení.
// Otevírá se při přepnutí na Plochu, sám nic negeneruje ani nemění.
import { surfaceEntries } from '../data/catalogs/decorations.js';
import { makeDraggable } from '../ui/draggable.js';
import { formatMeters } from '../data/maps/layoutStore.js';
import { cellWord } from './editorSettings.js';

const SURFACES = surfaceEntries();
const SURFACE_LABELS = new Map(SURFACES.map((entry) => [entry.key, entry.label]));

export default class AreaPanel {

  constructor() {
    this.root = null;
    this.count = null;
    this.surfaceRow = null;
    this.note = null;
    this.onTool = null;
    this.onApply = null;
    this.onClear = null;
    this.onUndo = null;
    this.onSurface = null;
    this.onHeightStep = null;
    this.tool = 'paint';
    this.countValue = 0;
    this.existingCount = 0;
    this.undoEnabled = false;
    this.surfaceLabel = '';
    this.heightMeters = 0;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'area-panel';
    root.innerHTML = `
      <div class="area-panel__head">
        <span class="area-panel__title">Herní plocha</span>
        <button type="button" class="area-panel__close" title="Zavřít okénko">×</button>
      </div>
      <div class="area-panel__tools">
        <button type="button" data-tool="paint">Ručně</button>
        <button type="button" data-tool="erase">Mazat</button>
      </div>
      <div class="area-panel__surfaces"></div>
      <div class="area-panel__height">
        <button type="button" class="area-panel__height-down" title="Snížit o stupeň (Q)">−</button>
        <span class="area-panel__height-value">výška 0 m</span>
        <button type="button" class="area-panel__height-up" title="Zvýšit o stupeň (E)">+</button>
      </div>
      <div class="area-panel__count">Přidá se: 0 buněk</div>
      <div class="area-panel__tools area-panel__undo-row">
        <button type="button" class="area-panel__undo" title="Vrátit poslední úpravu (Z)">Zpět</button>
      </div>
      <div class="area-panel__actions">
        <button type="button" class="area-panel__apply" title="Potvrdit výběr (Enter)">Aplikovat</button>
        <button type="button" class="area-panel__clear" title="Zahodit výběr (Esc)">Zahodit</button>
      </div>
      <small class="area-panel__note"></small>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);
    this.count = root.querySelector('.area-panel__count');
    this.surfaceRow = root.querySelector('.area-panel__surfaces');
    this.heightValue = root.querySelector('.area-panel__height-value');
    this.note = root.querySelector('.area-panel__note');

    for (const entry of SURFACES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.surface = entry.key;
      btn.title = entry.label;
      const img = document.createElement('img');
      img.src = entry.texture;
      img.alt = entry.label;
      img.draggable = false;
      btn.appendChild(img);
      const label = document.createElement('span');
      label.textContent = entry.label;
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        if (this.onSurface) this.onSurface(entry.key);
      });
      this.surfaceRow.appendChild(btn);
    }

    for (const btn of root.querySelectorAll('[data-tool]')) {
      btn.addEventListener('click', () => {
        if (this.onTool) this.onTool(btn.dataset.tool);
      });
    }
    root.querySelector('.area-panel__height-down').addEventListener('click', () => {
      if (this.onHeightStep) this.onHeightStep(-1);
    });
    root.querySelector('.area-panel__height-up').addEventListener('click', () => {
      if (this.onHeightStep) this.onHeightStep(1);
    });
    root.querySelector('.area-panel__apply').addEventListener('click', () => {
      if (this.onApply) this.onApply();
    });
    root.querySelector('.area-panel__clear').addEventListener('click', () => {
      if (this.onClear) this.onClear();
    });
    root.querySelector('.area-panel__undo').addEventListener('click', () => {
      if (this.onUndo) this.onUndo();
    });
    root.querySelector('.area-panel__close').addEventListener('click', () => this.hide());
    this.refresh();
    return root;
  }

  setTool(tool) {
    this.tool = tool === 'erase' ? 'erase' : 'paint';
    this.mount();
    this.refresh();
  }

  setSurface(key) {
    if (!SURFACE_LABELS.has(key)) return;
    this.surfaceLabel = SURFACE_LABELS.get(key);
    if (this.surfaceRow) {
      for (const btn of this.surfaceRow.querySelectorAll('[data-surface]')) {
        btn.classList.toggle('is-active', btn.dataset.surface === key);
      }
    }
    this.refresh();
  }

  setHeight(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value)) return;
    this.heightMeters = value;
    this.refresh();
  }

  setCount(count, existingCount = 0) {
    this.countValue = count || 0;
    this.existingCount = existingCount || 0;
    if (this.root) this.refresh();
  }

  summary() {
    const height = `výška ${formatMeters(this.heightMeters)}`;
    return this.surfaceLabel ? `${this.surfaceLabel} · ${height}` : height;
  }

  setUndoEnabled(on) {
    this.undoEnabled = Boolean(on);
    if (this.root) this.refresh();
  }

  refresh() {
    if (!this.root) return;
    const erasing = this.tool === 'erase';
    this.root.classList.toggle('is-erasing', erasing);
    if (this.note) {
      this.note.textContent = erasing
        ? 'Táhni myší — označí se obdélník, vrácením myší zpět se zase zmenší. Smažou se označené buňky i s objekty. Z vrací celý krok.'
        : 'Táhni myší — označí se obdélník, vrácením myší zpět se zase zmenší. Nové buňky vzniknou, existující se přepíšou i s objekty. Z vrací celý krok.';
    }
    for (const btn of this.root.querySelectorAll('[data-tool]')) {
      btn.classList.toggle('is-active', btn.dataset.tool === this.tool);
    }
    const n = this.countValue || 0;
    const word = cellWord(n);
    let label;
    if (erasing) {
      label = `Smaže se: ${n} ${word}`;
    } else if (this.existingCount > 0) {
      label = `Přepíše se: ${n} ${word} · ${this.existingCount} už v mapě`;
    } else {
      label = `Přidá se: ${n} ${word}`;
    }
    if (!erasing) label += this.surfaceLabel ? ` · ${this.surfaceLabel}` : '';
    if (this.count) this.count.textContent = label;
    if (this.heightValue) this.heightValue.textContent = `výška ${formatMeters(this.heightMeters)}`;
    const apply = this.root.querySelector('.area-panel__apply');
    if (apply) apply.disabled = n === 0;
    const clear = this.root.querySelector('.area-panel__clear');
    if (clear) clear.disabled = n === 0;
    const undo = this.root.querySelector('.area-panel__undo');
    if (undo) undo.disabled = !this.undoEnabled;
  }

  open(options = {}) {
    this.mount();
    this.tool = options.tool === 'erase' ? 'erase' : 'paint';
    this.countValue = options.count || 0;
    this.existingCount = options.existingCount || 0;
    this.undoEnabled = Boolean(options.undoEnabled);
    this.heightMeters = Number.isFinite(options.height) ? options.height : 0;
    this.setSurface(options.surface);
    this.root.classList.add('is-open');
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
