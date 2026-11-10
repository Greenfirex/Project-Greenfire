// Co má hráč na sobě — nejvýš jeden předmět v každém slotu (hlava, tělo…).
// Drží jen klíče předmětů; batoh, model na postavě a okna řeší scéna.
import { ITEM_TYPES } from '../../data/catalogs/items.js';

export default class EquipmentSystem {

  constructor() {
    this.slots = {};
  }

  get(slot) {
    return this.slots[slot] || null;
  }

  slotOf(itemKey) {
    const def = ITEM_TYPES[itemKey];
    return (def && def.slot) || null;
  }

  set(slot, itemKey) {
    const previous = this.get(slot);
    if (itemKey) this.slots[slot] = itemKey;
    else delete this.slots[slot];
    return previous;
  }

  serialize() {
    return { slots: { ...this.slots } };
  }

  defaultState() {
    return { slots: {} };
  }

  apply(data) {
    const next = {};
    const raw = data && data.slots ? data.slots : {};
    for (const [slot, itemKey] of Object.entries(raw)) {
      if (typeof itemKey === 'string' && this.slotOf(itemKey) === slot) next[slot] = itemKey;
    }
    this.slots = next;
  }
}
