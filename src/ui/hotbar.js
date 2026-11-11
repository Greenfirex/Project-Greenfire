// Hotbar dole uprostřed — sloty pro předměty v ruce, plní se přetažením z batohu.
// Kliknutí a přetahování jen hlásí callbacky; sedí v dolní liště vedle panelů inventáře a postavy.
import { getTool, HOTBAR_SLOTS } from '../data/catalogs/items.js';
import { HAND_DRAG_TYPE, BAR_DRAG_TYPE } from './dragTypes.js';

export default class Hotbar {

  constructor() {
    this.root = null;
    this.slotsEl = null;
    this.slotEls = [];
    this.bar = [];
    this.heldKey = null;
    this.isAvailable = () => true;
    this.onSelect = null;
    this.onAssign = null;
    this.onSwap = null;
    this.onClear = null;
    this.prompt = null;
    this.lastPrompt = '';
  }

  mount() {
    if (this.root) return this.root;
    const dock = this.dock();
    const root = document.createElement('div');
    root.className = 'hotbar';
    root.innerHTML = `<div class="hotbar__slots"></div><div class="hotbar__hint"><span class="hud-key">1</span>–<span class="hud-key">${HOTBAR_SLOTS}</span> výběr předmětu · přetáhni z batohu</div>`;
    this.slotsEl = root.querySelector('.hotbar__slots');
    for (let index = 0; index < HOTBAR_SLOTS; index += 1) this.slotEls.push(this.createSlot(index));
    dock.appendChild(root);
    this.root = root;
    this.prompt = document.createElement('div');
    this.prompt.className = 'gather-prompt';
    document.getElementById('hud-layer').appendChild(this.prompt);
    this.render();
    return root;
  }

  createSlot(index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotbar__slot';
    btn.tabIndex = -1;
    btn.addEventListener('focus', () => btn.blur());
    btn.addEventListener('click', () => {
      const key = this.bar[index];
      if (!key || btn.classList.contains('is-locked')) return;
      if (this.onSelect) this.onSelect(key);
    });
    btn.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      if (this.bar[index] && this.onClear) this.onClear(index);
    });
    btn.addEventListener('dragstart', (evt) => {
      if (!this.bar[index]) {
        evt.preventDefault();
        return;
      }
      evt.dataTransfer.setData(BAR_DRAG_TYPE, String(index));
      evt.dataTransfer.effectAllowed = 'move';
    });
    btn.addEventListener('dragover', (evt) => {
      const types = evt.dataTransfer.types;
      if (!types.includes(HAND_DRAG_TYPE) && !types.includes(BAR_DRAG_TYPE)) return;
      evt.preventDefault();
      btn.classList.add('is-drop');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('is-drop'));
    btn.addEventListener('drop', (evt) => {
      btn.classList.remove('is-drop');
      const toolKey = evt.dataTransfer.getData(HAND_DRAG_TYPE);
      const from = evt.dataTransfer.getData(BAR_DRAG_TYPE);
      if (!toolKey && from === '') return;
      evt.preventDefault();
      if (toolKey && this.onAssign) this.onAssign(index, toolKey);
      else if (from !== '' && this.onSwap) this.onSwap(Number(from), index);
    });
    this.slotsEl.appendChild(btn);
    return btn;
  }

  dock() {
    let dock = document.getElementById('hud-dock');
    if (dock) return dock;
    dock = document.createElement('div');
    dock.className = 'hud-dock';
    dock.id = 'hud-dock';
    document.getElementById('hud-layer').appendChild(dock);
    return dock;
  }

  setPrompt(text) {
    if (!this.prompt) return;
    const value = text || '';
    if (value === this.lastPrompt) return;
    this.lastPrompt = value;
    if (!value) {
      this.prompt.classList.remove('is-open');
      return;
    }
    this.prompt.textContent = value;
    this.prompt.classList.add('is-open');
  }

  setSlots(bar) {
    this.bar = [...bar];
    this.render();
  }

  setAvailable(isAvailable) {
    this.isAvailable = isAvailable;
    this.render();
  }

  setSelected(key) {
    this.heldKey = key || null;
    this.render();
  }

  render() {
    if (!this.root) return;
    this.slotEls.forEach((btn, index) => {
      const key = this.bar[index] || null;
      const tool = key ? getTool(key) : null;
      const locked = Boolean(tool) && !this.isAvailable(key);
      btn.draggable = Boolean(tool);
      btn.classList.toggle('is-empty', !tool);
      btn.classList.toggle('is-locked', locked);
      btn.classList.toggle('is-active', Boolean(tool) && key === this.heldKey);
      if (!tool) {
        btn.title = 'Prázdný slot — přetáhni sem věc z batohu';
        btn.innerHTML = `<span class="hotbar__key">${index + 1}</span><span class="hotbar__icon">·</span><span class="hotbar__name">—</span>`;
        return;
      }
      btn.title = locked
        ? `${tool.displayName} — zatím ho nemáš (pravé tlačítko odebere)`
        : `${tool.displayName} (${index + 1}) — pravé tlačítko odebere z lišty`;
      btn.innerHTML = `<span class="hotbar__key">${index + 1}</span><span class="hotbar__icon">${tool.icon}</span><span class="hotbar__name">${tool.shortName}</span>`;
    });
    this.root.classList.toggle('is-armed', Boolean(this.heldKey));
  }
}
