// Pomocné výpočty k dlaždicím mapy a rozsah výšek editoru.
// Nezná scénu ani editor, jen katalog dekorací.
import { getDecoration, decoRadius } from '../catalogs/decorations.js';
import { decoPlacement } from '../../utils/decoPlacement.js';

export const MIN_HEIGHT = -60;
export const MAX_HEIGHT = 96;
export const HEIGHT_STEP = 0.25;
export const DEFAULT_HEIGHT_LEVEL = 0;
export const HEIGHT_PRESETS = [-60, -40, -20, 0, 20, 40, 60, 80, 96];

export function formatMeters(meters) {
  const value = Math.round((Number(meters) || 0) * 100) / 100;
  return `${String(value).replace('.', ',').replace('-', '−')} m`;
}
export function deriveBlocked(entries) {
  const out = [];
  for (const entry of entries) {
    if (entry.blocks === false) continue;
    const def = getDecoration(entry.key);
    if (!def || def.blocks === false) continue;
    const place = decoPlacement(def, entry);
    const shape = { cx: entry.cx, cz: entry.cz, offsetX: place.offsetX - place.jitterX, offsetZ: place.offsetZ - place.jitterZ, radius: decoRadius(def) };
    if (def.box) {
      const size = place.scale / (def.scale || 1);
      shape.box = [def.box[0] * size, def.box[1] * size];
      shape.yaw = place.yaw;
    }
    out.push(shape);
  }
  return out;
}

