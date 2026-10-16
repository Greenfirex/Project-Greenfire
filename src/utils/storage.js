// Tenká obálka nad localStorage pro ukládání a načítání savů.
// Chrání hru před chybějícím/zaplněným/zakázaným úložištěm (try/catch).
const memory = new Map();

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

export function readRaw(key) {
  if (!hasLocalStorage()) return memory.has(key) ? memory.get(key) : null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key, value) {
  if (!hasLocalStorage()) {
    memory.set(key, value);
    return true;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeRaw(key) {
  if (!hasLocalStorage()) {
    memory.delete(key);
    return true;
  }
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key) {
  const raw = readRaw(key);
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJSON(key, data) {
  let raw;
  try {
    raw = JSON.stringify(data);
  } catch {
    return false;
  }
  return writeRaw(key, raw);
}

export function removeJSON(key) {
  return removeRaw(key);
}
