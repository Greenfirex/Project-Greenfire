// Část herní scény: výroba a vaření — co jde vyrobit z obsahu batohu a samotné vyrobení předmětu.
// Výroba chvíli trvá (doba je u receptu); suroviny se odeberou až na konci. Najednou se vyrábí jedna věc.
// Recepty s místem (třeba hořící oheň) mají vlastní okno; když hráč od místa odejde, okno se zavře a vaření se přeruší.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, RECIPES, RECIPE_KEYS, RECIPE_STATIONS } from '../data/catalogs/items.js';

export default {
  stationReady(station) {
    if (!station) return true;
    if (station === 'fire') return Boolean(this.campfireSystem.burning);
    return false;
  },

  updateCrafting(dt) {
    if (this.cookingWindow.open && !this.stationReady('fire')) this.cookingWindow.close();
    const job = this.craftJob;
    if (!job) return;
    const recipe = RECIPES[job.key];
    if (!this.stationReady(recipe.station) || !this.inventorySystem.canCraft(job.key)) {
      this.stopCrafting(true);
      return;
    }
    job.elapsed += dt;
    const progress = Math.min(1, job.elapsed / job.total);
    this.craftingWindow.setProgress(job.key, progress);
    this.cookingWindow.setProgress(job.key, progress);
    if (progress >= 1) this.finishCrafting();
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
    const job = this.craftJob;
    return RECIPE_KEYS.filter((key) => (RECIPES[key].station || null) === station && this.recipeBook.knows(key)).map((key) => {
      const cost = Object.entries(RECIPES[key].cost).map(([itemKey, need]) => ({
        key: itemKey,
        name: ITEM_TYPES[itemKey] ? ITEM_TYPES[itemKey].displayName : itemKey,
        need,
        have: this.inventorySystem.count(itemKey),
      }));
      const busy = Boolean(job) && job.key === key;
      return {
        key,
        name: ITEM_TYPES[key].displayName,
        cost,
        busy,
        progress: busy ? Math.min(1, job.elapsed / job.total) : 0,
        ready: !job && this.inventorySystem.canCraft(key),
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
    if (this.craftJob || !recipe || !this.stationReady(recipe.station)) return false;
    if (!this.inventorySystem.canCraft(key)) return false;
    this.craftJob = { key, elapsed: 0, total: Math.max(0.1, recipe.time || 0) };
    this.refreshCrafting();
    return true;
  },

  finishCrafting() {
    const key = this.craftJob.key;
    this.craftJob = null;
    if (!this.inventorySystem.craft(key)) {
      this.refreshCrafting();
      return;
    }
    const station = RECIPE_STATIONS[RECIPES[key].station];
    this.log.add(`${station ? station.done : 'Vyrobeno'}: ${ITEM_TYPES[key].displayName}`, 'action');
    this.audioSystem.play('craft');
    this.discoverRecipes([key]);
    this.refreshInventory();
  },

  stopCrafting(tell = false) {
    const job = this.craftJob;
    if (!job) return;
    this.craftJob = null;
    if (tell) {
      const station = RECIPE_STATIONS[RECIPES[job.key].station];
      this.log.add(`${station ? station.stopped : 'Výroba přerušena'}: ${ITEM_TYPES[job.key].displayName}`, 'warn');
    }
    this.refreshCrafting();
  },
};
