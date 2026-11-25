// Část editoru: volné pokládání dekorací — kus přesně na bod pod myší, bez mazání políčka, i na podlahu stavby.
// Kliky se sbírají do návrhu (položit / smazat / přenést nejbližší věc) a teprve Aplikovat je zapíše do mapy najednou.
// Patří k EditorMode (sdílí jeho this).
import { BRUSHES, PAINT_DECORATIONS } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { cellToWorld, worldToCellCoords } from '../utils/gridMath.js';
import { layerLiftAt, levelOfEntry } from '../data/maps/areaShape.js';
import { decoPlacement } from '../utils/decoPlacement.js';
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

  freeBase() {
    if (this.freeCarry) return this.freeCarry.base;
    const brush = BRUSHES[this.brushKey];
    if (!brush || !brush.deco) return null;
    const next = this.freeNext(brush);
    return { key: next.key, rotation: next.turn === null ? this.decoRotation() : next.turn };
  },

  freeEntry(spot) {
    if (!spot || !this.layout) return null;
    const base = this.freeBase();
    if (!base || !getDecoration(base.key)) return null;
    const { cx, cz } = worldToCellCoords(spot.x, spot.z);
    const level = this.paintLevel;
    const entry = { ...base, cx, cz, offsetX: round3(spot.x - cellToWorld(cx)), offsetZ: round3(spot.z - cellToWorld(cz)), exact: true };
    if (level) entry.level = level;
    if (spot.deck && !level) {
      entry.deck = spot.deck;
      return entry;
    }
    const lift = layerLiftAt(this.layout, cx, cz, level) || 0;
    if (lift) entry.liftY = lift;
    return entry;
  },

  freeUpstairs(spot) {
    return !this.paintLevel && Boolean(spot && spot.deck === 'upper');
  },

  freeSameFloor(entry, spot) {
    return levelOfEntry(entry) === this.paintLevel && (entry.deck === 'upper') === this.freeUpstairs(spot);
  },

  freeTargetAt(spot) {
    if (!spot || !this.layout) return null;
    const marked = new Set(this.freeDraft.filter((item) => item.remove).map((item) => item.entry));
    return nearest(this.layout.decorations || [], spot, (entry) => entry && !marked.has(entry) && this.freeSameFloor(entry, spot));
  },

  freePendingAt(spot) {
    if (!spot) return null;
    return nearest(this.freeDraft, spot, (item) => this.freeSameFloor(item.entry, spot));
  },

  freeEraseAt(spot) {
    const pending = this.freePendingAt(spot);
    if (pending && !pending.remove) return pending.entry;
    return this.freeTargetAt(spot);
  },

  addFree(spot) {
    const entry = this.freeEntry(spot);
    if (!entry) return null;
    const carry = this.freeCarry;
    const movedFrom = carry ? (carry.fromDraft ? carry.fromDraft.movedFrom || null : carry.item) : null;
    this.freeDraft.push({ entry, remove: false, movedFrom });
    if (carry) this.freeCarry = null;
    else this.freeRoll = null;
    this.freeDraftChanged();
    return entry;
  },

  pickUpFree(spot) {
    const pending = this.freePendingAt(spot);
    const fromDraft = pending && !pending.remove ? pending : null;
    const source = fromDraft ? fromDraft.entry : this.freeTargetAt(spot);
    if (!source) return null;
    let item = fromDraft;
    if (fromDraft) this.freeDraft = this.freeDraft.filter((other) => other !== fromDraft);
    else {
      item = { entry: source, remove: true };
      this.freeDraft.push(item);
    }
    const def = getDecoration(source.key);
    const place = def ? decoPlacement(def, source) : null;
    const { cx, cz, offsetX, offsetZ, liftY, deck, level, rotation, scale, exact, ...rest } = source;
    const defScale = def && Number.isFinite(def.scale) ? def.scale : 1;
    const base = { ...rest, rotation: place ? round3(place.yaw / (Math.PI / 2)) : rotation || 0 };
    const size = place ? place.scale / defScale : scale;
    if (Number.isFinite(size) && Math.abs(size - 1) > 0.001) base.scale = round3(size);
    this.freeCarry = { base, item, fromDraft };
    this.freeDraftChanged();
    return source;
  },

  cancelCarry() {
    const carry = this.freeCarry;
    if (!carry) return false;
    this.freeCarry = null;
    if (carry.fromDraft) this.freeDraft.push(carry.fromDraft);
    else this.freeDraft = this.freeDraft.filter((other) => other !== carry.item);
    this.freeDraftChanged();
    return true;
  },

  turnCarry(direction) {
    if (!this.freeCarry) return false;
    this.freeCarry.base.rotation = round3((this.freeCarry.base.rotation || 0) + direction * 0.5);
    return true;
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
    if (!this.freeDraft.length && !this.freeCarry) return false;
    this.freeDraft = [];
    this.freeCarry = null;
    this.freeDraftChanged();
    return true;
  },

  applyFreeDraft() {
    this.cancelCarry();
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

  freeMoves() {
    return this.freeDraft.filter((item) => item.movedFrom).map((item) => item.entry);
  },

  freeDraftChanged() {
    if (this.onFreeDraftChange) this.onFreeDraftChange(this.freeDraft);
  },
};
