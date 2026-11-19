// Stavby skládané z dílů na mřížce — rozměr v buňkách, prkenná podlaha a stěny z klád s otvory.
// Strany a otvory jsou v neotočené stavbě; otočení z mapy se použije na celek. Plán je v DEV.md, sekce „Stavby".
import { PLANKS_TEXTURE, LOG_TEXTURE, LOG_NORMAL } from './assetPaths.js';

export const BUILDINGS = {
  pirate_cabin: {
    displayName: 'Opuštěný pirátský srub',
    width: 4,
    depth: 3,
    shift: [0, 0.25],
    age: {
      moss: [0.5, 0.66, 0.3],
      mossAmount: 0.7,
      mossHeight: 0.9,
      grime: 0.55,
      noiseScale: 1.3,
      bleach: [2.1, 2.0, 1.85],
      bleachAmount: 1,
      bleachScale: 1.1,
      streak: 0.6,
      streakScale: 4.5,
    },
    floor: {
      texture: PLANKS_TEXTURE,
      tile: 2,
      texturePlanks: 12,
      lift: 0.3,
      tint: [0.62, 0.55, 0.47],
      shadeSpread: 0.3,
      plank: 0.24,
      gap: 0.012,
      thickness: 0.04,
      warp: 0.012,
      tilt: 0.02,
      pieceMin: 1.4,
      pieceMax: 3.4,
      missing: 0.035,
      broken: 0.08,
      rotten: 0.08,
      rotSag: 0.06,
      joist: 0.09,
      joistSpacing: 1.3,
      post: 0.2,
      postSpacing: 2,
      postInset: 0.2,
      postSink: 0.25,
      postLean: 0.12,
      stepKey: 'planks',
    },
    walls: {
      sides: ['north', 'south', 'west', 'east'],
      texture: LOG_TEXTURE,
      normal: LOG_NORMAL,
      tile: 1.2,
      log: 0.28,
      logSpread: 0.18,
      spacing: 0.84,
      height: 2.5,
      overhang: 0.34,
      endSpread: 0.26,
      sag: 0.09,
      bow: 0.08,
      taper: 0.2,
      bulge: 0.07,
      lift: 0.05,
      segments: 8,
      logSides: 10,
      shadeSpread: 0.22,
      brokenTop: 0.35,
      cutSpread: 0.12,
      tint: [1, 1, 1],
      weather: 1,
      vineStep: 0.9,
      ends: { wood: '#9c8468', ring: '#5c4636', crack: '#3a2c22', bark: '#3b3029' },
      openings: [
        { side: 'north', at: 1, width: 1.3, bottom: 0, top: 2.35, kind: 'cave' },
        { side: 'south', at: 1.4, width: 1.1, bottom: 0, top: 1.95, kind: 'door' },
        { side: 'south', at: -2.0, width: 0.9, bottom: 0.95, top: 1.7, kind: 'window' },
        { side: 'west', at: 0.3, width: 0.9, bottom: 0.95, top: 1.7, kind: 'window' },
        { side: 'east', at: -0.6, width: 0.8, bottom: 1.0, top: 1.65, kind: 'window' },
      ],
    },
    porch: {
      depth: 2.1,
      from: -4,
      to: 4,
      post: 0.09,
      postSink: 0.3,
      lean: 0.12,
      planks: { missing: 0.12, broken: 0.18, rotten: 0.18, rotSag: 0.14, tilt: 0.05, warp: 0.02, pieceMin: 1, pieceMax: 2.1 },
      rail: { height: 0.95, low: 0.48, radius: 0.05, missing: 0.25, broken: 0.35, fallTo: 0.7 },
      steps: { at: 1.4, width: 1.2, rise: 0.2, run: 0.34, log: 0.075, missing: 0.12, broken: 0.3, brokenDrop: 0.15 },
    },
    props: {
      flag: {
        at: [-3.8, 5.0],
        height: 3.6,
        lean: 0.28,
        radius: 0.06,
        size: [1.15, 0.78],
        dir: 1,
        droop: 0.22,
        wave: 0.1,
        colors: { cloth: '#1c1a19', stain: '#5a4a38', bone: '#d8cfba' },
      },
      net: {
        at: -0.35,
        width: 1.7,
        height: 1.45,
        top: 2.15,
        sag: 0.3,
        bulge: 0.08,
        colors: { rope: '#8c7a58', float: '#a0703a' },
      },
    },
  },
};

export function getBuilding(key) {
  return BUILDINGS[key] || null;
}

export function buildingSize(entry) {
  const def = getBuilding(entry && entry.key);
  if (!def) return null;
  const turned = ((((entry.rotation || 0) % 4) + 4) % 4) % 2 === 1;
  return turned ? { width: def.depth, depth: def.width } : { width: def.width, depth: def.depth };
}

export function buildingCellKeys(entries) {
  const keys = new Set();
  for (const entry of entries || []) {
    for (const [cx, cz] of buildingCells(entry)) keys.add(`${cx},${cz}`);
  }
  return keys;
}

export function buildingCells(entry) {
  const size = buildingSize(entry);
  if (!size) return [];
  const cells = [];
  for (let x = 0; x < size.width; x += 1) {
    for (let z = 0; z < size.depth; z += 1) cells.push([entry.cx + x, entry.cz + z]);
  }
  return cells;
}
