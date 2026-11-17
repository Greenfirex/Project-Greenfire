// Hnízda a jejich hlídači — kde hnízda v mapě leží a které hnízdo tvor hlídá.
// Stejné pravidlo používá hra (útok po krádeži) i editor (zvýraznění), aby se nerozcházely.
import { getDecoration } from '../data/catalogs/decorations.js';
import { levelOfEntry } from '../data/maps/areaShape.js';
import { cellToWorld } from './gridMath.js';

export function nestSpots(layout) {
  const spots = [];
  for (const entry of (layout && layout.decorations) || []) {
    const def = entry && levelOfEntry(entry) === 0 ? getDecoration(entry.key) : null;
    if (!def || !def.nest) continue;
    spots.push({
      ...def.nest,
      cx: entry.cx,
      cz: entry.cz,
      x: cellToWorld(entry.cx) + (entry.offsetX || 0),
      z: cellToWorld(entry.cz) + (entry.offsetZ || 0),
    });
  }
  return spots;
}

export function guardedNest(nests, kind, x, z) {
  let best = null;
  let bestGap = Infinity;
  for (const nest of nests || []) {
    if (nest.guardedBy !== kind) continue;
    const gap = Math.hypot(nest.x - x, nest.z - z);
    if (gap > nest.guardLink || gap >= bestGap) continue;
    best = nest;
    bestGap = gap;
  }
  return best;
}
