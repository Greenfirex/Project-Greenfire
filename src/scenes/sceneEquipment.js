// Část herní scény: vybavení — nasazení předmětu z batohu do slotu, sundání zpět, model na postavě a co z toho plyne pro staty.
// Taky tasení a zandávání zbraně a rozhodnutí, co má postava v ruce. Modely věcí, které hráč má,
// připraví předem na pozadí, aby se hra při prvním nasazení nebo jídle nezasekla.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, EQUIP_SLOTS, gearBonus, itemFood, itemWeight, toolForItem, getTool, hotbarTool } from '../data/catalogs/items.js';

export default {
  ownedItemKeys() {
    return [...Object.keys(this.inventorySystem.items || {}), ...Object.values(this.equipmentSystem.slots || {})];
  },

  warmOwnedItems() {
    if (!this.playerSystem.ready) return Promise.resolve();
    for (const key of this.ownedItemKeys()) {
      if (!key || this.warmedItems.has(key)) continue;
      this.warmedItems.add(key);
      this.warmQueue.push(key);
    }
    if (!this.warmRunning) this.warmRunning = this.drainWarmQueue().finally(() => { this.warmRunning = null; });
    return this.warmRunning;
  },

  async drainWarmQueue() {
    while (this.warmQueue.length) {
      const key = this.warmQueue.shift();
      try {
        await this.warmItem(key);
      } catch (err) {
        console.warn(`[výbava] Model předmětu „${key}“ se nepodařilo připravit předem.`, err);
      }
    }
  },

  async warmItem(itemKey) {
    const def = ITEM_TYPES[itemKey];
    if (!def) return;
    const tool = toolForItem(itemKey);
    const food = itemFood(itemKey);
    const warm = await this.playerSystem.itemWarmup({
      tools: tool ? [tool] : [],
      wears: def.wear ? [def.wear] : [],
      meals: food && food.hold ? [food.hold] : [],
    });
    this.revealSystem.attachPending();
    this.lighting.fitNewMaterials();
    const meshes = warm.meshes.filter((mesh) => mesh.material && !mesh.isDisposed());
    await Promise.all(meshes.map((mesh) => mesh.material.forceCompilationAsync(mesh).catch(() => null)));
    warm.dispose();
  },

  equipItem(itemKey, slot) {
    const def = ITEM_TYPES[itemKey];
    if (!def || def.slot !== slot) return false;
    if (!this.inventorySystem.remove(itemKey, 1)) return false;
    const previous = this.equipmentSystem.set(slot, itemKey);
    if (previous) this.inventorySystem.add(previous, 1);
    this.log.add(`Nasazeno: ${def.displayName}`, 'action');
    this.audioSystem.play('equipCloth');
    this.refreshEquipment();
    return true;
  },

  useBagItem(itemKey) {
    const def = ITEM_TYPES[itemKey];
    if (!def) return false;
    if (def.slot) return this.equipItem(itemKey, def.slot);
    if (itemFood(itemKey)) return this.eatItem(itemKey);
    const toolKey = toolForItem(itemKey);
    if (!toolKey || !hotbarTool(toolKey)) return false;
    const bar = this.heldItemSystem.bar;
    const index = bar.indexOf(toolKey);
    if (index >= 0) this.heldItemSystem.clear(index);
    else if (bar.includes(null)) this.heldItemSystem.keep(toolKey);
    else return false;
    this.audioSystem.play('itemDrop');
    return true;
  },

  unequipSlot(slot) {
    const itemKey = this.equipmentSystem.set(slot, null);
    if (!itemKey) return false;
    this.inventorySystem.add(itemKey, 1);
    const def = ITEM_TYPES[itemKey];
    this.log.add(`Sundáno: ${def ? def.displayName : itemKey}`, 'action');
    this.audioSystem.play('itemDrop');
    this.refreshEquipment();
    return true;
  },

  refreshEquipment() {
    this.playerStats.setGear(gearBonus(Object.values(this.equipmentSystem.slots)));
    this.refreshInventory();
    this.characterPanel.setEquipment(this.equipmentSystem.slots);
    for (const { key } of EQUIP_SLOTS) {
      const itemKey = this.equipmentSystem.get(key);
      const def = itemKey ? ITEM_TYPES[itemKey] : null;
      this.playerSystem.wear(key, def ? def.wear || null : null);
    }
    this.refreshHands('instant');
  },

  equippedWeapon() {
    const itemKey = this.equipmentSystem.get('weapon');
    const toolKey = itemKey ? toolForItem(itemKey) : null;
    const tool = toolKey ? getTool(toolKey) : null;
    return tool && tool.weapon ? { toolKey, tool } : null;
  },

  harvestTool() {
    const weapon = this.equippedWeapon();
    if (weapon && this.playerSystem.weaponDrawn) return weapon.tool;
    return this.heldItemSystem.tool();
  },

  drawWeapon(how = 'hip') {
    if (this.playerSystem.weaponDrawn) return false;
    this.playerSystem.weaponDrawn = true;
    this.refreshHands(how);
    if (how !== 'instant' && this.equippedWeapon()) this.audioSystem.play('weaponDraw');
    return true;
  },

  sheathWeapon(how = 'hip') {
    if (!this.playerSystem.weaponDrawn) return false;
    this.playerSystem.weaponDrawn = false;
    this.drawStrike = null;
    this.refreshHands(how);
    if (how !== 'instant' && this.equippedWeapon()) this.audioSystem.play('weaponSheathe');
    return true;
  },

  toggleWeapon() {
    if (this.dying || this.editor.active) return;
    if (!this.sheathWeapon()) this.drawWeapon();
  },

  refreshHands(how = null) {
    const weapon = this.equippedWeapon();
    const drawn = Boolean(weapon) && this.playerSystem.weaponDrawn;
    this.playerSystem.setSheathedTool(weapon ? weapon.toolKey : null);
    const held = this.heldItemSystem.tool();
    const offHand = held && held.offHand ? this.heldItemSystem.key : null;
    const right = drawn ? weapon.toolKey : offHand ? null : this.heldItemSystem.key;
    this.playerSystem.setHeldTool(right, how === 'instant', how === 'hip');
    this.playerSystem.setOffHandTool(offHand, how === 'instant');
    this.playerAttackSystem.setWeapon(weapon ? weapon.tool : null);
    this.gatherSystem.setTool(this.harvestTool());
    if (this.characterPanel.open) this.refreshCharacterPanel();
  },

  previewStats(itemKey) {
    const def = ITEM_TYPES[itemKey];
    if (!def) return null;
    if (def.slot === 'weapon') {
      if (this.equipmentSystem.get('weapon') === itemKey) return null;
      const toolKey = toolForItem(itemKey);
      return this.playerAttackSystem.weaponStats(toolKey ? getTool(toolKey) : null);
    }
    if (def.slot) {
      if (this.equipmentSystem.get(def.slot) === itemKey) return null;
      const slots = { ...this.equipmentSystem.slots, [def.slot]: itemKey };
      return this.playerStats.gearStats(gearBonus(Object.values(slots)));
    }
    return null;
  },

  carriedLoad() {
    let weight = 0;
    for (const entry of this.inventorySystem.layout()) {
      if (entry) weight += itemWeight(entry[0]) * entry[1];
    }
    for (const itemKey of Object.values(this.equipmentSystem.slots)) weight += itemWeight(itemKey);
    return { weight, capacity: this.playerStats.carryWeight };
  },
};
