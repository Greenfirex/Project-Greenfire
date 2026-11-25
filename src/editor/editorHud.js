// DOM panel editačního režimu — záložky, štětce vybrané záložky, přepínač patra, voda a uložení.
// Napojený přes callbacky na scene, sám nic generuje ani nemění; rozložení záložek je v hudTabs.js.
import { BRUSHES, getBrush, brushAboveGroundOnly } from '../data/catalogs/brushes.js';
import { HEIGHT_STEP, formatMeters } from '../data/maps/layoutStore.js';
import { makeDraggable } from '../ui/draggable.js';
import { floorName } from './floorPanel.js';
import { HUD_TABS, COMMON_BRUSHES, hudTab, tabForMode, looseBrushes } from './hudTabs.js';
import { BUILDING_VIEWS } from './editorSettings.js';

const COMMON_HINT = `WASD pohled · Shift+1–${HUD_TABS.length} záložky · B pohled do staveb · Z zpět · N posunout čas · Ctrl+S uložit`;
const MODE_HINTS = {
  zone: 'Vyber štětec a táhni · X mazání',
  height: 'Táhni po buňkách · Q a E krok výšky · 1–9 předvolby · Enter použít · Esc zahodit',
  area: 'Táhni obdélník · Enter použít · Esc zahodit',
  floors: 'Na povrchu klikni na útes · v patře táhni výběr · Enter vykopat',
};

const SEA_MARKUP = `
  <div class="editor-panel__water">
    <div class="editor-panel__water-top">
      <span class="editor-panel__water-label">Hladina moře</span>
      <button type="button" class="editor-panel__water-toggle" title="Zapnout nebo vypnout vodu pro celou mapu">Vypnuto</button>
    </div>
    <div class="editor-panel__water-level">
      <button type="button" data-water-step="-1" title="Snížit hladinu o ${formatMeters(HEIGHT_STEP)}">−</button>
      <span class="editor-panel__water-value">–</span>
      <button type="button" data-water-step="1" title="Zvýšit hladinu o ${formatMeters(HEIGHT_STEP)}">+</button>
    </div>
  </div>
`;

export default class EditorHud {

