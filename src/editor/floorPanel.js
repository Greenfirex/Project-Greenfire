// Plovoucí okénko režimu Patra — seznam pater, kopání a zasypávání, výška podlahy a varování.
// Otevírá se při přepnutí na Patra, samo nic negeneruje ani nemění.
import { surfaceEntries } from '../data/catalogs/decorations.js';
import { formatMeters } from '../data/maps/layoutStore.js';
import { makeDraggable } from '../ui/draggable.js';
import { MIN_CLEARANCE } from './editorFloors.js';
import { countWord, cellWord, MARK_COLORS } from './editorSettings.js';

export function floorName(level, name = null) {
  if (name) return name;
  return level === 0 ? 'Povrch' : `Jeskyně ${String(level).replace('-', '−')}`;
}

function edgeWord(n) {
  return countWord(n, 'hrana', 'hrany', 'hran');
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
    this.onRename = null;
    this.onDelete = null;
    this.onCaveTarget = null;
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
      <label class="floor-panel__target" title="Do kterého patra se zapíše nová jeskyně začatá z útesu">Kopat do <select></select></label>
      <div class="floor-panel__dig">
        <div class="area-panel__tools">
          <button type="button" data-tool="paint">Vykopat</button>
          <button type="button" data-tool="erase">Zasypat</button>
          <button type="button" data-tool="corridor">Chodba</button>
          <button type="button" data-tool="name" title="Klikni na jeskyni a dej jí jméno">Pojmenovat</button>
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
    root.querySelector('.floor-panel__target select').addEventListener('change', (event) => {
      const value = event.target.value;
      if (this.onCaveTarget) this.onCaveTarget(value === 'auto' || value === 'new' ? value : Number(value));
    });
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
    this.renderTarget(view.floors, view.caveTarget, !underground);
    const erasing = view.tool === 'erase';
    root.classList.toggle('is-erasing', erasing);
    root.classList.toggle('is-naming', view.tool === 'name' && underground);
    for (const btn of root.querySelectorAll('[data-tool]')) btn.classList.toggle('is-active', btn.dataset.tool === view.tool);
    for (const btn of this.surfaceRow.querySelectorAll('[data-surface]')) btn.classList.toggle('is-active', btn.dataset.surface === view.surface);
    root.querySelector('.floor-panel__height').textContent = `podlaha ${formatMeters(view.height)}`;
    root.querySelector('.floor-panel__clearance').textContent = `světlá výška ${formatMeters(view.clearance)}`;
    root.querySelector('.area-panel__count').textContent = `${erasing ? 'Zasype se' : 'Vykope se'}: ${view.count} ${cellWord(view.count)}`;
    root.querySelector('.area-panel__apply').disabled = view.count === 0;
    root.querySelector('.area-panel__clear').disabled = view.count === 0;
    root.querySelector('.area-panel__undo').disabled = !view.undoEnabled;
    root.querySelector('.area-panel__note').textContent = view.tool === 'name' && underground
      ? 'Klikni na vykopanou jeskyni a napiš jméno. Platí pro celou souvislou jeskyni v tomhle patře a ukáže se hráči na mapě i v oznámení Objeveno. Prázdné jméno ho smaže (pak se použije jméno patra).'
      : view.tool === 'corridor' && underground
      ? 'Táhni od začátku ke konci chodby, pak Aplikovat. Chodba naváže na podlahu, u které začíná, a plynule klesne k nastavené výšce podlahy. Průchod do jiného patra vznikne sám, když se podlahy potkají do 0,6 m.'
      : underground
      ? 'Táhni myší — označí se obdélník a každé další tažení k výběru přidává. Pravým tlačítkem buňku z výběru odebereš, Esc zahodí vše. Pak Aplikovat. Průchod ven vznikne sám tam, kde podlaha navazuje na zem vedle (rozdíl do 0,6 m).'
      : 'Novou jeskyni začneš kliknutím na stěnu útesu: zelená značka ukáže vchod, pak táhni výběr do skály. Povrch se upravuje v ostatních záložkách.';
    this.renderWarnings(underground ? view.report : null, underground ? view.edgeCounts : null);
  }

  renderList(floors, selected) {
    const list = this.root.querySelector('.floor-panel__list');
    list.textContent = '';
    for (const floor of floors) {
      const row = document.createElement('div');
      row.className = 'floor-panel__row';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'floor-panel__pick';
      btn.classList.toggle('is-active', floor.level === selected);
      const range = floor.level !== 0 && floor.count ? ` · ${formatMeters(floor.bottom)} až ${formatMeters(floor.top)}` : '';
      const empty = floor.level !== 0 && !floor.count ? ' · prázdné' : '';
      btn.textContent = `${floorName(floor.level, floor.name)}${range}${empty}`;
      btn.addEventListener('click', () => this.onSelect && this.onSelect(floor.level));
      row.appendChild(btn);
      if (floor.level !== 0) {
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'floor-panel__rename';
        rename.textContent = '✎';
        rename.title = 'Přejmenovat patro';
        rename.addEventListener('click', () => this.onRename && this.onRename(floor));
        row.appendChild(rename);
      }
      if (floor.empty) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'floor-panel__rename';
        remove.textContent = '×';
        remove.title = 'Smazat prázdné patro';
        remove.addEventListener('click', () => this.onDelete && this.onDelete(floor));
        row.appendChild(remove);
      }
      list.appendChild(row);
    }
  }

  renderTarget(floors, target, visible) {
    const label = this.root.querySelector('.floor-panel__target');
    label.style.display = visible ? '' : 'none';
    if (!visible) return;
    const select = label.querySelector('select');
    const choices = [
      ['auto', 'Automaticky'],
      ...floors.filter((floor) => floor.level < 0).map((floor) => [String(floor.level), floorName(floor.level, floor.name)]),
      ['new', 'Nové patro'],
    ];
    const signature = JSON.stringify(choices);
    if (select.dataset.choices !== signature) {
      select.dataset.choices = signature;
      select.textContent = '';
      for (const [value, text] of choices) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      }
    }
    const wanted = String(target);
    select.value = choices.some(([value]) => value === wanted) ? wanted : 'auto';
  }

  renderWarnings(report, edges) {
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
    if (edges && edges.door) addLine(`Výběr: vznikne vchod (${edges.door} ${edgeWord(edges.door)})`, MARK_COLORS.door);
    if (edges && edges.thin) addLine(`Výběr: prokopnutí ven (${edges.thin} ${edgeWord(edges.thin)})`, MARK_COLORS.thin);
    if (edges && edges.pierced) addLine(`Výběr: strop prorazí povrch (${edges.pierced} ${cellWord(edges.pierced)})`, MARK_COLORS.problem);
    if (report.doors.length) addLine(`Vchod: ${report.doors.length} ${cellWord(report.doors.length)}`, MARK_COLORS.door);
    if (report.low.length) addLine(`Nízký strop (pod ${formatMeters(MIN_CLEARANCE)}): ${report.low.length} ${cellWord(report.low.length)}`, MARK_COLORS.problem);
    if (report.steep.length) addLine(`Příliš strmá chodba: ${report.steep.length} ${cellWord(report.steep.length)}`, MARK_COLORS.problem);
    if (report.pierced.length) addLine(`Strop prorazil povrch: ${report.pierced.length} ${cellWord(report.pierced.length)}`, MARK_COLORS.problem);
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
