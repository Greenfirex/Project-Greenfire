// Část herní scény: vybavení — nasazení předmětu z batohu do slotu, sundání zpět, model na postavě a co z toho plyne pro staty.
// Taky tasení a zandávání zbraně a rozhodnutí, co má postava v ruce.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { ITEM_TYPES, EQUIP_SLOTS, gearBonus, itemWeight, toolForItem, getTool } from '../data/catalogs/items.js';

const AUTO_SHEATH_SECONDS = 8;

export default {
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

  unequipSlot(slot) {
    if (slot === 'weapon') this.sheathWeapon('instant');
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

  drawWeapon(how = 'hip') {
    if (this.playerSystem.weaponDrawn || !this.equippedWeapon()) return false;
    this.playerSystem.weaponDrawn = true;
    this.keepWeaponDrawn();
    this.refreshHands(how);
    return true;
  },

  sheathWeapon(how = 'hip') {
    if (!this.playerSystem.weaponDrawn) return false;
    this.playerSystem.weaponDrawn = false;
    this.drawStrike = null;
    this.refreshHands(how);
    return true;
  },

  keepWeaponDrawn() {
    this.sheathTimer = AUTO_SHEATH_SECONDS;
  },

  updateWeaponSheath(dt) {
    if (!this.playerSystem.weaponDrawn || this.dying || this.editor.active) return;
    const root = this.playerSystem.root;
    if (root && this.creatureSystem.isPlayerInCombat(root.position)) {
      this.keepWeaponDrawn();
      return;
    }
    this.sheathTimer = (Number.isFinite(this.sheathTimer) ? this.sheathTimer : AUTO_SHEATH_SECONDS) - dt;
    if (this.sheathTimer <= 0) this.sheathWeapon();
  },

  toggleWeapon() {
    if (this.dying || this.editor.active) return;
    if (this.sheathWeapon()) return;
    if (!this.drawWeapon()) this.log.add('Nemáš nasazenou zbraň', 'info');
  },

  refreshHands(how = null) {
    const weapon = this.equippedWeapon();
    const drawn = Boolean(weapon) && this.playerSystem.weaponDrawn;
    this.playerSystem.setSheathedTool(weapon ? weapon.toolKey : null);
    this.playerSystem.setHeldTool(drawn ? weapon.toolKey : this.heldItemSystem.key, how === 'instant', how === 'hip');
    this.playerAttackSystem.setWeapon(drawn ? weapon.tool : null);
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
