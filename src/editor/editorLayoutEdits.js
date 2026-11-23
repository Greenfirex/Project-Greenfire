// Část editoru: drobné úpravy mapy po buňkách — položit, přebarvit, zvednout, srovnat a smazat.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { getDecoration, DEFAULT_FLOOR, decoFamily } from '../data/catalogs/decorations.js';
import { cellKey } from '../utils/gridMath.js';
import { PLANE_LAYERS, layerAt, layerEntriesAt, floorCellAt, dropLayerCell, worldCells, levelOfEntry } from '../data/maps/areaShape.js';
import { bridgeCells } from '../utils/bridgeShape.js';
import { onSurface } from './editorSettings.js';

export default {
  dropStackableDecorations(cx, cz, level = 0) {
    const entries = this.layout.decorations || [];
    const kept = entries.filter((entry) => {
      if (!entry || entry.cx !== cx || entry.cz !== cz || levelOfEntry(entry) !== level) return true;
      const def = getDecoration(entry.key);
      return !def || !def.stackable;
    });
    if (kept.length === entries.length) return false;
    this.layout.decorations = kept;
    return true;
  },

  dropOrphans() {
    const grid = new Set(worldCells(this.layout).map(([cx, cz]) => cellKey(cx, cz)));
    const kept = (this.layout.decorations || []).filter((entry) => entry && (levelOfEntry(entry) !== 0 || grid.has(cellKey(entry.cx, entry.cz))));
    if (kept.length === (this.layout.decorations || []).length) return false;
    this.layout.decorations = kept;
    return true;
  },

  layerTileAt(cx, cz) {
    const entries = layerEntriesAt(this.layout, cx, cz);
    return entries.length ? entries[0] : null;
  },

  topEntryAt(cx, cz) {
    const tile = this.layerTileAt(cx, cz);
    if (tile) return tile;
    const list = this.layout.decorations || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].cx === cx && list[i].cz === cz && levelOfEntry(list[i]) === this.paintLevel) return list[i];
    }
    return null;
  },

  placeEntry(key, cx, cz, rotation = 0, liftY = 0, layer = null) {
    const entry = { key, cx, cz, rotation: ((rotation % 4) + 4) % 4 };
    if (liftY) entry.liftY = liftY;
    const floor = floorCellAt(this.layout, cx, cz);
    if (layer === 'path') {
      delete entry.key;
      entry.style = this.pathStyle;
      if (floor && floor.liftY) entry.liftY = floor.liftY;
      const existing = (this.layout.path || []).find((cell) => onSurface(cell, cx, cz));
      if (existing) {
        existing.style = entry.style;
        if (entry.liftY) existing.liftY = entry.liftY;
      } else {
        this.layout.path.push(entry);
      }
      return entry;
    }
    const target = layer || 'floor';
    if (target === 'floor') {
      dropLayerCell(this.layout, cx, cz);
      for (const name of ['grass', 'clearing']) {
        if ((this.layout[name] || []).some((item) => onSurface(item, cx, cz) && item.liftY)) continue;
        this.layout[name] = (this.layout[name] || []).filter((item) => !onSurface(item, cx, cz));
      }
    } else {
      if (!entry.liftY && floor && floor.liftY) entry.liftY = floor.liftY;
      dropLayerCell(this.layout, cx, cz);
      if (floor && !(this.layout.floor || []).includes(floor)) this.layout.floor.push(floor);
      if (!floor) this.placeFloor(DEFAULT_FLOOR, cx, cz);
    }
    this.layout[target].push(entry);
    return entry;
  },

  paintSurface(cx, cz, key) {
    const def = getDecoration(key);
    if (!def) return false;
    const level = this.paintLevel;
    const floor = floorCellAt(this.layout, cx, cz, level);
    if (!floor && level !== 0) return false;
    const changed = !floor || floor.key !== key;
    if (floor) {
      floor.key = key;
    } else {
      if (!this.layout.floor) this.layout.floor = [];
      const entry = { key, cx, cz, rotation: 0 };
      const lift = this.cellHeightValue(cx, cz);
      if (lift) entry.liftY = lift;
      this.layout.floor.push(entry);
    }
    if (changed && this.layout.grass) {
      this.layout.grass = this.layout.grass.filter((entry) => !(entry && entry.cx === cx && entry.cz === cz && levelOfEntry(entry) === level));
    }
    return changed;
  },

  placePath(cx, cz) {
    return this.placeEntry('path', cx, cz, 0, 0, 'path');
  },

  keepFloor(cx, cz) {
    const floor = floorCellAt(this.layout, cx, cz);
    return floor ? floor.key : DEFAULT_FLOOR;
  },

  placeFloor(key, cx, cz) {
    this.layout.floor.push({ key, cx, cz, rotation: 0 });
  },

  fixMissingFloor() {
    const cells = worldCells(this.layout);
    if (!cells.length) return 0;
    const seen = new Set();
    for (const [cx, cz] of cells) seen.add(cellKey(cx, cz));
    const place = (cx, cz) => {
      const floorKey = this.keepFloor(cx, cz);
      if (!getDecoration(floorKey)) return;
      this.layout.floor.push({ key: floorKey, cx, cz, rotation: 0 });
    };
    for (const entry of this.layout.decorations || []) {
      if (!entry || levelOfEntry(entry) !== 0) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (seen.has(key)) continue;
      seen.add(key);
      place(entry.cx, entry.cz);
    }
    return seen.size;
  },

  setTileLift(cx, cz, height) {
    const layer = layerAt(this.layout, cx, cz);
    const path = layer === 'path'
      ? (this.layout.path || []).find((entry) => onSurface(entry, cx, cz)) || null
      : null;
    const targets = [];
    const floor = floorCellAt(this.layout, cx, cz);
    if (floor) targets.push(floor);
    for (const name of ['floor', 'clearing', 'grass']) {
      for (const entry of this.layout[name] || []) {
        if (!onSurface(entry, cx, cz)) continue;
        if (!targets.includes(entry)) targets.push(entry);
      }
    }
    if (path && !targets.includes(path)) targets.push(path);
    if (!targets.length) return null;
    for (const entry of targets) {
      if (height) entry.liftY = height;
      else delete entry.liftY;
    }
    return floor || path || targets[0];
  },

  setCellHeight(cx, cz, height) {
    const value = Number(height);
    if (!Number.isFinite(value)) return null;
    const floor = floorCellAt(this.layout, cx, cz);
    if (!floor) this.placeFloor(this.keepFloor(cx, cz), cx, cz);
    this.setTileLift(cx, cz, value);
    this.groundDecorations(cx, cz, value);
    return value;
  },

  groundDecorations(cx, cz, height) {
    const next = Math.round(height * 1000) / 1000;
    for (const entry of this.layout.decorations || []) {
      if (!onSurface(entry, cx, cz)) continue;
      if (next) entry.liftY = next;
      else delete entry.liftY;
    }
  },

  applyEraser(zone) {
    const kind = this.eraseKind;
    if (!kind) return 0;
    let changed = 0;
    for (const { cx, cz } of zone) {
      if (this.eraseCell(cx, cz, kind)) changed += 1;
    }
    if (kind === 'terrain') this.cleanFlatCliffs(zone.map((cell) => [cell.cx, cell.cz]));
    else this.dropOrphans();
    return changed;
  },

  eraseCell(cx, cz, kind) {
    const plants = kind === 'plants' || kind === 'all';
    const objects = kind === 'objects' || kind === 'all';
    const surface = this.paintLevel === 0;
    let dropped = false;
    if (plants || objects) {
      const removed = this.dropDecorations(cx, cz, (entry) => {
        const family = decoFamily(entry.key);
        if (family === 'plant') return plants;
        return objects && family === 'object';
      });
      if (removed) dropped = true;
    }
    if (surface && plants && this.dropGrassCell(cx, cz)) dropped = true;
    if (surface && (kind === 'path' || kind === 'all') && this.dropPathCell(cx, cz)) dropped = true;
    if (kind === 'creatures' || kind === 'all') {
      if (this.dropCreatureCell(cx, cz)) dropped = true;
      if (this.dropFishCell(cx, cz)) dropped = true;
      if (this.dropCrabCell(cx, cz)) dropped = true;
    }
    if (surface && kind === 'terrain') {
      if (this.flattenCell(cx, cz)) dropped = true;
      if (this.dropBridgeCell(cx, cz)) dropped = true;
    }
    if (surface && kind === 'all' && this.dropBridgeCell(cx, cz)) dropped = true;
    return dropped;
  },

  dropDecorations(cx, cz, test) {
    const entries = this.layout.decorations || [];
    const kept = entries.filter((entry) => {
      if (!entry || entry.cx !== cx || entry.cz !== cz || levelOfEntry(entry) !== this.paintLevel) return true;
      return !test(entry);
    });
    if (kept.length === entries.length) return false;
    this.layout.decorations = kept;
    return true;
  },

  dropPathCell(cx, cz) {
    const entries = this.layout.path || [];
    const kept = entries.filter((entry) => !onSurface(entry, cx, cz));
    if (kept.length === entries.length) return false;
    this.layout.path = kept;
    return true;
  },

  dropCreatureCell(cx, cz) {
    if (!Array.isArray(this.layout.creatures)) return false;
    const entries = this.layout.creatures;
    const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz || levelOfEntry(entry) !== this.paintLevel);
    if (kept.length === entries.length) return false;
    this.layout.creatures = kept;
    return true;
  },

  dropFishCell(cx, cz) {
    const entries = this.layout.fish || [];
    const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz || levelOfEntry(entry) !== this.paintLevel);
    if (kept.length === entries.length) return false;
    this.layout.fish = kept;
    return true;
  },

  dropCrabCell(cx, cz) {
    if (this.paintLevel !== 0) return false;
    const entries = this.layout.crabs || [];
    const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
    if (kept.length === entries.length) return false;
    this.layout.crabs = kept;
    return true;
  },

  dropBridgeCell(cx, cz) {
    const bridges = this.layout.bridges || [];
    const kept = bridges.filter((record) => !bridgeCells(record).some(([x, z]) => x === cx && z === cz));
    if (kept.length === bridges.length) return false;
    this.layout.bridges = kept;
    return true;
  },

  flattenCell(cx, cz) {
    let changed = false;
    for (const name of PLANE_LAYERS) {
      for (const entry of this.layout[name] || []) {
        if (!onSurface(entry, cx, cz)) continue;
        if (entry.liftY) {
          delete entry.liftY;
          changed = true;
        }
        if (entry.cliff) {
          delete entry.cliff;
          delete entry.cliffStyle;
          changed = true;
        }
      }
    }
    return changed;
  },

  dropGrassCell(cx, cz) {
    if (!this.layout.grass) return false;
    const entries = this.layout.grass;
    const kept = entries.filter((entry) => !onSurface(entry, cx, cz));
    if (kept.length === entries.length) return false;
    this.layout.grass = kept;
    return true;
  },
};
