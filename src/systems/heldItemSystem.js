// Co má hráč právě v ruce — nástroj vybraný v liště dole, nebo nic.
// Drží jen klíč předmětu a umí se uložit, ať po obnovení stránky zůstane stejná věc v ruce.
import { getTool } from '../data/catalogs/items.js';

export default class HeldItemSystem {

  constructor() {
    this.key = null;
    this.onChange = null;
  }

  set(key) {
    const next = getTool(key) ? key : null;
    if (next === this.key) return;
    this.key = next;
    if (this.onChange) this.onChange(this.key);
  }

  tool() {
    return getTool(this.key);
  }

  serialize() {
    return { key: this.key };
  }

  apply(data) {
    const key = data && typeof data.key === 'string' ? data.key : null;
    this.key = getTool(key) ? key : null;
    if (this.onChange) this.onChange(this.key);
  }

  registerState(key, provider) {
    this.saveKey = key;
    this.savedState = provider;
  }

  defaultState() {
    return { key: null };
  }
}