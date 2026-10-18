// Deterministický generátor náhodných čísel — stejný seed dá vždy stejnou mapu.
// Používá ho generátor map i editační zóny.
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function seedFor(baseSeed, label, cx, cz) {
  let h = (baseSeed >>> 0) ^ 0x811c9dc5;
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ ((cx | 0) + 0x9e3779b9), 16777619) >>> 0;
  h = Math.imul(h ^ ((cz | 0) + 0x85ebca6b), 16777619) >>> 0;
  return h >>> 0;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
