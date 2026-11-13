// Část herní scény: vybavení — nasazení předmětu z batohu do slotu, sundání zpět, model na postavě a co z toho plyne pro staty.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, EQUIP_SLOTS, gearBonus, itemWeight, toolForItem, getTool } from '../data/catalogs/items.js';

export default {
  equipItem(itemKey, slot) {
    const def = ITEM_TYPES[itemKey];
    if (!def || def.slot !== slot) return false;
    if (!this.inventorySystem.remove(itemKey, 1)) return false;
    const previous = this.equipmentSystem.set(slot, itemKey);
    if (previous) this.inventorySystem.add(previous, 1);
    this.log.add(`Nasazeno: ${def.displayName}`, 'action');
    this.refreshEquipment();
    return true;
  },

  unequipSlot(slot) {
    const itemKey = this.equipmentSystem.set(slot, null);
    if (!itemKey) return false;
    this.inventorySystem.add(itemKey, 1);
    const def = ITEM_TYPES[itemKey];
    this.log.add(`Sundáno: ${def ? def.displayName : itemKey}`, 'action');
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
  },

  previewStats(itemKey) {
    const def = ITEM_TYPES[itemKey];
    if (!def) return null;
    if (def.slot) {
      if (this.equipmentSystem.get(def.slot) === itemKey) return null;
      const slots = { ...this.equipmentSystem.slots, [def.slot]: itemKey };
      return this.playerStats.gearStats(gearBonus(Object.values(slots)));
    }
    const toolKey = toolForItem(itemKey);
    const tool = toolKey ? getTool(toolKey) : null;
    if (!tool || !tool.weapon || this.heldItemSystem.key === toolKey) return null;
    return this.playerAttackSystem.weaponStats(tool);
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
