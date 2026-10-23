// Malý panel pro rozpracovanou zónu — název štětce, styl a potvrzení.
// Otevírá se klikem na štětec v paletě, sám nic negeneruje ani nemění.
import { getBrush } from '../data/catalogs/brushes.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
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

  open(brushKey, cellCount = 0, styleKey = 'dirt') {
    this.mount();
    const brush = getBrush(brushKey);
    this.brushKey = brushKey;
    this.pathStyle = styleKey || 'dirt';
    this.title.textContent = brush ? brush.label : brushKey;
    this.buildStyles(brush);
    this.setCount(cellCount);
    this.root.classList.add('is-open');
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
      btn.title = STYLE_LABELS[key] || key;
      const file = brush.texture && brush.texture[key];
      if (file) {
        const img = document.createElement('img');
        img.src = `${ASSET_DIRS.pathTextures}${file}`;
        img.alt = btn.title;
        img.draggable = false;
        btn.appendChild(img);
      } else {
        btn.textContent = btn.title;
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

  setCount(count) {
    this.countValue = count || 0;
    this.refreshCount();
  }

  refreshCount() {
    if (!this.root || !this.count) return;
    const n = this.countValue || 0;
    const word = n === 1 ? 'buňka' : n < 5 ? 'buňky' : 'buněk';
    const prefix = this.draftMode === 'remove' ? 'Ke smazání' : 'Vybráno';
    this.count.textContent = `${prefix}: ${n} ${word}`;
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
