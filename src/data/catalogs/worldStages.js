// Etapy stavby světa pro načítací obrazovku — názvy i pořadí vycházejí z druhů
// objektů v katalogu dekorací, takže nová kategorie se objeví sama.
import { getDecoration } from './decorations.js';

const KIND_ORDER = ['floor', 'path', 'water', 'ground', 'cliff', 'tree', 'prop', 'ore'];

const KIND_LABELS = {
  floor: 'Pokládám podlahu',
  water: 'Zaplňuji vodu',
  path: 'Stavím cesty',
  cliff: 'Modeluji kopce',
  tree: 'Sázím stromy',
  ground: 'Rozmisťuji trávu',
  prop: 'Stavím tábořiště',
  ore: 'Zakládám rudu',
};

const KIND_GROUP = { campfire: 'prop' };

const STAGE_PARTS = {
  floor: ['floor'],
  path: ['path', 'manual'],
  water: ['water'],
  ground: ['clearing'],
  cliff: ['deco'],
  tree: ['deco'],
  prop: ['deco'],
  ore: ['deco'],
};

export function describeWorld(layout) {
  const groups = new Map();
  const add = (kind, key) => {
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(key);
  };
  for (const entry of layout.floor || []) add('floor', entry.key);
  for (const entry of layout.water || []) add('water', entry.key);
  for (const entry of layout.path || []) add('path', entry.key);
  for (const entry of layout.manual || []) add('path', entry.key);
  for (const entry of layout.clearing || []) add('ground', entry.key);
  for (const entry of layout.decorations || []) {
    const def = getDecoration(entry.key);
    if (!def) continue;
    const kind = def.kind || 'prop';
    add(KIND_GROUP[kind] || kind, entry.key);
  }
  const stages = [];
  const push = (kind, keys) => {
    const parts = STAGE_PARTS[kind] || ['deco'];
    stages.push({ kind, label: labelFor(kind), total: keys.length, keys, parts });
  };
  for (const kind of KIND_ORDER) {
    const keys = groups.get(kind);
    if (keys && keys.length) {
      push(kind, keys);
      groups.delete(kind);
    }
  }
  for (const [kind, keys] of groups) push(kind, keys);
  return stages;
}

function labelFor(kind) {
  return KIND_LABELS[kind] || 'Stavím svět';
}
