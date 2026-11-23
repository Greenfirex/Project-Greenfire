// Část editoru: dotazy na mapu — co je v buňce, kde stojí tvor, popis pro nápovědu a otisk mapy.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { BRUSHES } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { cellKey, cellToWorld } from '../utils/gridMath.js';
import { nestSpots, guardedNest } from '../utils/nestGuard.js';
import { PLANE_LAYERS, ENTRY_LAYERS, levelOfEntry, worldCells } from '../data/maps/areaShape.js';
import { getCreatureType, getCreatureTier, creatureStat } from '../data/catalogs/creatures/index.js';

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
    const bodies = JSON.stringify([(this.layout && this.layout.lakes) || [], (this.layout && this.layout.rivers) || [], (this.layout && this.layout.connectors) || []]);
    const head = `${count}|${sum}|${spawn ? `${spawn.cx},${spawn.cz}` : '-'}|${water}|${bodies}|${this.layout ? this.layout.seed : ''}|${JSON.stringify((this.layout && this.layout.floorNames) || {})}`;
    return hashText(head);
  },

  creatureAt(cx, cz) {
    for (const entry of (this.layout && this.layout.creatures) || []) {
      if (entry && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === this.paintLevel) return entry;
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

  creatureRangeInfo(type, tier) {
    if (!type) return { radius: 0, radiusKind: 'none' };
    const roam = Number(type.roamRadius);
    if (Number.isFinite(roam) && roam > 0) return { radius: roam, radiusKind: 'roam' };
    const notice = Number(creatureStat(type, tier, 'aggroRange'));
    if (Number.isFinite(notice) && notice > 0) return { radius: notice, radiusKind: 'notice' };
    return { radius: 0, radiusKind: 'none' };
  },

  creaturePreviewAt(cx, cz) {
    if (!this.active || this.mode !== 'zone') return null;
    if (this.draftMode === 'remove') return null;
    const brush = BRUSHES[this.brushKey];
    const type = brush && brush.creatureKind ? getCreatureType(brush.creatureKind) : null;
    if (!type) return null;
    const tierKey = this.creatureTierFor(this.brushKey);
    const range = this.creatureRangeInfo(type, getCreatureTier(type, tierKey));
    return { type, tierKey, radius: range.radius, radiusKind: range.radiusKind, cx, cz };
  },

  creatureMarks() {
    const list = this.layout && Array.isArray(this.layout.creatures) ? this.layout.creatures : [];
    const marks = [];
    for (const entry of list) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) || levelOfEntry(entry) !== this.paintLevel) continue;
      const type = getCreatureType(entry.kind);
      if (!type) continue;
      const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
      const range = this.creatureRangeInfo(type, getCreatureTier(type, tierKey));
      marks.push({
        cx: entry.cx,
        cz: entry.cz,
        level: levelOfEntry(entry),
        radius: range.radius,
        radiusKind: range.radiusKind,
        kind: entry.kind,
        tierKey,
        pack: Boolean(entry.pack),
      });
    }
    return marks;
  },

  nestMarks() {
    if (this.paintLevel !== 0) return [];
    const nests = nestSpots(this.layout).map((nest) => ({ ...nest, guards: [] }));
    for (const entry of (this.layout && this.layout.creatures) || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) || levelOfEntry(entry) !== 0) continue;
      const type = getCreatureType(entry.kind);
      const nest = type ? guardedNest(nests, entry.kind, cellToWorld(entry.cx), cellToWorld(entry.cz)) : null;
      if (!nest) continue;
      const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
      nest.guards.push({ cx: entry.cx, cz: entry.cz, kind: entry.kind, tierKey });
    }
    return nests;
  },

  decorationsAt(cx, cz) {
    const out = [];
    for (const entry of this.layout.decorations || []) {
      if (!entry || entry.cx !== cx || entry.cz !== cz || levelOfEntry(entry) !== this.paintLevel) continue;
      const def = getDecoration(entry.key);
      out.push({ entry, def, name: def && def.displayName ? def.displayName : entry.key });
    }
    return out;
  },

  describeAt(cx, cz) {
    const entry = this.topEntryAt(cx, cz);
    return {
      layerEntry: this.layerTileAt(cx, cz),
      decorations: this.decorationsAt(cx, cz),
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
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz) || levelOfEntry(entry) !== 0) continue;
      cellFor(entry.cx, entry.cz).deco = entry;
    }
    this.contentIndex = index;
    return index;
  },
};
