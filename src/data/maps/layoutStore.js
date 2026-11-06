// Pomocné výpočty k dlaždicím mapy a rozsah výšek editoru.
// Nezná scénu ani editor, jen katalog dekorací.
import { getDecoration, decoRadius, decoFootprint } from '../catalogs/decorations.js';

export const MIN_HEIGHT = -50;
export const MAX_HEIGHT = 80;
export const HEIGHT_STEP = 0.3;
export const DEFAULT_HEIGHT_LEVEL = 0;
export const HEIGHT_PRESETS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 60, 80];
export function deriveBlocked(entries) {
  const out = [];
  for (const entry of entries) {
    if (entry.blocks === false) continue;
    const def = getDecoration(entry.key);
    if (!def || def.blocks === false) continue;
    const footprint = decoFootprint(def);
    const shape = footprint
      ? { footprint, turn: entry.rotation || 0 }
      : { radius: decoRadius(def) };
    out.push({ cx: entry.cx, cz: entry.cz, offsetX: entry.offsetX || 0, offsetZ: entry.offsetZ || 0, ...shape });
  }
  return out;
}

export function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

