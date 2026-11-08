// Plovoucí okénko režimu Patra — seznam pater, kopání a zasypávání, výška podlahy a varování.
// Otevírá se při přepnutí na Patra, samo nic negeneruje ani nemění.
import { surfaceEntries } from '../data/catalogs/decorations.js';
import { formatMeters } from '../data/maps/layoutStore.js';
import { makeDraggable } from '../ui/draggable.js';
import { FLOOR_MARKS } from './editorFloors.js';

function floorName(level) {
  return level === 0 ? 'Povrch' : `Jeskyně ${String(level).replace('-', '−')}`;
}

function cellWord(n) {
  if (n === 1) return 'buňka';
  return n < 5 && n > 0 ? 'buňky' : 'buněk';
}

export default class FloorPanel {

  constructor() {
    this.root = null;
    this.onSelect = null;
    this.onAdd = null;
    this.onTool = null;
    this.onSurface = null;
    this.onHeightStep = null;
    this.onClearanceStep = null;
    this.onApply = null;
    this.onClear = null;
    this.onUndo = null;
    this.onRaise = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'area-panel floor-panel';
    root.innerHTML = `
      <div class="area-panel__head">
        <span class="area-panel__title">Patra</span>
        <button type="button" class="area-panel__close" title="Zavřít okénko">×</button>
      </div>
      <div class="floor-panel__list"></div>
      <div class="area-panel__tools"><button type="button" class="floor-panel__add">Nové patro</button></div>
      <div class="floor-panel__dig">
        <div class="area-panel__tools">
          <button type="button" data-tool="paint">Vykopat</button>
          <button type="button" data-tool="erase">Zasypat</button>
        </div>
        <div class="area-panel__surfaces"></div>
        <div class="area-panel__height">
          <button type="button" data-floor-step="-1" title="Snížit podlahu (Q)">−</button>
          <span class="floor-panel__height">podlaha 0 m</span>
          <button type="button" data-floor-step="1" title="Zvýšit podlahu (E)">+</button>
        </div>
        <div class="area-panel__height">
          <button type="button" data-clear-step="-1" title="Snížit strop">−</button>
          <span class="floor-panel__clearance">světlá výška 3 m</span>
          <button type="button" data-clear-step="1" title="Zvýšit strop">+</button>
        </div>
        <div class="area-panel__count">0 buněk</div>
        <div class="area-panel__tools area-panel__undo-row">
          <button type="button" class="area-panel__undo" title="Vrátit poslední úpravu (Z)">Zpět</button>
        </div>
        <div class="area-panel__actions">
          <button type="button" class="area-panel__apply" title="Potvrdit výběr (Enter)">Aplikovat</button>
          <button type="button" class="area-panel__clear" title="Zahodit výběr (Esc)">Zahodit</button>
        </div>
      </div>
      <div class="floor-panel__warnings"></div>
      <small class="area-panel__note"></small>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);
    this.surfaceRow = root.querySelector('.area-panel__surfaces');
    for (const entry of surfaceEntries()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.surface = entry.key;
      btn.title = entry.label;
      const img = document.createElement('img');
      img.src = entry.texture;
      img.alt = entry.label;
      img.draggable = false;
      const label = document.createElement('span');
      label.textContent = entry.label;
      btn.append(img, label);
      btn.addEventListener('click', () => this.onSurface && this.onSurface(entry.key));
      this.surfaceRow.appendChild(btn);
    }
    const on = (selector, handler) => root.querySelector(selector).addEventListener('click', handler);
    on('.floor-panel__add', () => this.onAdd && this.onAdd());
    on('.area-panel__apply', () => this.onApply && this.onApply());
    on('.area-panel__clear', () => this.onClear && this.onClear());
    on('.area-panel__undo', () => this.onUndo && this.onUndo());
    on('.area-panel__close', () => this.hide());
    for (const btn of root.querySelectorAll('[data-tool]')) {
      btn.addEventListener('click', () => this.onTool && this.onTool(btn.dataset.tool));
    }
    for (const btn of root.querySelectorAll('[data-floor-step]')) {
      btn.addEventListener('click', () => this.onHeightStep && this.onHeightStep(Number(btn.dataset.floorStep)));
    }
    for (const btn of root.querySelectorAll('[data-clear-step]')) {
      btn.addEventListener('click', () => this.onClearanceStep && this.onClearanceStep(Number(btn.dataset.clearStep)));
    }
    return root;
  }

  show(view) {
    this.mount();
    this.root.classList.add('is-open');
    this.update(view);
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }

  update(view) {
    if (!this.root || !view) return;
    const { root } = this;
    this.renderList(view.floors, view.level);
    const underground = view.level < 0;
    root.querySelector('.floor-panel__dig').style.display = underground ? '' : 'none';
    const erasing = view.tool === 'erase';
    root.classList.toggle('is-erasing', erasing);
    for (const btn of root.querySelectorAll('[data-tool]')) btn.classList.toggle('is-active', btn.dataset.tool === view.tool);
    for (const btn of this.surfaceRow.querySelectorAll('[data-surface]')) btn.classList.toggle('is-active', btn.dataset.surface === view.surface);
    root.querySelector('.floor-panel__height').textContent = `podlaha ${formatMeters(view.height)}`;
    root.querySelector('.floor-panel__clearance').textContent = `světlá výška ${formatMeters(view.clearance)}`;
    root.querySelector('.area-panel__count').textContent = `${erasing ? 'Zasype se' : 'Vykope se'}: ${view.count} ${cellWord(view.count)}`;
    root.querySelector('.area-panel__apply').disabled = view.count === 0;
    root.querySelector('.area-panel__clear').disabled = view.count === 0;
    root.querySelector('.area-panel__undo').disabled = !view.undoEnabled;
    root.querySelector('.area-panel__note').textContent = underground
      ? 'Táhni myší — označí se obdélník, pak Aplikovat. Tažením zevnitř označení změníš jeho velikost, tažením mimo začneš nové. Průchod ven vznikne sám tam, kde podlaha navazuje na zem vedle (rozdíl do 0,6 m).'
      : 'Povrch se upravuje v záložkách Zóny, Výška a Herní plocha. Tady vyber nebo založ podzemní patro.';
    this.renderWarnings(underground ? view.report : null);
  }

  renderList(floors, selected) {
    const list = this.root.querySelector('.floor-panel__list');
    list.textContent = '';
    for (const floor of floors) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.toggle('is-active', floor.level === selected);
      const range = floor.level !== 0 && floor.count ? ` · ${formatMeters(floor.bottom)} až ${formatMeters(floor.top)}` : '';
      const empty = floor.level !== 0 && !floor.count ? ' · prázdné' : '';
      btn.textContent = `${floorName(floor.level)}${range}${empty}`;
      btn.addEventListener('click', () => this.onSelect && this.onSelect(floor.level));
      list.appendChild(btn);
    }
  }

  renderWarnings(report) {
    const box = this.root.querySelector('.floor-panel__warnings');
    box.textContent = '';
    if (!report) return;
    const addLine = (text, mark) => {
      const line = document.createElement('div');
      line.className = 'floor-panel__line';
      if (mark) {
        const swatch = document.createElement('span');
        swatch.className = 'floor-panel__swatch';
        swatch.style.background = `rgb(${mark.map((value) => Math.round(value * 255)).join(',')})`;
        line.appendChild(swatch);
      }
      line.append(text);
      box.appendChild(line);
    };
    if (report.doors.length) addLine(`Vchod: ${report.doors.length} ${cellWord(report.doors.length)}`, FLOOR_MARKS.door);
    if (report.low.length) addLine(`Nízký strop (pod 2,6 m): ${report.low.length} ${cellWord(report.low.length)}`, FLOOR_MARKS.problem);
    if (report.pierced.length) addLine(`Strop prorazil povrch: ${report.pierced.length} ${cellWord(report.pierced.length)}`, FLOOR_MARKS.problem);
    if (report.sealed) addLine(report.sealed === 1 ? 'Jedna jeskyně nemá vchod' : `Jeskyní bez vchodu: ${report.sealed}`, null);
    if (report.low.length) {
      const raise = document.createElement('button');
      raise.type = 'button';
      raise.className = 'floor-panel__raise';
      raise.textContent = 'Zvednout nízký strop';
      raise.addEventListener('click', () => this.onRaise && this.onRaise());
      box.appendChild(raise);
    }
  }
}
