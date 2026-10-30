// Malý panel pro rozpracovanou zónu — název štětce, styl a potvrzení.
// Otevírá se klikem na štětec v paletě, sám nic negeneruje ani nemění.
import { getBrush } from '../data/catalogs/brushes.js';
import { makeDraggable } from '../ui/draggable.js';

const STYLE_LABELS = { dirt: 'Hlína', stone: 'Kámen', wood: 'Dřevo', iron: 'Železo', copper: 'Měď' };

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
    this.options = null;
    this.onOption = null;
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

  open(brushKey, cellCount = 0, styleKey = 'dirt', optionValues = null) {
    this.mount();
    const brush = getBrush(brushKey);
    this.brushKey = brushKey;
    this.pathStyle = styleKey || 'dirt';
    this.title.textContent = brush ? brush.label : brushKey;
    this.buildStyles(brush);
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
    const list = brush
      ? (Array.isArray(brush.options) ? brush.options : (brush.option ? [brush.option] : []))
      : [];
    for (const option of list) {
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
    const word = n === 1 ? 'buňka' : n < 5 ? 'buňky' : 'buněk';
    const brush = getBrush(this.brushKey);
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
