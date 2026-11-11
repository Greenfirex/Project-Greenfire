// Inventář hráče — kolik čeho nese, na kterém políčku batohu to leží a co z toho jde vyrobit.
// Drží jen počty a rozložení předmětů, žádnou scénu ani modely.
import { RECIPES, INVENTORY_SLOTS } from '../../data/catalogs/items.js';

export default class InventorySystem {

  constructor() {
    this.items = {};
    this.slots = new Array(INVENTORY_SLOTS).fill(null);
  }

  count(itemKey) {
    return this.items[itemKey] || 0;
  }

  add(itemKey, amount) {
    if (!itemKey || !Number.isFinite(amount) || amount <= 0) return 0;
    this.items[itemKey] = this.count(itemKey) + amount;
    if (!this.slots.includes(itemKey)) this.place(itemKey);
    return this.items[itemKey];
  }

  remove(itemKey, amount) {
    if (this.count(itemKey) < amount) return false;
    this.items[itemKey] -= amount;
    if (this.items[itemKey] <= 0) {
      delete this.items[itemKey];
      this.slots[this.slots.indexOf(itemKey)] = null;
      while (this.slots.length > INVENTORY_SLOTS && this.slots[this.slots.length - 1] === null) this.slots.pop();
    }
    return true;
  }

  place(itemKey) {
    const free = this.slots.indexOf(null);
    if (free < 0) this.slots.push(itemKey);
    else this.slots[free] = itemKey;
  }

  move(from, to) {
    const size = this.slots.length;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return false;
    if (from < 0 || to < 0 || from >= size || to >= size || !this.slots[from]) return false;
    [this.slots[from], this.slots[to]] = [this.slots[to], this.slots[from]];
    return true;
  }

  layout() {
    return this.slots.map((key) => (key ? [key, this.count(key)] : null));
  }

  canCraft(recipeKey) {
    const recipe = RECIPES[recipeKey];
    if (!recipe) return false;
    return Object.entries(recipe.cost).every(([key, amount]) => this.count(key) >= amount);
  }

  craft(recipeKey) {
    const recipe = RECIPES[recipeKey];
    if (!recipe || !this.canCraft(recipeKey)) return false;
    for (const [key, amount] of Object.entries(recipe.cost)) this.remove(key, amount);
    this.add(recipeKey, 1);
    return true;
  }

  serialize() {
    return { items: { ...this.items }, slots: [...this.slots] };
  }

  apply(data) {
    const next = {};
    const raw = data && data.items ? data.items : {};
    for (const [key, amount] of Object.entries(raw)) {
      if (typeof key !== 'string' || !Number.isFinite(amount) || amount <= 0) continue;
      next[key] = Math.floor(amount);
    }
    this.items = next;
    this.slots = new Array(INVENTORY_SLOTS).fill(null);
    const saved = data && Array.isArray(data.slots) ? data.slots.slice(0, INVENTORY_SLOTS) : [];
    saved.forEach((key, index) => {
      if (typeof key === 'string' && next[key] && !this.slots.includes(key)) this.slots[index] = key;
    });
    for (const key of Object.keys(next)) {
      if (!this.slots.includes(key)) this.place(key);
    }
  }

  defaultState() {
    return { items: {}, slots: [] };
  }
}
