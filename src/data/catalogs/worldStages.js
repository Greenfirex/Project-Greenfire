// Etapy stavby světa pro načítací obrazovku — názvy i pořadí vycházejí z druhů
// objektů v katalogu dekorací, takže nová kategorie se objeví sama.
import { getDecoration } from './decorations.js';
import { pieceCount } from '../../systems/pieceCount.js';

const KIND_ORDER = ['floor', 'path', 'water', 'ground', 'cliff', 'tree', 'log', 'prop', 'rock', 'ore'];

const KIND_LABELS = {
  floor: 'Rovnám podlahu, ať si nezvrtneš kotník',
  water: 'Napouštím rybník',
  path: 'Ušlapávám cestičky',
  cliff: 'Hrnu kopce lopatou',
  tree: 'Sázím stromy, jen ať mi neutečou',
  log: 'Kutálím kmeny',
  ground: 'Rozhazuji kvítí a keře',
  prop: 'Stavím tábor, táta kuchtí',
  rock: 'Kulím balvany',
  ore: 'Zakopávám rudu, ať ji najdeš jen ty',
};

const KIND_GROUP = { campfire: 'prop' };

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
  for (const entry of layout.water || []) add('water', entry.key);
  for (const entry of layout.path || []) add('path', entry.key);
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
  const parts = ['deco', 'floor', 'path', 'water', 'clearing'];
  const out = [];
  for (const part of parts) {
    for (const entry of entriesOf(layout, part)) {
      if (keys.has(entry.key)) out.push(entry);
    }
  }
  return out;
}

function countPieces(layout, keys) {
  let total = 0;
  for (const part of ['deco', 'floor', 'path', 'water', 'clearing']) {
    for (const entry of entriesOf(layout, part)) {
      if (!keys.has(entry.key)) continue;
      const def = getDecoration(entry.key);
      if (!def) continue;
      total += pieceCount(def);
    }
  }
  return total;
}

function labelFor(kind) {
  return KIND_LABELS[kind] || 'Stavím svět';
}
