// Obecný save systém — sběrač stavu nad registrovanými vlastníky.
// Nezná obsah stavu: každý vlastník dodá serialize, apply, defaults a order.
import { SAVE_VERSION, SAVE_SLOTS, SAVE_LEGACY_KEY, SAVE_LOAD_FLAG_KEY } from '../../data/catalogs/saveSchema.js';
import { readJSON, writeJSON, removeJSON } from '../../utils/storage.js';
import { stateProvider } from '../../utils/saveState.js';

export default class SaveSystem {

  constructor(scene) {
    this.s = scene;
    this.providers = new Map();
  }

  register(key, def) {
    if (!key || !def) return;
    this.providers.set(key, stateProvider(def));
  }

  orderedProviders() {
    return Array.from(this.providers.entries())
      .sort((a, b) => a[1].order - b[1].order);
  }

  buildPayload(meta) {
    const state = {};
    for (const [key, provider] of this.providers.entries()) {
      try {
        const data = provider.serialize();
        state[key] = data === undefined ? null : data;
      } catch (err) {
        state[key] = null;
      }
    }
    return { version: SAVE_VERSION, savedAt: Date.now(), meta: meta || null, state };
  }

  readSlot(slot) {
    const key = SAVE_SLOTS[slot];
    if (!key) return null;
    const payload = readJSON(key);
    return payload && payload.version === SAVE_VERSION && payload.state ? payload : null;
  }

  save(slot, meta = null) {
    const key = SAVE_SLOTS[slot];
    return key ? writeJSON(key, this.buildPayload(meta)) : false;
  }

  hasSave(slot) {
    return Boolean(this.readSlot(slot));
  }

  summary(slot) {
    const payload = this.readSlot(slot);
    if (!payload) return null;
    const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
    return {
      slot,
      savedAt: Number.isFinite(payload.savedAt) ? payload.savedAt : 0,
      name: typeof meta.name === 'string' ? meta.name : '',
      level: Number.isFinite(meta.level) ? meta.level : null,
      clock: typeof meta.clock === 'string' ? meta.clock : '',
    };
  }

  newest() {
    let best = null;
    for (const slot of Object.keys(SAVE_SLOTS)) {
      const info = this.summary(slot);
      if (info && (!best || info.savedAt > best.savedAt)) best = info;
    }
    return best;
  }

  rename(slot, name) {
    const payload = this.readSlot(slot);
    if (!payload) return false;
    payload.meta = { ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}), name };
    return writeJSON(SAVE_SLOTS[slot], payload);
  }

  markLoadOnStart(slot) {
    try {
      if (typeof sessionStorage === 'undefined' || !SAVE_SLOTS[slot]) return false;
      sessionStorage.setItem(SAVE_LOAD_FLAG_KEY, slot);
      return true;
    } catch {
      return false;
    }
  }

  consumeLoadOnStart() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const slot = sessionStorage.getItem(SAVE_LOAD_FLAG_KEY);
      if (slot !== null) sessionStorage.removeItem(SAVE_LOAD_FLAG_KEY);
      return SAVE_SLOTS[slot] ? slot : null;
    } catch {
      return null;
    }
  }

  load(slot) {
    const payload = this.readSlot(slot);
    if (!payload) return false;

    for (const [key, provider] of this.orderedProviders()) {
      const data = payload.state[key];
      try {
        provider.apply(data === undefined ? null : data);
      } catch (err) {
        console.warn(`[save] Načtení stavu "${key}" selhalo (přeskakuji).`, err);
      }
    }
    return true;
  }

  clear(slot) {
    const key = SAVE_SLOTS[slot];
    return key ? removeJSON(key) : false;
  }

  dropLegacy() {
    return removeJSON(SAVE_LEGACY_KEY);
  }
}
