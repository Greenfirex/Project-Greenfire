// Část herní scény: výroba — co jde vyrobit z obsahu batohu a samotné vyrobení předmětu.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, RECIPES, RECIPE_KEYS } from '../data/catalogs/items.js';

export default {
  craftingRecipes() {
    return RECIPE_KEYS.map((key) => {
      const cost = Object.entries(RECIPES[key].cost).map(([itemKey, need]) => ({
        key: itemKey,
        name: ITEM_TYPES[itemKey] ? ITEM_TYPES[itemKey].displayName : itemKey,
        need,
        have: this.inventorySystem.count(itemKey),
      }));
      return {
        key,
        name: ITEM_TYPES[key].displayName,
        cost,
        ready: this.inventorySystem.canCraft(key),
      };
    });
  },

  refreshCrafting() {
    if (this.craftingWindow.open) this.craftingWindow.setRecipes(this.craftingRecipes());
  },

  craftRecipe(key) {
    if (!this.inventorySystem.craft(key)) return false;
    this.log.add(`Vyrobeno: ${ITEM_TYPES[key].displayName}`, 'action');
    this.audioSystem.play('craft');
    this.refreshInventory();
    return true;
  },
};
