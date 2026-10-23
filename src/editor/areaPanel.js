// Plovoucí okénko režimu Plocha — přepínač Ručně/Mazat, počítadlo, potvrzení a vrácení.
// Otevírá se při přepnutí na Plochu, sám nic negeneruje ani nemění.
import { makeDraggable } from '../ui/draggable.js';

export default class AreaPanel {

  constructor() {
    this.root = null;
    this.onTool = null;
    this.onApply = null;
    this.onClear = null;
    this.onUndo = null;
    this.tool = 'paint';
    this.count = 0;
    this.undoEnabled = false;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'area-panel';
    root.innerHTML = `
      <div class="area-panel__head">
        <span class="area-panel__title">Herní plocha</span>
        <button type="button" class="area-panel__close" title="Zavřít okénko">×</button>
      </div>
      <div class="area-panel__tools">
        <button type="button" data-tool="paint">Ručně</button>
        <button type="button" data-tool="erase">Mazat</button>
      </div>
      <div class="area-panel__count">Přidá se: 0 buněk</div>
      <div class="area-panel__tools area-panel__undo-row">
        <button type="button" class="area-panel__undo" title="Vrátit poslední úpravu (Z)">Zpět</button>
      </div>
      <div class="area-panel__actions">
        <button type="button" class="area-panel__apply" title="Potvrdit výběr (Enter)">Aplikovat</button>
        <button type="button" class="area-panel__clear" title="Zahodit výběr (Esc)">Zahodit</button>
      </div>
      <small class="area-panel__note">Táhni myší po mapě i mimo ni. Pak klikni Aplikovat. Z vrací celý krok.</small>
    `;
    document.body.appendChild(root);
    this.root = root;
    makeDraggable(root);

    for (const btn of root.querySelectorAll('[data-tool]')) {
      btn.addEventListener('click', () => {
        if (this.onTool) this.onTool(btn.dataset.tool);
      });
    }
    root.querySelector('.area-panel__apply').addEventListener('click', () => {
      if (this.onApply) this.onApply();
    });
    root.querySelector('.area-panel__clear').addEventListener('click', () => {
      if (this.onClear) this.onClear();
    });
    root.querySelector('.area-panel__undo').addEventListener('click', () => {
      if (this.onUndo) this.onUndo();
    });
    root.querySelector('.area-panel__close').addEventListener('click', () => this.hide());
    this.refresh();
    return root;
  }

  setTool(tool) {
    this.tool = tool === 'erase' ? 'erase' : 'paint';
    this.mount();
    this.refresh();
  }

  setCount(count) {
    this.count = count || 0;
    if (this.root) this.refresh();
  }

  setUndoEnabled(on) {
    this.undoEnabled = Boolean(on);
    if (this.root) this.refresh();
  }

  refresh() {
    if (!this.root) return;
    const erasing = this.tool === 'erase';
    this.root.classList.toggle('is-erasing', erasing);
    for (const btn of this.root.querySelectorAll('[data-tool]')) {
      btn.classList.toggle('is-active', btn.dataset.tool === this.tool);
    }
    const n = this.count;
    const word = n === 1 ? 'buňka' : n < 5 ? 'buňky' : 'buněk';
    const count = this.root.querySelector('.area-panel__count');
    if (count) count.textContent = `${erasing ? 'Ke smazání' : 'Přidá se'}: ${n} ${word}`;
    const apply = this.root.querySelector('.area-panel__apply');
    if (apply) apply.disabled = n === 0;
    const clear = this.root.querySelector('.area-panel__clear');
    if (clear) clear.disabled = n === 0;
    const undo = this.root.querySelector('.area-panel__undo');
    if (undo) undo.disabled = !this.undoEnabled;
  }

  open(tool, count, undoEnabled) {
    this.mount();
    this.tool = tool === 'erase' ? 'erase' : 'paint';
    this.count = count || 0;
    this.undoEnabled = Boolean(undoEnabled);
    this.root.classList.add('is-open');
    this.refresh();
  }

  show() {
    if (!this.root) return;
    this.root.classList.add('is-open');
  }

  hide() {
    if (this.root) this.root.classList.remove('is-open');
  }

  get isOpen() {
    return Boolean(this.root && this.root.classList.contains('is-open'));
  }
}
