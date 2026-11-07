// Inventář hráče — kolik čeho nese a co z toho jde vyrobit.
// Drží jen počty předmětů, žádnou scénu ani modely.
import { RECIPES } from '../../data/catalogs/items.js';

export default class InventorySystem {

  constructor() {
    this.items = {};
  }

  count(itemKey) {
    return this.items[itemKey] || 0;
  }

  add(itemKey, amount) {
    if (!itemKey || !Number.isFinite(amount) || amount <= 0) return 0;
    this.items[itemKey] = this.count(itemKey) + amount;
    return this.items[itemKey];
  }

  remove(itemKey, amount) {
    if (this.count(itemKey) < amount) return false;
    this.items[itemKey] -= amount;
    if (this.items[itemKey] <= 0) delete this.items[itemKey];
    return true;
  }

  entries() {
    return Object.entries(this.items).filter(([, amount]) => amount > 0);
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

  craftableKeys() {
    return Object.keys(RECIPES).filter((key) => this.canCraft(key));
  }

  serialize() {
    return { items: { ...this.items } };
  }

  apply(data) {
    const next = {};
    const raw = data && data.items ? data.items : {};
    for (const [key, amount] of Object.entries(raw)) {
      if (typeof key !== 'string' || !Number.isFinite(amount) || amount <= 0) continue;
      next[key] = Math.floor(amount);
    }
    this.items = next;
  }

  defaultState() {
    return { items: {} };
  }
}
