// DOM panel editačního režimu — paleta brushů, modelování výšek, mazání a zpět.
// Napojený přes callbacky na scene, sám nic generuje ani nemění.
import { BRUSH_KEYS, BRUSHES } from '../data/catalogs/brushes.js';
import { makeDraggable } from './draggable.js';

const HEIGHT_LEVELS = [0, 1, 2, 3, 4];

export default class EditorHud {

  constructor() {
    this.root = null;
    this.onBrush = null;
    this.onClose = null;
    this.onMode = null;
    this.onHeightLevel = null;
    this.onHeightStep = null;
    this.onSmooth = null;
    this.onSaveMap = null;
    this.activeBrush = null;
    this.erasing = false;
    this.mode = 'zone';
    this.heightLevel = 2;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'editor-panel';
    root.dataset.mode = this.mode;
    root.innerHTML = `
      <div class="editor-panel__head">
        <span class="editor-panel__title">Editor mapy</span>
        <button type="button" class="editor-panel__close" title="Zavřít (F1)">×</button>
      </div>
      <div class="editor-panel__hint">Klikni na brush, nakresli zónu tažením, pak Aplikovat · pravý klik maže · Z zpět · F1 zavřít</div>
      <div class="editor-panel__modes">
        <button type="button" data-mode="zone">Zóny</button>
        <button type="button" data-mode="height">Výška</button>
        <button type="button" data-mode="area">Plocha</button>
      </div>
      <div class="editor-panel__grid"></div>
      <div class="editor-panel__heights">
        <span class="editor-panel__label">Výška</span>
        <button type="button" data-height="0">0</button>
        <button type="button" data-height="1">1</button>
        <button type="button" data-height="2">2</button>
        <button type="button" data-height="3">3</button>
        <button type="button" data-height="4">4</button>
        <button type="button" data-step="1" title="Přidat 1 m (Q)">+1</button>
        <button type="button" data-step="-1" title="Ubrat 1 m (E)">−1</button>
        <button type="button" data-tool="smooth" title="Vyhladit schody">✦ Vyhladit</button>
      </div>
      <div class="editor-panel__readout">–</div>
      <div class="editor-panel__save-row">
        <button type="button" class="editor-panel__save" title="Uložit mapu (zapíše se do souboru v projektu)">Uložit mapu</button>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);

    const grid = root.querySelector('.editor-panel__grid');
    for (const key of BRUSH_KEYS) {
      const brush = BRUSHES[key];
      if (brush.shape === 'perimeter') continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.brush = key;
      btn.textContent = brush.label;
      btn.title = `${key} (${brush.shape})`;
      btn.addEventListener('click', () => {
        this.activeBrush = key;
        this.erasing = false;
        this.refresh();
        if (this.onBrush) this.onBrush(key);
      });
      grid.appendChild(btn);
    }

    for (const btn of root.querySelectorAll('[data-mode]')) {
      btn.addEventListener('click', () => {
        if (this.onMode) this.onMode(btn.dataset.mode);
      });
    }
    for (const btn of root.querySelectorAll('[data-height]')) {
      btn.addEventListener('click', () => {
        if (this.onHeightLevel) this.onHeightLevel(Number(btn.dataset.height));
      });
    }
    for (const btn of root.querySelectorAll('[data-step]')) {
      btn.addEventListener('click', () => {
        if (this.onHeightStep) this.onHeightStep(Number(btn.dataset.step));
      });
    }
    root.querySelector('[data-tool="smooth"]').addEventListener('click', () => {
      if (this.onSmooth) this.onSmooth();
    });
    root.querySelector('.editor-panel__save').addEventListener('click', () => {
      if (this.onSaveMap) this.onSaveMap();
    });

    root.querySelector('.editor-panel__close').addEventListener('click', () => {
      if (this.onClose) this.onClose();
    });

    return root;
  }

  setReadout(text) {
    const node = this.root && this.root.querySelector('.editor-panel__readout');
    if (node) node.textContent = text;
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

  setHeightLevel(level) {
    this.heightLevel = level;
    this.refresh();
  }

  refresh() {
    if (!this.root) return;
    for (const btn of this.root.querySelectorAll('[data-mode]')) {
      btn.classList.toggle('is-active', btn.dataset.mode === this.mode);
    }
    for (const btn of this.root.querySelectorAll('[data-height]')) {
      btn.classList.toggle('is-active', !this.erasing && Number(btn.dataset.height) === this.heightLevel);
    }
    for (const btn of this.root.querySelectorAll('[data-brush]')) {
      btn.classList.toggle('is-active', !this.erasing && btn.dataset.brush === this.activeBrush);
    }
  }

  show() {
    this.mount();
    this.root.classList.add('is-open');
    this.root.dataset.mode = this.mode;
    if (this.onBrush && this.activeBrush) this.onBrush(this.activeBrush);
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
