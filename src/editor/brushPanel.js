// Malý panel pro rozpracovanou zónu — název štětce, styl a potvrzení.
// Otevírá se klikem na štětec v paletě, sám nic negeneruje ani nemění.
import { brushOptions, getBrush } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { makeDraggable } from '../ui/draggable.js';

const STYLE_LABELS = { dirt: 'Hlína', stone: 'Kámen', wood: 'Dřevo', iron: 'Železo', copper: 'Měď' };

function speciesSwatch(key, def) {
  if (def && def.swatch) return def.swatch;
  if (!key) return null;
  if (key.includes('black')) return '#252724';
  if (key.includes('dark')) return '#555750';
  if (key.includes('rockfall') || key.startsWith('rock_')) return '#aaa69a';
  if (key.includes('driftwood')) return '#b8aa91';
  if (key.includes('log') || key.includes('branch')) return '#75543a';
  return null;
}

export default class BrushPanel {

  constructor() {
    this.root = null;
    this.title = null;
    this.count = null;
    this.styles = null;
    this.onApply = null;
    this.onCancel = null;
    this.onStyle = null;
    this.onErase = null;
    this.onUndo = null;
    this.brushKey = null;
    this.pathStyle = 'dirt';
    this.draftMode = 'add';
    this.countValue = 0;
    this.slopeCount = 0;
    this.rimCount = 0;
    this.species = null;
    this.options = null;
    this.onOption = null;
    this.onSpecies = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'brush-panel';
    root.innerHTML = `
      <div class="brush-panel__head">
        <span class="brush-panel__title">–</span>
        <button type="button" class="brush-panel__close" title="Zrušit (Esc)">×</button>
      </div>
      <div class="brush-panel__styles is-hidden"></div>
      <div class="brush-panel__species is-hidden"></div>
      <div class="brush-panel__options"></div>
      <div class="brush-panel__tools">
        <button type="button" class="brush-panel__erase" title="Mazat (X)">Mazat</button>
        <button type="button" class="brush-panel__undo" title="Vrátit poslední úpravu (Z)">Zpět</button>
      </div>
      <div class="brush-panel__count">Vybráno: 0 buněk</div>
      <div class="brush-panel__actions">
        <button type="button" class="brush-panel__apply" title="Aplikovat zónu (Enter)">Aplikovat</button>
        <button type="button" class="brush-panel__cancel" title="Zrušit (Esc)">Zrušit</button>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);
    this.title = root.querySelector('.brush-panel__title');
    this.count = root.querySelector('.brush-panel__count');
    this.styles = root.querySelector('.brush-panel__styles');
    this.species = root.querySelector('.brush-panel__species');
    this.options = root.querySelector('.brush-panel__options');

    root.querySelector('.brush-panel__apply').addEventListener('click', () => {
      if (this.onApply) this.onApply();
    });
    root.querySelector('.brush-panel__erase').addEventListener('click', () => {
      if (this.onErase) this.onErase();
    });
    root.querySelector('.brush-panel__undo').addEventListener('click', () => {
      if (this.onUndo) this.onUndo();
    });
    const cancel = () => {
      if (this.onCancel) this.onCancel();
    };
    root.querySelector('.brush-panel__cancel').addEventListener('click', cancel);
    root.querySelector('.brush-panel__close').addEventListener('click', cancel);

    return root;
  }

  open(brushKey, cellCount = 0, styleKey = 'dirt', optionValues = null, speciesKey = null) {
    this.mount();
    const brush = getBrush(brushKey);
    this.brushKey = brushKey;
    this.pathStyle = styleKey || 'dirt';
    this.title.textContent = brush ? brush.label : brushKey;
    this.buildStyles(brush);
    this.buildSpecies(brush, speciesKey);
    this.buildOptions(brush, optionValues);
    const heightOnly = Boolean(brush && (Number.isFinite(brush.height) || brush.heights));
    const surfaceOnly = Boolean(brush && brush.surfaceOnly);
    const surfaceBrush = Boolean(brush && brush.surface);
    const cliffBrush = Boolean(brush && brush.cliff);
    const erase = this.root.querySelector('.brush-panel__erase');
    if (erase) {
      erase.textContent = cliffBrush ? 'Zrušit útesy' : surfaceBrush ? 'Zpět na trávu' : heightOnly ? 'Srovnat' : surfaceOnly ? 'Na trávu' : 'Mazat';
      erase.title = cliffBrush
        ? 'Zrušit označení útesu (X)'
        : surfaceBrush
          ? 'Vrátit trávu a srovnat na 0 (X)'
          : heightOnly ? 'Srovnat na 0 (X)' : surfaceOnly ? 'Vrátit na trávu (X)' : 'Mazat (X)';
    }
    this.setCount(cellCount);
    this.root.classList.add('is-open');
  }

  buildOptions(brush, values) {
    if (!this.options) return;
    this.options.innerHTML = '';
    this.optionValues = { ...(values || {}) };
    const list = brushOptions(brush);
    for (const option of list) {
      if (option.kind === 'range') {
        this.options.appendChild(this.conditionalRow(option, this.buildRangeOption(option, values)));
        continue;
      }
      if (option.kind === 'choice') {
        this.options.appendChild(this.buildChoiceOption(option, values));
        continue;
      }
      const label = document.createElement('label');
      label.className = 'brush-panel__option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(values && values[option.key]);
      input.addEventListener('change', () => {
        if (this.onOption) this.onOption(option.key, input.checked);
      });
      const text = document.createElement('span');
      text.className = 'brush-panel__option-label';
      text.textContent = option.label;
      label.append(input, text);
      this.options.appendChild(label);
    }
    this.refreshConditionalRows();
  }

  conditionalRow(option, row) {
    if (!option.showWhen) return row;
    row.dataset.showKey = option.showWhen.key;
    row.dataset.showValue = option.showWhen.value;
    return row;
  }

  refreshConditionalRows() {
    if (!this.options) return;
    for (const row of this.options.querySelectorAll('[data-show-key]')) {
      row.classList.toggle('is-hidden', this.optionValues[row.dataset.showKey] !== row.dataset.showValue);
    }
  }

  buildRangeOption(option, values) {
    const row = document.createElement('div');
    row.className = 'brush-panel__option brush-panel__option--range';
    const text = document.createElement('span');
    text.className = 'brush-panel__option-label';
    text.textContent = option.label;
    const min = Number.isFinite(option.min) ? option.min : 1;
    const max = Number.isFinite(option.max) ? option.max : min + 4;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(Number.isFinite(option.step) ? option.step : 1);
    const stored = values && values[option.key] !== undefined ? Number(values[option.key]) : Number(option.default);
    input.value = String(Math.min(max, Math.max(min, Number.isFinite(stored) ? stored : min)));
    const value = document.createElement('span');
    value.className = 'brush-panel__option-value';
    const showValue = (raw) => {
      const text = option.display === 'square'
        ? `${raw * 2 + 1}×${raw * 2 + 1}`
        : option.display === 'angle' ? `${raw * 45}°`
          : option.display === 'meters' ? `${String(raw).replace('.', ',')} m` : String(raw);
      value.textContent = text;
    };
    showValue(Number(input.value));
    input.addEventListener('input', () => {
      showValue(Number(input.value));
      if (this.onOption) this.onOption(option.key, Number(input.value));
    });
    row.append(text, input, value);
    return row;
  }

  buildChoiceOption(option, values) {
    const row = document.createElement('div');
    row.className = 'brush-panel__option brush-panel__option--choice';
    const text = document.createElement('span');
    text.className = 'brush-panel__option-label';
    text.textContent = option.label;
    const group = document.createElement('div');
    group.className = 'brush-panel__choice';
    const stored = values && values[option.key] !== undefined ? values[option.key] : option.default;
    for (const choice of option.values || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.choice = choice.value;
      btn.textContent = choice.label;
      btn.classList.toggle('is-active', choice.value === stored);
      btn.addEventListener('click', () => {
        for (const other of group.querySelectorAll('button')) other.classList.toggle('is-active', other === btn);
        this.optionValues[option.key] = choice.value;
        this.refreshConditionalRows();
        if (this.onOption) this.onOption(option.key, choice.value);
      });
      group.appendChild(btn);
    }
    row.append(text, group);
    return row;
  }

  buildSpecies(brush, speciesKey = null) {
    const pool = brush && brush.deco && Array.isArray(brush.pool) ? brush.pool : [];
    if (!this.species) return;
    this.species.classList.toggle('is-hidden', pool.length < 2);
    this.species.innerHTML = '';
    for (const key of pool) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.species = key;
      const def = getDecoration(key);
      const label = def && def.displayName ? def.displayName : key;
      btn.title = label;
      const swatch = speciesSwatch(key, def);
      if (swatch) {
        const dot = document.createElement('span');
        dot.className = 'brush-panel__swatch';
        dot.style.background = swatch;
        btn.appendChild(dot);
      }
      const text = document.createElement('span');
      text.textContent = label;
      btn.appendChild(text);
      btn.classList.toggle('is-active', key === speciesKey);
      btn.addEventListener('click', () => {
        if (this.onSpecies) this.onSpecies(key);
      });
      this.species.appendChild(btn);
    }
  }

  setSpecies(key) {
    if (!this.species) return;
    for (const btn of this.species.querySelectorAll('[data-species]')) {
      btn.classList.toggle('is-active', btn.dataset.species === key);
    }
  }

  setOptions(values) {
    if (!this.root) return;
    this.buildOptions(getBrush(this.brushKey), values);
  }

  setDraftMode(mode) {
    this.draftMode = mode === 'remove' ? 'remove' : 'add';
    this.setErasing(this.draftMode === 'remove');
    this.refreshCount();
  }

  setUndoEnabled(on) {
    const undo = this.root && this.root.querySelector('.brush-panel__undo');
    if (undo) undo.disabled = !on;
  }

  setErasing(on) {
    if (!this.root) return;
    this.root.classList.toggle('is-erasing', Boolean(on));
    const erase = this.root.querySelector('.brush-panel__erase');
    if (erase) erase.classList.toggle('is-active', Boolean(on));
  }

  styleList(brush) {
    if (!brush) return [];
    const list = brush.styles || (brush.poolByStyle ? Object.keys(brush.poolByStyle) : []);
    if (brush.creature) return list;
    return list.length > 1 ? list : [];
  }

  buildStyles(brush) {
    const list = this.styleList(brush);
    this.styles.classList.toggle('is-hidden', !list.length);
    this.styles.innerHTML = '';
    for (const key of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.style = key;
      const label = (brush.styleLabels && brush.styleLabels[key]) || STYLE_LABELS[key] || key;
      btn.title = label;
      const file = brush.texture && brush.texture[key];
      if (file) {
        const img = document.createElement('img');
        img.src = file;
        img.alt = label;
        img.draggable = false;
        btn.appendChild(img);
      } else {
        btn.textContent = label;
      }
      btn.classList.toggle('is-active', key === this.pathStyle);
      btn.addEventListener('click', () => {
        if (this.onStyle) this.onStyle(this.brushKey, key);
      });
      this.styles.appendChild(btn);
    }
  }

  setStyle(styleKey) {
    this.pathStyle = styleKey;
    this.buildStyles(getBrush(this.brushKey));
  }

  setCount(count, slopeCount = 0, rimCount = 0) {
    this.countValue = count || 0;
    this.slopeCount = slopeCount || 0;
    this.rimCount = rimCount || 0;
    this.refreshCount();
  }

  refreshCount() {
    if (!this.root || !this.count) return;
    const n = this.countValue || 0;
    const brush = getBrush(this.brushKey);
    const creatureBrush = Boolean(brush && brush.creature);
    const word = creatureBrush
      ? (n === 1 ? 'tvor' : n < 5 ? 'tvoři' : 'tvorů')
      : (n === 1 ? 'buňka' : n < 5 ? 'buňky' : 'buněk');
    const heightOnly = Boolean(brush && (Number.isFinite(brush.height) || brush.heights));
    const surfaceOnly = Boolean(brush && brush.surfaceOnly);
    const surfaceBrush = Boolean(brush && brush.surface);
    const cliffBrush = Boolean(brush && brush.cliff);
    const prefix = this.draftMode === 'remove'
      ? (cliffBrush ? 'Zruší se' : surfaceBrush ? 'Vrátí se' : heightOnly ? 'Srovná se' : surfaceOnly ? 'Na trávu' : 'Ke smazání')
      : 'Vybráno';
    let text = `${prefix}: ${n} ${word}`;
    if (this.slopeCount > 0) text += ` · svah ${this.slopeCount}`;
    if (this.rimCount > 0) text += ` · okraj ${this.rimCount}`;
    this.count.textContent = text;
    const apply = this.root.querySelector('.brush-panel__apply');
    if (apply) apply.disabled = n === 0;
  }

  close() {
    this.brushKey = null;
    if (this.root) this.root.classList.remove('is-open');
  }

  get isOpen() {
    return Boolean(this.root && this.root.classList.contains('is-open'));
  }
}
