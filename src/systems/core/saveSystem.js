// Obecný save systém — sběrač stavu nad registrovanými vlastníky.
// Nezná obsah stavu: každý vlastník dodá serialize, apply, defaults a order.
import { SAVE_VERSION, SAVE_STORAGE_KEY, SAVE_LEGACY_KEY, SAVE_LOAD_FLAG_KEY } from '../../data/catalogs/saveSchema.js';
import { readJSON, writeJSON, removeJSON } from '../../utils/storage.js';
import { stateProvider } from '../../utils/saveState.js';

export default class SaveSystem {

  constructor(scene) {
    this.gameScene = scene;
    this.providers = new Map();
  }

  get s() {
    return this.gameScene;
  }

  register(owner, key, def) {
    if (!key || !def) return;
    const provider = stateProvider(def);
    if (owner && typeof owner.registerState === 'function') owner.registerState(key, provider);
    this.providers.set(key, provider);
  }

  orderedProviders() {
    return Array.from(this.providers.entries())
      .sort((a, b) => a[1].order - b[1].order);
  }

  buildPayload() {
    const state = {};
    for (const [key, provider] of this.providers.entries()) {
      try {
        const data = provider.serialize();
        state[key] = data === undefined ? null : data;
      } catch (err) {
        state[key] = null;
      }
    }
    return { version: SAVE_VERSION, savedAt: Date.now(), state };
  }

  save() {
    return writeJSON(SAVE_STORAGE_KEY, this.buildPayload());
  }

  hasSave() {
    const raw = readJSON(SAVE_STORAGE_KEY);
    return !!(raw && raw.version === SAVE_VERSION && raw.state);
  }

  markLoadOnStart() {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      sessionStorage.setItem(SAVE_LOAD_FLAG_KEY, '1');
      return true;
    } catch {
      return false;
    }
  }

  consumeLoadOnStart() {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      const wanted = sessionStorage.getItem(SAVE_LOAD_FLAG_KEY) === '1';
      if (wanted) sessionStorage.removeItem(SAVE_LOAD_FLAG_KEY);
      return wanted;
    } catch {
      return false;
    }
  }

  load() {
    const payload = readJSON(SAVE_STORAGE_KEY);
    if (!payload || payload.version !== SAVE_VERSION || !payload.state) return false;

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

  clear() {
    return removeJSON(SAVE_STORAGE_KEY);
  }

  dropLegacy() {
    return removeJSON(SAVE_LEGACY_KEY);
  }
}
