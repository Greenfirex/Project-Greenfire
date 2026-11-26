// Katalog nábytku (stůl, židle, truhla, sudy, bedny, kotva, lano, loďka, lavička), drobností na něj a pracovních míst
// (ponk). Vzhled a kusy pro editor; `surface` je výška desky pro drobnosti, `use` dělá z kusu pracovní místo na klik
// (výroba u ponku, rozsvícení lucerny). Tvary staví furnitureFactory.
import { PLANKS_TEXTURE_PLANKS } from './assetPaths.js';

export const LOG_END_COLORS = { wood: '#9c8468', ring: '#5c4636', crack: '#3a2c22', bark: '#3b3029' };

export const FURNITURE_WEAR = {
  moss: [0.46, 0.5, 0.3],
  mossAmount: 0.45,
  mossHeight: 0.9,
  grime: 0.55,
  noiseScale: 1.3,
  bleach: [1.3, 1.24, 1.05],
  bleachAmount: 1,
  bleachScale: 1.1,
  streak: 0.6,
  streakScale: 4.5,
};

export const FURNITURE_STYLES = {
  table: { size: [1.5, 0.78, 0.85], plank: 0.22, top: 0.05, leg: 0.07, inset: 0.1, rail: 0.18, tint: [0.66, 0.57, 0.47], shadeSpread: 0.15, tile: 1.2 },
  chair: { size: [0.44, 0.95, 0.42], seat: 0.45, top: 0.04, leg: 0.045, slat: 0.07, slats: [0.45, 0.85], tint: [0.66, 0.57, 0.47], shadeSpread: 0.25, tile: 1.2 },
  chest: { size: [1.0, 0.58, 0.56], lid: 0.1, bands: [-0.32, 0.32], tint: [0.5, 0.38, 0.28], iron: [0.2, 0.18, 0.16] },
  barrel: {
    height: 0.95, radius: 0.3, bulge: 0.14, sides: 16, staves: 16, texturePlanks: PLANKS_TEXTURE_PLANKS, tile: 1,
    hoops: [0.1, 0.32, 0.68, 0.9], hoopWidth: 0.05, hoopOut: 0.008,
    tint: [0.78, 0.64, 0.5], hoopTint: [0.2, 0.18, 0.17], shadeSpread: 0.25,
  },
  crate: { size: 0.6, thickness: 0.03, tile: 1.2, tint: [0.82, 0.7, 0.55], shadeSpread: 0.25 },
  anchor: { iron: [0.2, 0.17, 0.15], thick: 0.045, height: 1.3, width: 0.8, ring: 0.08 },
  rope: { rope: [0.55, 0.45, 0.3], thick: 0.03, loops: [[0.24, 0.03], [0.2, 0.08], [0.15, 0.13]] },
  boat: { size: [3.0, 0.95, 1.15], depth: 0.42, trestle: 0.55, tint: [0.6, 0.48, 0.36] },
  bench: { size: [1.7, 0.45, 0.35], seat: 0.16, stump: 0.14, logTint: [0.88, 0.86, 0.62], logShadeSpread: 0.22, logTile: 1.2, weather: 1 },
  map: {
    size: [0.5, 0, 0.36], curl: 0.012, dagger: [0.17, 0.11], daggerTilt: 0.25, steel: [0.55, 0.56, 0.58], grip: [0.25, 0.15, 0.08],
    colors: { paper: '#c9b48a', burn: 'rgba(70,40,15,0.75)', stain: 'rgba(90,60,25,0.18)', land: '#b69a62', ink: '#3b2a1a', mark: '#8e1b12' },
  },
  bottle: { radius: 0.035, heights: [0.17, 0.215, 0.29], cork: [0.45, 0.33, 0.2], colors: [[0.1, 0.28, 0.14]], shards: [[0.12, 0.05, 0.03], [0.18, -0.04, 0.022], [0.08, -0.07, 0.018]] },
  mug: { radius: 0.042, height: 0.1, pewter: [0.48, 0.48, 0.5] },
  spyglass: { brass: [0.72, 0.56, 0.26], tubes: [[0.18, 0.032], [0.15, 0.026], [0.12, 0.02]] },
  compass: { brass: [0.72, 0.56, 0.26], face: [0.85, 0.8, 0.65], needle: [0.6, 0.1, 0.08], radius: 0.06, height: 0.025 },
  workbench: {
    size: [1.9, 0.88, 0.65], top: 0.08, leg: 0.09, inset: 0.08, shelf: 0.22, tint: [0.62, 0.53, 0.43], shadeSpread: 0.15, tile: 1.2,
    tools: [
      { at: [-0.55, 0.05], size: [0.32, 0.1, 0.12], yaw: 0.3 },
      { at: [-0.4, 0.12], size: [0.04, 0.03, 0.34], yaw: 0.3 },
      { at: [0.45, -0.08], size: [0.5, 0.025, 0.2], yaw: -0.15 },
      { at: [0.6, 0.15], size: [0.22, 0.16, 0.18], yaw: 0.5 },
    ],
  },
  lantern: {
    size: [0.17, 0.42], metal: [0.2, 0.18, 0.16], candle: [0.85, 0.8, 0.68],
    glass: [0.75, 0.72, 0.6], glassAlpha: 0.35, glassGlow: [0.9, 0.62, 0.3], flameGlow: [1, 0.78, 0.4],
    light: { color: [1, 0.68, 0.36], range: 7, day: 0.15, night: 1.4, flicker: 0.12 },
  },
};

