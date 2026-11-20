// Stavby skládané z dílů na mřížce — rozměr v buňkách, prkenná podlaha a stěny z klád s otvory.
// Strany a otvory jsou v neotočené stavbě; otočení z mapy se použije na celek. Plán je v DEV.md, sekce „Stavby".
import { ASSET_DIRS, PLANKS_TEXTURE, LOG_TEXTURE, LOG_NORMAL } from './assetPaths.js';

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
      ringSeat: 0.84,
      insideCut: 1.1,
      tint: [1, 1, 1],
      weather: 1,
      vineStep: 0.9,
      vineChance: 0.7,
      vineDrape: 0.3,
      vineGap: 0.04,
      ends: { wood: '#9c8468', ring: '#5c4636', crack: '#3a2c22', bark: '#3b3029' },
      openings: [
        { side: 'north', at: 1, width: 1.3, bottom: 0, top: 2.35, kind: 'cave' },
        { side: 'south', at: 1.4, width: 1.1, bottom: 0, top: 1.95, kind: 'door' },
        { side: 'south', at: -2.0, width: 0.9, bottom: 0.95, top: 1.7, kind: 'window' },
        { side: 'west', at: 0.3, width: 0.9, bottom: 0.95, top: 1.7, kind: 'window' },
        { side: 'east', at: -0.6, width: 0.8, bottom: 1.0, top: 1.65, kind: 'window' },
      ],
    },
    upper: {
      room: [-3.7, 2, -2.7, 1],
      height: 2.3,
      sides: ['north', 'south', 'west', 'east'],
      joistOut: 0.25,
      moss: 0.15,
      planks: { missing: 0, broken: 0, rotten: 0.06, rotSag: 0.02, gap: 0.006 },
      subfloor: { missing: 0, broken: 0, rotten: 0, gap: 0.004 },
      openings: [
        { side: 'west', at: -2.1, width: 0.9, bottom: 0, top: 2.0, kind: 'door' },
        { side: 'east', at: 0.4, width: 1.0, bottom: 0, top: 2.0, kind: 'door' },
        { side: 'south', at: -1.2, width: 0.8, bottom: 0.9, top: 1.5, kind: 'window' },
      ],
      rail: { height: 0.95, low: 0.48, radius: 0.05, post: 0.085, lean: 0.1, spacing: 2, missing: 0.2, broken: 0.35, fallTo: 0.7 },
      rails: [
        { alongX: false, at: 4, from: -3, to: 3 },
        { alongX: true, at: -3, from: 2.3, to: 2.7 },
        { alongX: true, at: -3, from: 3.6, to: 4 },
        { alongX: true, at: 3, from: -4, to: 4 },
        { alongX: false, at: -4, from: 1.35, to: 3 },
      ],
      sideSteps: { x: 3.15, width: 0.9, edge: -3, dir: -1, reach: 1.2, rise: 0.18, run: 0.3, log: 0.07, missing: 0.1 },
      stairs: {
        x: -4.85,
        width: 1.0,
        bottom: 2.7,
        top: -1.9,
        landing: -3.0,
        wall: -4.0,
        rise: 0.23,
        log: 0.075,
        missing: 0.08,
        broken: 0.2,
        brokenDrop: 0.12,
        postStep: 1.4,
        postSink: 0.25,
        planks: { missing: 0.05, broken: 0.1, rotten: 0.1 },
        rail: { height: 0.95, low: 0.48, radius: 0.05, post: 0.085, lean: 0.08, spacing: 1.5, missing: 0.15, broken: 0.35, fallTo: 0.6 },
      },
    },
    roof: {
      model: `${ASSET_DIRS.props}cabin_roof/cabin_roof.glb`,
      length: 6.8,
      width: 4.7,
      pitch: 0.78,
      thatch: 0.35,
      vineStep: 0.55,
      vineChance: 0.5,
    },
    growth: {
      holes: { chance: 0.85, species: ['broadleaf', 'coastal', 'fern'], size: [1.2, 1.7] },
      edge: { step: 0.4, out: [-0.35, 0.9], chance: 0.8, species: ['broadleaf', 'fern', 'coastal', 'cushion'], size: [0.9, 1.5] },
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
        height: 5.2,
        lean: 0.28,
        radius: 0.06,
        size: [1.15, 0.78],
        dir: 1,
        droop: 0.22,
        wave: 0.1,
        colors: { cloth: '#1c1a19', stain: '#5a4a38', bone: '#d8cfba' },
      },
      barrels: {
        style: {
          height: 0.95, radius: 0.3, bulge: 0.14, sides: 16, staves: 16, texturePlanks: 12, tile: 1,
          hoops: [0.1, 0.32, 0.68, 0.9], hoopWidth: 0.05, hoopOut: 0.008,
          tint: [0.78, 0.64, 0.5], hoopTint: [0.2, 0.18, 0.17], shadeSpread: 0.25,
        },
        items: [
          { at: [-3.0, 4.4], on: 'porch' },
          { at: [-2.35, 4.6], on: 'porch', scale: 0.9 },
          { at: [3.3, 6.4], on: 'ground', lying: 'x' },
          { at: [3.45, 2.1], on: 'upper' },
          { at: [-2.7, 2.35], on: 'upper', scale: 0.85 },
        ],
      },
      crates: {
        style: { size: 0.6, thickness: 0.03, tile: 1.2, tint: [0.82, 0.7, 0.55], shadeSpread: 0.25 },
        items: [
          { at: [2.95, 4.3], on: 'porch', yaw: 0.3, open: true },
          { at: [3.55, 3.55], on: 'porch', yaw: -0.2, scale: 0.8 },
          { at: [3.2, -1.4], on: 'upper', yaw: 0.5 },
        ],
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
