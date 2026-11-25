// Kniha receptů — které předměty už hráč někdy měl a které recepty tím objevil.
// Recept se objeví, jakmile hráč poprvé získá kteroukoli z jeho surovin; pak už zůstane známý.
import { RECIPES, RECIPE_KEYS } from '../../data/catalogs/items.js';

export default class RecipeBookSystem {

  constructor() {
    this.seen = new Set();
  }

  knows(recipeKey) {
    const recipe = RECIPES[recipeKey];
    return Boolean(recipe) && Object.keys(recipe.cost).some((key) => this.seen.has(key));
  }

  notice(itemKeys) {
    const fresh = itemKeys.filter((key) => typeof key === 'string' && key && !this.seen.has(key));
    if (!fresh.length) return [];
    const known = new Set(RECIPE_KEYS.filter((key) => this.knows(key)));
    for (const key of fresh) this.seen.add(key);
    return RECIPE_KEYS.filter((key) => !known.has(key) && this.knows(key));
  }

  serialize() {
    return { seen: [...this.seen] };
  }

  apply(data) {
    const saved = data && Array.isArray(data.seen) ? data.seen : [];
    this.seen = new Set(saved.filter((key) => typeof key === 'string' && key));
  }

  defaultState() {
    return { seen: [] };
  }
}