  constructor() {
    this.root = null;
    this.onBrush = null;
    this.onClose = null;
    this.onMode = null;
    this.onTab = null;
    this.onFloor = null;
    this.onBuildingView = null;
    this.onSaveMap = null;
    this.onPause = null;
    this.onWaterToggle = null;
    this.onWaterStep = null;
    this.state = { mode: 'zone', tab: HUD_TABS[0].key, brush: null, erasing: false, underground: false };
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
      <div class="editor-panel__tabs"></div>
      <div class="editor-panel__hint"></div>
      <div class="editor-panel__floor">
        <span class="editor-panel__floor-label">Patro</span>
        <div class="editor-panel__floor-list"></div>
      </div>
      <div class="editor-panel__building">
        <span class="editor-panel__floor-label">Stavby</span>
        <div class="editor-panel__floor-list editor-panel__building-list"></div>
      </div>
      <div class="editor-panel__grid"></div>
      <div class="editor-panel__note">–</div>
      <div class="editor-panel__common"></div>
      <div class="editor-panel__readout">–</div>
      <div class="editor-panel__save-row">
        <button type="button" class="editor-panel__save editor-panel__pause" title="Pozastavit nebo pustit hru (P)">Pauza</button>
        <button type="button" class="editor-panel__save editor-panel__save-map" title="Uložit mapu (zapíše se do souboru v projektu)">Uložit mapu</button>
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

    this.buildTabs(root.querySelector('.editor-panel__tabs'));
    const grid = root.querySelector('.editor-panel__grid');
    for (const tab of HUD_TABS) grid.appendChild(this.buildPane(tab));
    const common = root.querySelector('.editor-panel__common');
    for (const key of [...COMMON_BRUSHES, ...looseBrushes()]) {
      if (BRUSHES[key]) common.appendChild(this.brushButton(key));
    }

    root.querySelector('.editor-panel__floor-list').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-floor]');
      if (chip && this.onFloor) this.onFloor(Number(chip.dataset.floor));
    });
    const views = root.querySelector('.editor-panel__building-list');
    BUILDING_VIEWS.forEach((view, index) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.view = String(index);
      chip.textContent = view.label;
      chip.title = `${view.note} (B)`;
      chip.classList.toggle('is-active', view.storey === null);
      chip.addEventListener('click', () => {
        if (this.onBuildingView) this.onBuildingView(view.storey);
      });
      views.appendChild(chip);
    });
    root.querySelector('.editor-panel__save-map').addEventListener('click', () => {
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

  buildTabs(host) {
    const rows = [...new Set(HUD_TABS.map((tab) => tab.row))];
    for (const rowIndex of rows) {
      const row = document.createElement('div');
      row.className = 'editor-panel__tab-row';
      for (const tab of HUD_TABS.filter((item) => item.row === rowIndex)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.tab = tab.key;
        btn.textContent = tab.label;
        btn.title = `${tab.label} (Shift+${HUD_TABS.indexOf(tab) + 1})`;
        btn.addEventListener('click', () => {
          if (this.onTab) this.onTab(tab.key);
        });
        row.appendChild(btn);
      }
      if (rowIndex === rows[0]) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'editor-panel__close';
        close.title = 'Zavřít (F2)';
        close.textContent = '×';
        row.appendChild(close);
      }
      host.appendChild(row);
    }
  }

  buildPane(tab) {
    const pane = document.createElement('div');
    pane.className = 'editor-panel__pane';
    pane.dataset.pane = tab.key;
    for (const section of tab.sections) {
      const group = document.createElement('div');
      group.className = 'editor-panel__group';
      if (section.label) {
        const head = document.createElement('div');
        head.className = 'editor-panel__group-head';
        head.textContent = section.label;
        group.appendChild(head);
      }
      if (section.text) {
        const text = document.createElement('div');
        text.className = 'editor-panel__pane-text';
        text.textContent = section.text;
        group.appendChild(text);
      }
      if (section.sea) group.insertAdjacentHTML('beforeend', SEA_MARKUP);
      const buttons = [
        ...(section.tools || []).map((tool) => this.toolButton(tool)),
        ...(section.brushes || []).filter((key) => BRUSHES[key]).map((key) => this.brushButton(key)),
      ];
      if (buttons.length) {
        const row = document.createElement('div');
        row.className = 'editor-panel__group-grid';
        for (const btn of buttons) row.appendChild(btn);
        group.appendChild(row);
      }
      pane.appendChild(group);
    }
    return pane;
  }

  toolButton(tool) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.tool = tool.mode;
    btn.className = 'is-tool';
    btn.textContent = tool.label;
    btn.title = tool.note;
    btn.addEventListener('mouseenter', () => this.showText(tool.note));
    btn.addEventListener('mouseleave', () => this.showNote(this.state.brush));
    btn.addEventListener('click', () => {
      if (this.onMode) this.onMode(this.state.mode === tool.mode ? 'zone' : tool.mode);
    });
    return btn;
  }

  brushButton(key) {
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
      if (this.state.underground && brushAboveGroundOnly(key)) return;
      this.state.brush = key;
      this.refresh();
      this.showNote(key);
      if (this.onBrush) this.onBrush(key);
    });
    return btn;
  }

  setFloors(floors, selected) {
    const list = this.root && this.root.querySelector('.editor-panel__floor-list');
    if (!list) return;
    list.textContent = '';
    for (const floor of floors) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.floor = String(floor.level);
      chip.textContent = floorName(floor.level, floor.name);
      chip.classList.toggle('is-active', floor.level === selected);
      list.appendChild(chip);
    }
  }

  setBuildingView(storey) {
    if (!this.root) return;
    for (const chip of this.root.querySelectorAll('[data-view]')) {
      chip.classList.toggle('is-active', BUILDING_VIEWS[Number(chip.dataset.view)].storey === storey);
    }
    const view = BUILDING_VIEWS.find((item) => item.storey === storey);
    if (view) this.setReadout(`Stavby: ${view.label} — ${view.note}`);
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
      else value.textContent = this.waterShown ? formatMeters(this.waterLevel) : 'skrytá';
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
    this.state.mode = mode === 'height' || mode === 'area' || mode === 'floors' ? mode : 'zone';
    this.state.tab = tabForMode(this.state.mode, this.state.tab);
    this.state.erasing = false;
    if (this.root) this.root.dataset.mode = this.state.mode;
    this.refresh();
  }

  setTab(key) {
    if (!hudTab(key)) return;
    this.state.tab = key;
    this.refresh();
  }

  get tab() {
    return this.state.tab;
  }

  showNote(key) {
    const brush = key ? getBrush(key) : null;
    const locked = this.state.underground && brushAboveGroundOnly(key);
    this.showText(brush && brush.note ? `${locked ? 'Funguje jen na povrchu. ' : ''}${brush.note}` : '');
  }

  showText(note) {
    const node = this.root && this.root.querySelector('.editor-panel__note');
    if (!node) return;
    node.textContent = note || '–';
    node.classList.toggle('is-empty', !note);
  }

  refresh() {
    if (!this.root) return;
    this.root.querySelector('.editor-panel__hint').textContent = `${MODE_HINTS[this.state.mode]} · ${COMMON_HINT}`;
    for (const btn of this.root.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('is-active', btn.dataset.tab === this.state.tab);
    }
    for (const pane of this.root.querySelectorAll('[data-pane]')) {
      pane.classList.toggle('is-current', pane.dataset.pane === this.state.tab);
    }
    for (const btn of this.root.querySelectorAll('[data-tool]')) {
      btn.classList.toggle('is-active', btn.dataset.tool === this.state.mode);
    }
    const brushes = this.state.mode === 'zone';
    for (const btn of this.root.querySelectorAll('[data-brush]')) {
      btn.classList.toggle('is-active', brushes && !this.state.erasing && btn.dataset.brush === this.state.brush);
      btn.classList.toggle('is-locked', Boolean(this.state.underground) && brushAboveGroundOnly(btn.dataset.brush));
    }
  }

  setUnderground(on) {
    this.state.underground = Boolean(on);
    this.refresh();
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