export const FURNITURE_PIECES = {
  furniture_table: { kind: 'table', displayName: 'Stůl', box: [0.75, 0.43], height: 0.78, surface: 0.78, seed: 11 },
  furniture_chair: { kind: 'chair', displayName: 'Židle', box: [0.22, 0.21], height: 0.95, seed: 23 },
  furniture_chair_tipped: { kind: 'chair', displayName: 'Převržená židle', tilt: -1.5708, lift: 0.21, seed: 29 },
  furniture_chest: { kind: 'chest', displayName: 'Okovaná truhla', box: [0.5, 0.28], height: 0.58, surface: 0.58, seed: 31 },
  furniture_barrel: { kind: 'barrel', displayName: 'Sud', box: [0.32, 0.32], height: 0.95, surface: 0.95, seed: 37 },
  furniture_barrel_lying: { kind: 'barrel', displayName: 'Povalený sud', lying: true, box: [0.48, 0.34], height: 0.7, seed: 41 },
  furniture_crate: { kind: 'crate', displayName: 'Bedna', crates: [{}], box: [0.3, 0.3], height: 0.6, surface: 0.6, seed: 43 },
  furniture_crate_open: { kind: 'crate', displayName: 'Otevřená bedna', crates: [{ open: true }], box: [0.3, 0.3], height: 0.6, seed: 47 },
  furniture_crate_stack: { kind: 'crate', displayName: 'Bedny na sobě', crates: [{}, { lift: 0.6, yaw: 0.4, scale: 0.6, at: [0.02, 0] }], box: [0.3, 0.3], height: 0.96, seed: 53 },
  furniture_anchor: { kind: 'anchor', displayName: 'Kotva', tilt: -0.25, box: [0.4, 0.18], height: 1.3, seed: 59 },
  furniture_rope: { kind: 'rope', displayName: 'Stočené lano', box: [0.25, 0.25], height: 0.15, seed: 61 },
  furniture_boat: { kind: 'boat', displayName: 'Převrácená loďka', box: [1.5, 0.6], height: 0.95, seed: 67 },
  furniture_bench: { kind: 'bench', displayName: 'Lavička z kulatiny', box: [0.85, 0.18], height: 0.45, seed: 71 },
};

export const TRINKET_PIECES = {
  furniture_map: { kind: 'map', displayName: 'Mapa pokladu s dýkou', height: 0.02, seed: 73 },
  furniture_bottle: { kind: 'bottle', displayName: 'Zelená láhev', height: 0.31, seed: 79 },
  furniture_bottle_brown: { kind: 'bottle', displayName: 'Hnědá láhev', color: [0.3, 0.18, 0.08], height: 0.31, seed: 83 },
  furniture_bottle_broken: { kind: 'bottle', displayName: 'Rozbitá láhev', broken: true, height: 0.07, seed: 89 },
  furniture_mug: { kind: 'mug', displayName: 'Cínový hrnek', height: 0.1, seed: 97 },
  furniture_spyglass: { kind: 'spyglass', displayName: 'Dalekohled', height: 0.06, seed: 101 },
  furniture_compass: { kind: 'compass', displayName: 'Kompas', height: 0.03, seed: 103 },
  furniture_lantern: { kind: 'lantern', displayName: 'Lucerna', height: 0.42, seed: 107, use: { kind: 'lamp', onHint: 'rozsvítit lucernu', offHint: 'zhasnout lucernu' } },
};

export const STATION_PIECES = {
  furniture_workbench: { kind: 'workbench', displayName: 'Ponk', box: [0.95, 0.33], height: 0.88, surface: 0.88, seed: 109, use: { kind: 'crafting', hint: 'pracovat u ponku' } },
};
