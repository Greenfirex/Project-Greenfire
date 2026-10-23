// Obecný save systém — sběrač stavu nad registrovanými vlastníky.
// Nezná obsah stavu: každý vlastník se hlásí přes registerState(key, { serialize, apply, order }).
import { SAVE_VERSION, SAVE_STORAGE_KEY, SAVE_LEGACY_KEY } from '../data/catalogs/saveSchema.js';
import { readJSON, writeJSON, removeJSON } from '../utils/storage.js';
import { stateProvider } from '../utils/saveState.js';

export default class SaveSystem {

  constructor(scene) {
    this.gameScene = scene;
    this.providers = new Map();
  }

  get s() {
    return this.gameScene;
  }

  registerState(key, provider) {
    if (!key || !provider) return;
    this.providers.set(key, stateProvider(provider));
  }

  register(owner, key, def) {
    if (!owner || typeof owner.registerState !== 'function') return;
    owner.registerState(key, stateProvider(def));
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
