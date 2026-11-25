// Část editoru: volné pokládání dekorací — kus přesně na bod pod myší, bez mazání políčka, i na podlahu stavby.
// Kliky se sbírají do návrhu (položit / smazat nejbližší věc) a teprve Aplikovat je zapíše do mapy najednou.
// Patří k EditorMode (sdílí jeho this).
import { BRUSHES, PAINT_DECORATIONS } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { cellToWorld, worldToCellCoords } from '../utils/gridMath.js';
import { layerLiftAt, levelOfEntry } from '../data/maps/areaShape.js';
import { FREE_ERASE_REACH } from './editorSettings.js';

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function spotOf(entry) {
  return { x: cellToWorld(entry.cx) + (entry.offsetX || 0), z: cellToWorld(entry.cz) + (entry.offsetZ || 0) };
}

function nearest(list, spot, pass) {
  let best = null;
  let bestDistance = FREE_ERASE_REACH * FREE_ERASE_REACH;
  for (const item of list) {
    if (!pass(item)) continue;
    const at = spotOf(item.entry || item);
    const distance = (at.x - spot.x) ** 2 + (at.z - spot.z) ** 2;
    if (distance > bestDistance) continue;
    best = item;
    bestDistance = distance;
  }
  return best;
}

export default {
  freeNext(brush) {
    const pool = this.brushPool();
    const random = pool.length > 1 && this.brushOptionValue(this.brushKey, 'random');
    const next = this.freeRoll;
    if (next && next.brushKey === this.brushKey && (random ? pool.includes(next.key) : next.key === this.tileKey)) return next;
    const key = random ? pool[Math.floor(Math.random() * pool.length) % pool.length] : this.tileKey;
    this.freeRoll = { brushKey: this.brushKey, key, turn: brush.rotate ? null : Math.round(Math.random() * 400) / 100 };
    return this.freeRoll;
  },

  freeEntry(spot) {
    const brush = BRUSHES[this.brushKey];
    if (!brush || !brush.deco || !spot || !this.layout) return null;
    const next = this.freeNext(brush);
    const key = next.key;
    if (!getDecoration(key)) return null;
    const { cx, cz } = worldToCellCoords(spot.x, spot.z);
    const level = this.paintLevel;
    const rotation = next.turn === null ? this.decoRotation() : next.turn;
    const entry = { key, cx, cz, offsetX: round3(spot.x - cellToWorld(cx)), offsetZ: round3(spot.z - cellToWorld(cz)), rotation, exact: true };
    if (level) entry.level = level;
    if (spot.deck && !level) {
      entry.deck = spot.deck;
      return entry;
    }
    const lift = layerLiftAt(this.layout, cx, cz, level) || 0;
    if (lift) entry.liftY = lift;
    return entry;
  },

  freeDeckOf(spot) {
    return this.paintLevel ? null : (spot && spot.deck) || null;
  },

  freeTargetAt(spot) {
    if (!spot || !this.layout) return null;
    const level = this.paintLevel;
    const deck = this.freeDeckOf(spot);
    const marked = new Set(this.freeDraft.filter((item) => item.remove).map((item) => item.entry));
    return nearest(this.layout.decorations || [], spot, (entry) => (
      entry && !marked.has(entry) && levelOfEntry(entry) === level && (entry.deck || null) === deck
    ));
  },

  freePendingAt(spot) {
    if (!spot) return null;
    const level = this.paintLevel;
    const deck = this.freeDeckOf(spot);
    return nearest(this.freeDraft, spot, (item) => (
      levelOfEntry(item.entry) === level && (item.entry.deck || null) === deck
    ));
  },

  freeEraseAt(spot) {
    const pending = this.freePendingAt(spot);
    if (pending && !pending.remove) return pending.entry;
    return this.freeTargetAt(spot);
  },

  addFree(spot) {
    const entry = this.freeEntry(spot);
    if (!entry) return null;
    this.freeDraft.push({ entry, remove: false });
    this.freeRoll = null;
    this.freeDraftChanged();
    return entry;
  },

  markFree(spot) {
    const pending = this.freePendingAt(spot);
    if (pending && !pending.remove) return this.dropFree(pending);
    const target = this.freeTargetAt(spot);
    if (!target) return null;
    this.freeDraft.push({ entry: target, remove: true });
    this.freeDraftChanged();
    return target;
  },

  unmarkFree(spot) {
    const pending = this.freePendingAt(spot);
    return pending ? this.dropFree(pending) : null;
  },

  dropFree(item) {
    this.freeDraft = this.freeDraft.filter((other) => other !== item);
    this.freeDraftChanged();
    return item.entry;
  },

  clearFreeDraft() {
    if (!this.freeDraft.length) return false;
    this.freeDraft = [];
    this.freeDraftChanged();
    return true;
  },

  applyFreeDraft() {
    const draft = this.freeDraft;
    if (!draft.length || !this.layout) return { added: 0, removed: 0 };
    this.pushHistory([PAINT_DECORATIONS]);
    const removed = new Set(draft.filter((item) => item.remove).map((item) => item.entry));
    const added = draft.filter((item) => !item.remove).map((item) => item.entry);
    this.layout.decorations = [...(this.layout.decorations || []).filter((entry) => !removed.has(entry)), ...added];
    this.freeDraft = [];
    this.freeDraftChanged();
    this.repaint([PAINT_DECORATIONS]);
    return { added: added.length, removed: removed.size };
  },

  freeDraftChanged() {
    if (this.onFreeDraftChange) this.onFreeDraftChange(this.freeDraft);
  },
};
