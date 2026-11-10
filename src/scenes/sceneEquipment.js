// Část herní scény: vybavení — nasazení předmětu z batohu do slotu, sundání zpět a model na postavě.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, EQUIP_SLOTS } from '../data/catalogs/items.js';

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
    this.inventoryWindow.update(this.inventorySystem);
    this.characterWindow.setEquipment(this.equipmentSystem.slots);
    for (const { key } of EQUIP_SLOTS) {
      const itemKey = this.equipmentSystem.get(key);
      const def = itemKey ? ITEM_TYPES[itemKey] : null;
      this.playerSystem.wear(key, def ? def.wear || null : null);
    }
  },
};
