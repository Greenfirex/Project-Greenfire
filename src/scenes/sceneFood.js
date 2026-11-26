// Část herní scény: jídlo — postava zvedne jídlo k puse (jde to i za chůze) a ve chvíli prvního kousnutí ho sní,
// začne se léčit a zažene hlad nebo žízeň.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, itemFood } from '../data/catalogs/items.js';

export default {
  eatItem(itemKey) {
    if (!this.loaded || this.dying || this.paused || this.editor.active) return false;
    const food = itemFood(itemKey);
    if (this.meal || this.drink || !food || this.inventorySystem.count(itemKey) <= 0) return false;
    if (this.drawStrike || this.playerAttackSystem.pending) return false;
    const bite = this.playerSystem.eat(food.hold || null);
    if (!bite) return false;
    this.meal = { itemKey, left: bite };
    return true;
  },

  updateMeal(dt) {
    const meal = this.meal;
    if (!meal) return;
    if (!this.playerSystem.eating() || this.dying) {
      this.meal = null;
      return;
    }
    meal.left -= dt;
    if (meal.left > 0) return;
    this.meal = null;
    const food = itemFood(meal.itemKey);
    if (!food || !this.inventorySystem.remove(meal.itemKey, 1)) return;
    this.playerStats.healOverTime(food.heal, food.perSecond);
    this.survival.feed(food.hunger, food.thirst);
    const def = ITEM_TYPES[meal.itemKey];
    this.log.add(`Snědeno: ${def.displayName}`, 'action');
    this.refreshInventory();
  },
};
