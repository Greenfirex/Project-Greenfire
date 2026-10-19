// Hotbar dole uprostřed — sloty pro předměty v ruce. Kliknutí jen hlásí callback.
import { getTool, HOTBAR_ITEMS } from '../data/catalogs/items.js';

const HOTBAR_SLOT_COUNT = 5;

export default class Hotbar {

  constructor() {
    this.root = null;
    this.slotEls = new Map();
    this.heldKey = null;
    this.onSelect = null;
  }

  mount() {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'hotbar';
    root.innerHTML = '<div class="hotbar__slots"></div><div class="hotbar__hint"><span class="hud-key">B</span> kladivo v ruce</div>';
    const slots = root.querySelector('.hotbar__slots');

    for (const key of HOTBAR_ITEMS) {
      const tool = getTool(key);
      if (!tool) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotbar__slot';
      btn.dataset.tool = key;
      btn.title = tool.displayName;
      btn.innerHTML = `<span class="hotbar__icon">${tool.icon}</span><span class="hotbar__name">${tool.shortName}</span>`;
      btn.addEventListener('mousedown', (evt) => evt.preventDefault());
      btn.addEventListener('click', () => {
        if (this.onSelect) this.onSelect(this.heldKey === key ? null : key);
      });
      slots.appendChild(btn);
      this.slotEls.set(key, btn);
    }

    for (let i = HOTBAR_ITEMS.length; i < HOTBAR_SLOT_COUNT; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotbar__slot is-empty';
      btn.disabled = true;
      btn.innerHTML = '<span class="hotbar__icon">·</span><span class="hotbar__name">—</span>';
      slots.appendChild(btn);
    }

    document.getElementById('hud-layer').appendChild(root);
    this.root = root;
    return root;
  }

  setHeld(key) {
    this.mount();
    this.heldKey = key || null;
    for (const [slotKey, btn] of this.slotEls) {
      btn.classList.toggle('is-active', slotKey === this.heldKey);
    }
    this.root.classList.toggle('is-armed', Boolean(this.heldKey));
  }
}
