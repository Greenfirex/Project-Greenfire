// Část editoru: dotazy na mapu — co je v buňce, kde stojí tvor, popis pro nápovědu a otisk mapy.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { PLANE_LAYERS, ENTRY_LAYERS, layerAt, levelOfEntry, worldCells } from '../data/maps/areaShape.js';
import { getCreatureType, getCreatureTier } from '../data/catalogs/creatures/index.js';

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export default {
  spawnCell() {
    const spawn = this.layout && this.layout.spawn;
    if (!spawn || !Number.isFinite(spawn.cx) || !Number.isFinite(spawn.cz)) return null;
    return { cx: spawn.cx, cz: spawn.cz };
  },

  fingerprint() {
    let sum = 0;
    let count = 0;
    for (const name of ENTRY_LAYERS) {
      for (const entry of (this.layout && this.layout[name]) || []) {
        if (!entry) continue;
        sum = (sum + hashText(JSON.stringify(entry))) >>> 0;
        count += 1;
      }
    }
    for (const entry of (this.layout && this.layout.bridges) || []) {
      if (!entry) continue;
      sum = (sum + hashText(JSON.stringify(entry))) >>> 0;
      count += 1;
    }
    const spawn = this.spawnCell();
    const water = this.layout && Number.isFinite(this.layout.waterLevel) ? this.layout.waterLevel : null;
    const head = `${count}|${sum}|${spawn ? `${spawn.cx},${spawn.cz}` : '-'}|${water}|${this.layout ? this.layout.seed : ''}`;
    return hashText(head);
  },

  creatureAt(cx, cz) {
    for (const entry of (this.layout && this.layout.creatures) || []) {
      if (entry && entry.cx === cx && entry.cz === cz) return entry;
    }
    return null;
  },

  creatureInfoAt(cx, cz) {
    const entry = this.creatureAt(cx, cz);
    if (!entry) return null;
    const type = getCreatureType(entry.kind);
    if (!type) return null;
    const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
    return { entry, type, tierKey, tier: getCreatureTier(type, tierKey) };
  },

  creatureTierFor(brushKey) {
    const brush = BRUSHES[brushKey];
    const type = brush && brush.creatureKind ? getCreatureType(brush.creatureKind) : null;
    if (!type || !type.tiers) return null;
    const style = this.styleFor(brushKey);
    return type.tiers[style] ? style : type.defaultTier;
  },

  creaturePreviewAt(cx, cz) {
    if (!this.active || this.mode !== 'zone') return null;
    if (this.draftMode === 'remove') return null;
    const brush = BRUSHES[this.brushKey];
    const type = brush && brush.creatureKind ? getCreatureType(brush.creatureKind) : null;
    if (!type) return null;
    const radius = Number(type.roamRadius);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    return { type, tierKey: this.creatureTierFor(this.brushKey), radius, cx, cz };
  },

  creatureMarks() {
    const list = this.layout && Array.isArray(this.layout.creatures) ? this.layout.creatures : [];
    const marks = [];
    for (const entry of list) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const type = getCreatureType(entry.kind);
      const radius = Number(type && type.roamRadius);
      if (!Number.isFinite(radius) || radius <= 0) continue;
      const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
      marks.push({ cx: entry.cx, cz: entry.cz, radius, kind: entry.kind, tierKey });
    }
    return marks;
  },

  decorationsAt(cx, cz) {
    const out = [];
    for (const entry of this.layout.decorations || []) {
      if (!entry || entry.cx !== cx || entry.cz !== cz) continue;
      const def = getDecoration(entry.key);
      out.push({ entry, def, name: def && def.displayName ? def.displayName : entry.key });
    }
    return out;
  },

  describeAt(cx, cz) {
    const layer = layerAt(this.layout, cx, cz);
    const entry = this.topEntryAt(cx, cz);
    const layerEntry = this.layerTileAt(cx, cz);
    const decorations = this.decorationsAt(cx, cz);
    const level = entry && Number.isFinite(entry.liftY) ? Math.round(entry.liftY / HEIGHT_STEP) : 0;
    return {
      brush: layer,
      entry,
      layerEntry,
      decorations,
      height: level || null,
      override: entry,
      isPath: layer === 'path',
      style: layer === 'path' ? (entry && entry.style ? entry.style : this.styleFor(this.brushKey)) : null,
      pool: this.brushPool(this.brushKey),
      key: cellKey(cx, cz),
      liftY: entry && entry.liftY ? entry.liftY : 0,
      creature: this.creatureInfoAt(cx, cz),
    };
  },

  presentCells() {
    if (!this.presentCache) {
      this.presentCache = new Set(worldCells(this.layout).map(([cx, cz]) => cellKey(cx, cz)));
    }
    return this.presentCache;
  },

  contentAt(cx, cz) {
    const index = this.contentIndexFor();
    return index.get(cellKey(cx, cz)) || null;
  },

  contentIndexFor() {
    if (this.contentIndex) return this.contentIndex;
    const index = new Map();
    const cellFor = (cx, cz) => {
      const key = cellKey(cx, cz);
      let cell = index.get(key);
      if (!cell) {
        cell = { path: null, floor: null, clearing: null, grass: null, deco: null };
        index.set(key, cell);
      }
      return cell;
    };
    for (const name of PLANE_LAYERS) {
      for (const entry of this.layout[name] || []) {
        if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) || levelOfEntry(entry) !== 0) continue;
        cellFor(entry.cx, entry.cz)[name] = entry;
      }
    }
    for (const entry of this.layout.decorations || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      cellFor(entry.cx, entry.cz).deco = entry;
    }
    this.contentIndex = index;
    return index;
  },
};
