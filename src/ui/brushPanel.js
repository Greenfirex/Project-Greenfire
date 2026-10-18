// Malý panel pro rozpracovanou zónu — název brushu, styl, paleta dílků a potvrzení.
// Otevírá se klikem na brush v paletě, sám nic negeneruje ani nemění.
import { getBrush } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { makeDraggable } from './draggable.js';

const STYLE_LABELS = { dirt: 'Hlína', stone: 'Kámen', wood: 'Dřevo' };

export default class BrushPanel {

  constructor() {
    this.root = null;
    this.title = null;
    this.count = null;
    this.styles = null;
    this.modes = null;
    this.palette = null;
    this.onApply = null;
    this.onCancel = null;
    this.onStyle = null;
    this.onTile = null;
    this.onThumbnail = null;
    this.onManualMode = null;
    this.brushKey = null;
    this.tileKey = null;
    this.pathStyle = 'dirt';
    this.manualMode = false;
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
      <div class="brush-panel__modes is-hidden">
        <button type="button" data-mode="auto" title="Automatické kreslení tahu">Automaticky</button>
        <button type="button" data-mode="manual" title="Ruční kladení dílků">Ručně</button>
      </div>
      <div class="brush-panel__palette is-hidden"></div>
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
    this.modes = root.querySelector('.brush-panel__modes');
    this.palette = root.querySelector('.brush-panel__palette');

    for (const btn of this.modes.querySelectorAll('[data-mode]')) {
      btn.addEventListener('click', () => {
        if (this.onManualMode) this.onManualMode(btn.dataset.mode === 'manual');
      });
    }

    root.querySelector('.brush-panel__apply').addEventListener('click', () => {
      if (this.onApply) this.onApply();
    });
    const cancel = () => {
      if (this.onCancel) this.onCancel();
    };
    root.querySelector('.brush-panel__cancel').addEventListener('click', cancel);
    root.querySelector('.brush-panel__close').addEventListener('click', cancel);

    return root;
  }

  open(brushKey, cellCount = 0, styleKey = 'dirt', tileKey = null, manualMode = false) {
    this.mount();
    const brush = getBrush(brushKey);
    this.brushKey = brushKey;
    this.pathStyle = styleKey || 'dirt';
    this.tileKey = tileKey;
    this.manualMode = Boolean(manualMode);
    this.title.textContent = brush ? brush.label : brushKey;
    this.buildStyles(brush);
    this.buildModes(brush);
    this.buildPalette(brush);
    this.setCount(cellCount);
    this.setManualMode(this.manualMode);
    this.root.classList.add('is-open');
  }

  buildModes(brush) {
    const visible = Boolean(brush && brush.poolByStyle);
    this.modes.classList.toggle('is-hidden', !visible);
  }

  setManualMode(on) {
    this.manualMode = Boolean(on);
    if (!this.root) return;
    this.root.classList.toggle('is-manual', this.manualMode);
    for (const btn of this.modes.querySelectorAll('[data-mode]')) {
      const active = (btn.dataset.mode === 'manual') === this.manualMode;
      btn.classList.toggle('is-active', active);
    }
    this.buildPalette(getBrush(this.brushKey));
  }

  styleList(brush) {
    if (!brush) return [];
    if (brush.styles) return brush.styles;
    if (brush.poolByStyle) return Object.keys(brush.poolByStyle);
    return [];
  }

  buildStyles(brush) {
    const list = this.styleList(brush);
    this.styles.classList.toggle('is-hidden', !list.length);
    this.styles.innerHTML = '';
    for (const key of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.style = key;
      btn.textContent = STYLE_LABELS[key] || key;
      btn.classList.toggle('is-active', key === this.pathStyle);
      btn.addEventListener('click', () => {
        if (this.onStyle) this.onStyle(this.brushKey, key);
      });
      this.styles.appendChild(btn);
    }
  }

  buildPalette(brush) {
    const list = this.tileList(brush);
    if (!this.palette) return;
    this.palette.classList.toggle('is-hidden', !list.length);
    this.palette.innerHTML = '';
    this.palette.dataset.pool = list.join(',');
    for (const key of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tile = key;
      btn.title = getDecoration(key)?.displayName || key;
      btn.classList.toggle('is-active', key === this.tileKey);
      const img = document.createElement('img');
      img.alt = btn.title;
      img.draggable = false;
      img.dataset.state = 'idle';
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        this.tileKey = key;
        this.setTile(key);
        if (this.onTile) this.onTile(key);
      });
      this.palette.appendChild(btn);
      if (this.onThumbnail) this.onThumbnail(key, img);
    }
  }

  tileList(brush) {
    if (!brush || !this.manualMode) return [];
    if (brush.poolByStyle) return brush.poolByStyle[this.pathStyle] || [];
    return brush.pool || [];
  }

  setStyle(styleKey, tileKey = null) {
    const brush = getBrush(this.brushKey);
    this.pathStyle = styleKey;
    this.tileKey = tileKey;
    this.buildStyles(brush);
    this.buildPalette(brush);
  }

  setTile(tileKey) {
    this.tileKey = tileKey;
    if (!this.palette) return;
    for (const btn of this.palette.querySelectorAll('[data-tile]')) {
      btn.classList.toggle('is-active', btn.dataset.tile === tileKey);
    }
  }

  setCount(count) {
    if (!this.root) return;
    const n = count || 0;
    this.count.textContent = `Vybráno: ${n} ${n === 1 ? 'buňka' : n < 5 ? 'buňky' : 'buněk'}`;
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
