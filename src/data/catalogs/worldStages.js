// Etapy stavby světa pro načítací obrazovku — názvy i pořadí vycházejí z druhů
// objektů v katalogu dekorací, takže nová kategorie se objeví sama. Navíc nápisy kroků stavby terénu.
import { getDecoration } from './decorations.js';

const KIND_ORDER = ['floor', 'path', 'ground', 'tree', 'prop', 'rock'];

const KIND_LABELS = {
  floor: 'Rovnám podlahu, ať si nezvrtneš kotník',
  path: 'Ušlapávám cestičky',
  tree: 'Sázím stromy, jen ať mi neutečou',
  ground: 'Rozhazuji kvítí a keře',
  prop: 'Stavím tábor, táta kuchtí',
  rock: 'Kulím balvany',
};

const KIND_GROUP = { campfire: 'prop' };

export const TERRAIN_STEP_LABELS = {
  field: 'Měřím, kde je kopec a kde důlek',
  caveSurface: 'Hloubím jeskyně',
  surface: 'Kladu trávu a písek',
  mass: 'Podkládám ostrov skálou',
  grid: 'Kreslím čtverečky do mapy',
  water: 'Napouštím moře a řeky',
};

function entriesOf(layout, part) {
  if (part === 'deco') return layout.decorations || [];
  return layout[part] || [];
}

export function describeWorld(layout) {
  const groups = new Map();
  const add = (kind, key) => {
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(key);
  };
  for (const entry of layout.floor || []) add('floor', entry.key);
  for (const entry of layout.path || []) add('path', 'path');
  for (const entry of layout.clearing || []) add('ground', entry.key);
  for (const entry of layout.decorations || []) {
    const def = getDecoration(entry.key);
    if (!def) continue;
    const kind = def.kind || 'prop';
    add(KIND_GROUP[kind] || kind, entry.key);
  }
  const stages = [];
  const push = (kind, keys) => {
    const total = countPieces(layout, new Set(keys));
    if (total > 0) stages.push({ kind, label: labelFor(kind), total, keys });
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

export function stagePieces(layout, stage) {
  const keys = new Set(stage.keys);
  const parts = ['deco', 'floor', 'path', 'clearing'];
  const out = [];
  for (const part of parts) {
    for (const entry of entriesOf(layout, part)) {
      if (keys.has(part === 'path' ? 'path' : entry.key)) out.push(entry);
    }
  }
  return out;
}

function countPieces(layout, keys) {
  let total = 0;
  for (const part of ['deco', 'floor', 'path', 'clearing']) {
    for (const entry of entriesOf(layout, part)) {
      if (!keys.has(part === 'path' ? 'path' : entry.key)) continue;
      const def = getDecoration(part === 'path' ? 'path' : entry.key);
      if (!def) continue;
      total += 1;
    }
  }
  return total;
}

function labelFor(kind) {
  return KIND_LABELS[kind] || 'Stavím svět';
}
