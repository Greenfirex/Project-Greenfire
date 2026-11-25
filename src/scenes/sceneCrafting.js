// Část herní scény: výroba a vaření — co jde vyrobit z obsahu batohu a samotné vyrobení předmětu.
// Recepty s místem (třeba hořící oheň) mají vlastní okno, které se zavře, když hráč od místa odejde.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, RECIPES, RECIPE_KEYS, RECIPE_STATIONS } from '../data/catalogs/items.js';

export default {
  stationReady(station) {
    if (!station) return true;
    if (station === 'fire') return Boolean(this.campfireSystem.burning);
    return false;
  },

  updateCraftingStations() {
    if (this.cookingWindow.open && !this.stationReady('fire')) this.cookingWindow.close();
  },

  discoverRecipes(itemKeys) {
    const found = this.recipeBook.notice(itemKeys);
    if (!found.length) return;
    const names = found.map((key) => {
      const station = RECIPE_STATIONS[RECIPES[key].station];
      return station ? `${ITEM_TYPES[key].displayName} (${station.title})` : ITEM_TYPES[key].displayName;
    }).join(', ');
    this.log.add(`${found.length === 1 ? 'Nový recept' : 'Nové recepty'}: ${names}`, 'gain');
    this.toasts.push(found.length === 1 ? 'Nový recept' : 'Nové recepty', names);
  },

  craftingRecipes(station = null) {
    return RECIPE_KEYS.filter((key) => (RECIPES[key].station || null) === station && this.recipeBook.knows(key)).map((key) => {
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
    if (this.cookingWindow.open) this.cookingWindow.setRecipes(this.craftingRecipes('fire'));
  },

  openCookingWindow() {
    if (this.cookingWindow.open || !this.stationReady('fire')) return;
    this.cookingWindow.setRecipes(this.craftingRecipes('fire'));
    this.cookingWindow.show();
    this.audioSystem.play('windowOpen');
  },

  craftRecipe(key) {
    const recipe = RECIPES[key];
    if (!recipe || !this.stationReady(recipe.station)) return false;
    if (!this.inventorySystem.craft(key)) return false;
    const station = RECIPE_STATIONS[recipe.station];
    this.log.add(`${station ? station.done : 'Vyrobeno'}: ${ITEM_TYPES[key].displayName}`, 'action');
    this.audioSystem.play('craft');
    this.discoverRecipes([key]);
    this.refreshInventory();
    return true;
  },
};
