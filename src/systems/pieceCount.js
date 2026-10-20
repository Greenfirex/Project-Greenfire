// Kolik kvádrů se z jednoho modelu kopce opravdu postaví — sdílí to stavba světa i počítadlo kroků.
export function pieceCount(def) {
  if (!def) return 0;
  return def.height >= 2 ? Math.max(Math.floor(def.height / 2), 1) : 1;
}