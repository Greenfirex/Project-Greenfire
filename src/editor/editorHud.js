// DOM panel editačního režimu — přepínání režimů, paleta brushů, čtení buňky a uložení.
// Napojený přes callbacky na scene, sám nic generuje ani nemění.
import { BRUSHES, BRUSH_GROUPS, brushesOf, getBrush } from '../data/catalogs/brushes.js';
import { makeDraggable } from '../ui/draggable.js';

function formatMeters(value) {
  const n = Math.round(Number(value) * 10) / 10;
  return String(n).replace('.', ',').replace('-', '−');
}

export default class EditorHud {

  constructor() {
    this.root = null;
    this.onBrush = null;
    this.onClose = null;
    this.onMode = null;
    this.onSaveMap = null;
    this.onWaterToggle = null;
    this.onWaterStep = null;
    this.activeBrush = null;
    this.erasing = false;
    this.mode = 'zone';
    this.waterLevel = null;
    this.waterShown = true;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'editor-panel';
    root.dataset.mode = this.mode;
    root.innerHTML = `
      <div class="editor-panel__tabs">
        <button type="button" data-mode="zone">Zóny</button>
        <button type="button" data-mode="height">Výška</button>
        <button type="button" data-mode="area">Herní plocha</button>
        <button type="button" class="editor-panel__close" title="Zavřít (F2)">×</button>
      </div>
      <div class="editor-panel__hint">Vyber štětec a tažením označ obdélník (klik = jedna buňka) · WASD posun pohledu (Shift rychleji) · Levá přidá, pravá odebere z výběru · Z zpět · F2 zavřít</div>
      <div class="editor-panel__grid"></div>
      <div class="editor-panel__note">–</div>
      <div class="editor-panel__readout">–</div>
      <div class="editor-panel__water">
        <div class="editor-panel__water-top">
          <span class="editor-panel__water-label">Voda</span>
          <button type="button" class="editor-panel__water-toggle" title="Zapnout nebo vypnout vodu pro celou mapu">Vypnuto</button>
        </div>
        <div class="editor-panel__water-level">
          <button type="button" data-water-step="-1" title="Snížit hladinu o 0,3 m">−</button>
          <span class="editor-panel__water-value">–</span>
          <button type="button" data-water-step="1" title="Zvýšit hladinu o 0,3 m">+</button>
        </div>
      </div>
      <div class="editor-panel__save-row">
        <button type="button" class="editor-panel__save" title="Uložit mapu (zapíše se do souboru v projektu)">Uložit mapu</button>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);

    const grid = root.querySelector('.editor-panel__grid');
    for (const group of BRUSH_GROUPS) {
      const keys = brushesOf(group);
      if (!keys.length) continue;
      const section = document.createElement('div');
      section.className = 'editor-panel__group';
      const head = document.createElement('div');
      head.className = 'editor-panel__group-head';
      head.textContent = group;
      section.appendChild(head);
      const row = document.createElement('div');
      row.className = 'editor-panel__group-grid';
      for (const key of keys) {
        const brush = BRUSHES[key];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.brush = key;
        btn.textContent = brush.label;
        btn.title = brush.note || brush.label;
        btn.addEventListener('mouseenter', () => this.showNote(key));
        btn.addEventListener('mouseleave', () => this.showNote(this.activeBrush));
        btn.addEventListener('click', () => {
          this.activeBrush = key;
          this.erasing = false;
          this.refresh();
          this.showNote(key);
          if (this.onBrush) this.onBrush(key);
        });
        row.appendChild(btn);
      }
      section.appendChild(row);
      grid.appendChild(section);
    }

    for (const btn of root.querySelectorAll('[data-mode]')) {
      btn.addEventListener('click', () => {
        if (this.onMode) this.onMode(btn.dataset.mode);
      });
    }
    root.querySelector('.editor-panel__save').addEventListener('click', () => {
      if (this.onSaveMap) this.onSaveMap();
    });

    root.querySelector('.editor-panel__water-toggle').addEventListener('click', () => {
      if (this.onWaterToggle) this.onWaterToggle();
    });
    for (const btn of root.querySelectorAll('[data-water-step]')) {
      btn.addEventListener('click', () => {
        if (this.onWaterStep) this.onWaterStep(Number(btn.dataset.waterStep));
      });
    }

    root.querySelector('.editor-panel__close').addEventListener('click', () => {
      if (this.onClose) this.onClose();
    });

    return root;
  }

  setReadout(text) {
    const node = this.root && this.root.querySelector('.editor-panel__readout');
    if (node) node.textContent = text;
  }

  setWater(level, shown = true) {
    this.waterLevel = Number.isFinite(level) ? level : null;
    this.waterShown = shown !== false;
    if (!this.root) return;
    const on = this.waterLevel !== null && this.waterShown;
    this.root.classList.toggle('has-water', on);
    const toggle = this.root.querySelector('.editor-panel__water-toggle');
    if (toggle) {
      toggle.textContent = on ? 'Zapnuto' : 'Vypnuto';
      toggle.classList.toggle('is-active', on);
    }
    const value = this.root.querySelector('.editor-panel__water-value');
    if (value) {
      if (this.waterLevel === null) value.textContent = '–';
      else value.textContent = this.waterShown ? `${formatMeters(this.waterLevel)} m` : 'skrytá';
    }
  }

  setBrush(key) {
    this.activeBrush = key;
    this.erasing = false;
    this.refresh();
  }

  clearBrushSelection() {
    this.activeBrush = null;
    this.refresh();
  }

  setMode(mode) {
    this.mode = mode === 'height' || mode === 'area' ? mode : 'zone';
    this.erasing = false;
    if (this.root) this.root.dataset.mode = this.mode;
    this.refresh();
  }

  showNote(key) {
    const node = this.root && this.root.querySelector('.editor-panel__note');
    if (!node) return;
    const brush = key ? getBrush(key) : null;
    const note = brush && brush.note ? brush.note : '';
    node.textContent = note || '–';
    node.classList.toggle('is-empty', !note);
  }

  refresh() {
    if (!this.root) return;
    for (const btn of this.root.querySelectorAll('[data-mode]')) {
      btn.classList.toggle('is-active', btn.dataset.mode === this.mode);
    }
    for (const btn of this.root.querySelectorAll('[data-brush]')) {
      btn.classList.toggle('is-active', !this.erasing && btn.dataset.brush === this.activeBrush);
    }
  }

  show() {
    this.mount();
    this.root.classList.add('is-open');
    this.root.dataset.mode = this.mode;
    this.setWater(this.waterLevel, this.waterShown);
    if (this.onBrush && this.activeBrush) this.onBrush(this.activeBrush);
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
