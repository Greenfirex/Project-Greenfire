// Jména jeskyní — jméno patří souvislé jeskyni v patře (všem buňkám, kam se dojde bez vyjití ven), ne celému patru.
// V mapě se ukládá jen jméno a jedna buňka jeskyně; zbytek se dopočítá, takže jméno roste s jeskyní.
import { levelOfEntry } from './areaShape.js';

const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const CAVE_NAME_MAX = 32;

function cellsOfLevel(layout, level) {
  const cells = new Set();
  for (const entry of (layout && layout.floor) || []) {
    if (entry && levelOfEntry(entry) === level) cells.add(`${entry.cx},${entry.cz}`);
  }
  return cells;
}

function flood(cells, cx, cz) {
  const region = new Set();
  const start = `${cx},${cz}`;
  if (!cells.has(start)) return region;
  const queue = [[cx, cz]];
  region.add(start);
  while (queue.length) {
    const [x, z] = queue.pop();
    for (const [dx, dz] of AROUND) {
      const key = `${x + dx},${z + dz}`;
      if (region.has(key) || !cells.has(key)) continue;
      region.add(key);
      queue.push([x + dx, z + dz]);
    }
  }
  return region;
}

export function caveNamesOf(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && Number.isInteger(item.level) && item.level !== 0 && Number.isInteger(item.cx) && Number.isInteger(item.cz) && typeof item.name === 'string' && item.name.trim())
    .map((item) => ({ level: item.level, cx: item.cx, cz: item.cz, name: item.name.trim().slice(0, CAVE_NAME_MAX) }));
}

export function caveRegion(layout, level, cx, cz) {
  return flood(cellsOfLevel(layout, level), cx, cz);
}

export function caveNameIndex(layout) {
  const index = new Map();
  const levels = new Map();
  for (const item of caveNamesOf(layout && layout.caveNames)) {
    if (!levels.has(item.level)) levels.set(item.level, cellsOfLevel(layout, item.level));
    const id = `${item.level}@${item.cx},${item.cz}`;
    for (const key of flood(levels.get(item.level), item.cx, item.cz)) {
      if (!index.has(`${item.level}|${key}`)) index.set(`${item.level}|${key}`, { name: item.name, id });
    }
  }
  return index;
}

export function caveNameAt(index, level, cx, cz) {
  return index.get(`${level}|${cx},${cz}`) || null;
}
