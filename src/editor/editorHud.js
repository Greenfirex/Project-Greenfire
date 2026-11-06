// DOM panel editačního režimu — přepínání režimů, paleta brushů, čtení buňky a uložení.
// Napojený přes callbacky na scene, sám nic generuje ani nemění.
import { BRUSHES, BRUSH_GROUPS, brushesOf, getBrush } from '../data/catalogs/brushes.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { makeDraggable } from '../ui/draggable.js';

function formatMeters(value) {
  const n = Math.round(Number(value) * 100) / 100;
  return String(n).replace('.', ',').replace('-', '−');
}

export default class EditorHud {

  constructor() {
    this.root = null;
    this.onBrush = null;
    this.onClose = null;
    this.onMode = null;
    this.onSaveMap = null;
    this.onPause = null;
    this.onWaterToggle = null;
    this.onWaterStep = null;
    this.state = { mode: 'zone', brush: null, erasing: false };
    this.waterLevel = null;
    this.waterShown = true;
    this.busyEl = null;
    this.cursorEl = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'editor-panel';
    root.dataset.mode = this.state.mode;
    root.innerHTML = `
      <div class="editor-panel__tabs">
        <button type="button" data-mode="zone">Zóny</button>
        <button type="button" data-mode="height">Výška</button>
        <button type="button" data-mode="area">Herní plocha</button>
        <button type="button" class="editor-panel__close" title="Zavřít (F2)">×</button>
      </div>
      <div class="editor-panel__hint">Vyber štětec a tažením označ obdélník (klik = jedna buňka) · WASD posun pohledu (Shift rychleji) · Pravé tažení otáčí pohled, pravé kliknutí odebere buňku · Z zpět · F2 zavřít</div>
      <div class="editor-panel__grid"></div>
      <div class="editor-panel__note">–</div>
      <div class="editor-panel__readout">–</div>
      <div class="editor-panel__water">
        <div class="editor-panel__water-top">
          <span class="editor-panel__water-label">Voda</span>
          <button type="button" class="editor-panel__water-toggle" title="Zapnout nebo vypnout vodu pro celou mapu">Vypnuto</button>
        </div>
        <div class="editor-panel__water-level">
          <button type="button" data-water-step="-1" title="Snížit hladinu o ${String(HEIGHT_STEP).replace('.', ',')} m">−</button>
          <span class="editor-panel__water-value">–</span>
          <button type="button" data-water-step="1" title="Zvýšit hladinu o ${String(HEIGHT_STEP).replace('.', ',')} m">+</button>
        </div>
      </div>
      <div class="editor-panel__save-row">
        <button type="button" class="editor-panel__save editor-panel__pause" title="Pozastavit nebo pustit hru (P)">Pauza</button>
        <button type="button" class="editor-panel__save" title="Uložit mapu (zapíše se do souboru v projektu)">Uložit mapu</button>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    const busy = document.createElement('div');
    busy.className = 'editor-busy';
    document.body.appendChild(busy);
    this.busyEl = busy;
    const cursor = document.createElement('div');
    cursor.className = 'editor-cursor';
    document.body.appendChild(cursor);
    this.cursorEl = cursor;
    window.addEventListener('pointermove', (evt) => this.placeCursor(evt.clientX, evt.clientY));
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
        if (brush.erase) btn.classList.add('is-eraser');
        btn.addEventListener('mouseenter', () => this.showNote(key));
        btn.addEventListener('mouseleave', () => this.showNote(this.state.brush));
        btn.addEventListener('click', () => {
          this.state.brush = key;
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
    root.querySelector('.editor-panel__pause').addEventListener('click', () => {
      if (this.onPause) this.onPause();
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

  setBusy(text) {
    if (!this.busyEl) return;
    const label = typeof text === 'string' ? text : '';
    if (!label) {
      this.busyEl.classList.remove('is-on');
      this.busyEl.textContent = '';
      return;
    }
    if (this.busyEl.textContent !== label) this.busyEl.textContent = label;
    this.busyEl.classList.add('is-on');
  }
  placeCursor(x, y) {
    if (!this.cursorEl) return;
    this.cursorEl.style.left = `${x + 18}px`;
    this.cursorEl.style.top = `${y + 16}px`;
  }

  setCursorValue(text) {
    if (!this.cursorEl) return;
    const label = typeof text === 'string' ? text : '';
    if (this.cursorEl.textContent !== label) this.cursorEl.textContent = label;
    this.cursorEl.classList.toggle('is-on', Boolean(label));
  }

  setReadout(text) {
    const node = this.root && this.root.querySelector('.editor-panel__readout');
    if (node) node.textContent = text;
  }

  setPaused(on) {
    this.paused = Boolean(on);
    if (!this.root) return;
    const btn = this.root.querySelector('.editor-panel__pause');
    if (!btn) return;
    btn.textContent = this.paused ? 'Pokračovat' : 'Pauza';
    btn.classList.toggle('is-active', this.paused);
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
    this.state.brush = key;
    this.refresh();
  }

  setErasing(on) {
    this.state.erasing = Boolean(on);
    this.refresh();
  }

  setMode(mode) {
    this.state.mode = mode === 'height' || mode === 'area' ? mode : 'zone';
    this.state.erasing = false;
    if (this.root) this.root.dataset.mode = this.state.mode;
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
      btn.classList.toggle('is-active', btn.dataset.mode === this.state.mode);
    }
    for (const btn of this.root.querySelectorAll('[data-brush]')) {
      btn.classList.toggle('is-active', !this.state.erasing && btn.dataset.brush === this.state.brush);
    }
  }

  show() {
    this.mount();
    this.root.classList.add('is-open');
    this.root.dataset.mode = this.state.mode;
    this.setWater(this.waterLevel, this.waterShown);
    if (this.onBrush && this.state.brush) this.onBrush(this.state.brush);
    this.refresh();
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }
}
