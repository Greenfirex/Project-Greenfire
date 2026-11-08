// Část editoru: historie úprav pro tlačítko Zpět — co se v mapě změnilo a jak to vrátit.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { PAINT_ALL } from '../data/catalogs/brushes.js';
import { cellKey } from '../utils/gridMath.js';
import { ENTRY_LAYERS } from '../data/maps/areaShape.js';
import { defaultSpawn } from '../data/catalogs/mapFile.js';
import { toWorld } from './editorSettings.js';

const HISTORY_LIMIT = 100;

export default {
  pushHistory(parts) {
    if (!this.layout) return;
    if (this.history.length >= HISTORY_LIMIT) this.history.shift();
    this.history.push({ world: toWorld(this.layout), parts: parts || PAINT_ALL });
    this.pendingHistory = this.history.length - 1;
  },

  commitHistory() {
    const index = this.pendingHistory;
    if (index === null) return;
    this.pendingHistory = null;
    const entry = this.history[index];
    if (!entry || !entry.world) return;
    entry.patch = this.historyPatch(entry.world);
    delete entry.world;
  },

  historyPatch(before) {
    const was = this.cellEntries(before);
    const now = this.cellEntries(this.layout);
    const cells = [];
    const keys = new Set([...was.keys(), ...now.keys()]);
    for (const key of keys) {
      const first = was.get(key);
      const second = now.get(key);
      if (first && second && JSON.stringify(first) === JSON.stringify(second)) continue;
      if (!first && !second) continue;
      const [cx, cz] = key.split(',').map(Number);
      const entries = {};
      for (const layer of ENTRY_LAYERS) entries[layer] = first ? first[layer] : [];
      cells.push({ cx, cz, entries });
    }
    const patch = { cells };
    const wasSpawn = before.spawn && Number.isFinite(before.spawn.cx) ? { cx: before.spawn.cx, cz: before.spawn.cz } : null;
    const nowSpawn = this.spawnCell();
    if (!wasSpawn || !nowSpawn || wasSpawn.cx !== nowSpawn.cx || wasSpawn.cz !== nowSpawn.cz) patch.spawn = wasSpawn;
    const wasBridges = (before.bridges || []).map((entry) => ({ ...entry }));
    const nowBridges = this.layout.bridges || [];
    if (JSON.stringify(wasBridges) !== JSON.stringify(nowBridges)) patch.bridges = wasBridges;
    const wasConnectors = JSON.parse(JSON.stringify(before.connectors || []));
    if (JSON.stringify(wasConnectors) !== JSON.stringify(this.layout.connectors || [])) patch.connectors = wasConnectors;
    const wasWater = Number.isFinite(before.waterLevel) ? before.waterLevel : null;
    const nowWater = this.layout && Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
    if (wasWater !== nowWater) patch.waterLevel = wasWater;
    return patch;
  },

  cellEntries(layout) {
    const map = new Map();
    for (const layer of ENTRY_LAYERS) {
      for (const entry of (layout && layout[layer]) || []) {
        if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
        const key = cellKey(entry.cx, entry.cz);
        let cell = map.get(key);
        if (!cell) {
          cell = {};
          for (const name of ENTRY_LAYERS) cell[name] = [];
          map.set(key, cell);
        }
        cell[layer].push(entry);
      }
    }
    return map;
  },

  applyHistoryPatch(patch) {
    if (!patch) return;
    for (const cell of patch.cells || []) {
      for (const layer of ENTRY_LAYERS) {
        const kept = (this.layout[layer] || []).filter((entry) => (
          !entry || entry.cx !== cell.cx || entry.cz !== cell.cz
        ));
        for (const entry of cell.entries[layer] || []) kept.push({ ...entry });
        this.layout[layer] = kept;
      }
    }
    if ('bridges' in patch) this.layout.bridges = patch.bridges.map((entry) => ({ ...entry }));
    if ('connectors' in patch) this.layout.connectors = JSON.parse(JSON.stringify(patch.connectors));
    if ('spawn' in patch) this.layout.spawn = patch.spawn ? { ...patch.spawn } : defaultSpawn();
    if ('waterLevel' in patch) {
      if (patch.waterLevel === null) delete this.layout.waterLevel;
      else this.layout.waterLevel = patch.waterLevel;
    }
  },

  undo() {
    this.cancelHeightDraft();
    this.resetDraftDrag();
    this.resetJoin();
    this.resetBridge();
    if (this.draft) {
      this.draft.cells.clear();
      if (this.onDraftChange) this.onDraftChange(this.draft);
    }
    if (!this.history.length) return false;
    const step = this.history.pop();
    this.pendingHistory = null;
    if (step.patch) this.applyHistoryPatch(step.patch);
    else this.restoreLayout(step.world);
    this.repaint(step.parts);
    return true;
  },
};
