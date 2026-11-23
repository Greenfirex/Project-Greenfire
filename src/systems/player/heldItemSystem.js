// Co má hráč právě v ruce a co má rozložené na liště dole (klávesy 1–5): nástroje a jídlo. Zbraně na lištu nepatří, ty jsou ve výbavě.
// Drží jen klíče nástrojů a umí se uložit, ať po obnovení stránky zůstane stejná věc v ruce i na liště.
import { getTool, hotbarTool, barItem, HOTBAR_SLOTS } from '../../data/catalogs/items.js';

export default class HeldItemSystem {

  constructor() {
    this.key = null;
    this.bar = new Array(HOTBAR_SLOTS).fill(null);
    this.onChange = null;
    this.onBarChange = null;
  }

  set(key) {
    const next = hotbarTool(key) ? key : null;
    if (next === this.key) return;
    this.key = next;
    if (this.onChange) this.onChange(this.key);
  }

  tool() {
    return getTool(this.key);
  }

  assign(index, toolKey) {
    if (!this.inBar(index) || !barItem(toolKey)) return;
    const previous = this.bar.indexOf(toolKey);
    if (previous >= 0) this.bar[previous] = this.bar[index];
    this.bar[index] = toolKey;
    this.barChanged();
  }

  swap(from, to) {
    if (!this.inBar(from) || !this.inBar(to) || from === to) return;
    [this.bar[from], this.bar[to]] = [this.bar[to], this.bar[from]];
    this.barChanged();
  }

  clear(index) {
    if (!this.inBar(index) || !this.bar[index]) return;
    this.bar[index] = null;
    this.barChanged();
  }

  keep(toolKey) {
    if (!barItem(toolKey) || this.bar.includes(toolKey)) return;
    const free = this.bar.indexOf(null);
    if (free < 0) return;
    this.bar[free] = toolKey;
    this.barChanged();
  }

  inBar(index) {
    return Number.isInteger(index) && index >= 0 && index < HOTBAR_SLOTS;
  }

  barChanged() {
    if (this.onBarChange) this.onBarChange(this.bar);
  }

  serialize() {
    return { key: this.key, bar: [...this.bar] };
  }

  apply(data) {
    const key = data && typeof data.key === 'string' ? data.key : null;
    this.key = hotbarTool(key) ? key : null;
    const saved = data && Array.isArray(data.bar) ? data.bar : [];
    this.bar = new Array(HOTBAR_SLOTS).fill(null);
    saved.slice(0, HOTBAR_SLOTS).forEach((toolKey, index) => {
      if (barItem(toolKey) && !this.bar.includes(toolKey)) this.bar[index] = toolKey;
    });
    this.barChanged();
    if (this.onChange) this.onChange(this.key);
  }

  defaultState() {
    return { key: null, bar: [] };
  }
}
