// Katalog volně stojícího nábytku — stůl, židle, truhla, sudy, bedny, kotva, lano, loďka a lavička.
// Vzhled každého druhu a seznam kusů, které jdou v editoru položit jako dekorace (tvary staví furnitureFactory).
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
};

export const FURNITURE_PIECES = {
  furniture_table: { kind: 'table', displayName: 'Stůl', box: [0.75, 0.43], height: 0.78, seed: 11 },
  furniture_chair: { kind: 'chair', displayName: 'Židle', box: [0.22, 0.21], height: 0.95, seed: 23 },
  furniture_chair_tipped: { kind: 'chair', displayName: 'Převržená židle', tilt: -1.5708, lift: 0.21, seed: 29 },
  furniture_chest: { kind: 'chest', displayName: 'Okovaná truhla', box: [0.5, 0.28], height: 0.58, seed: 31 },
  furniture_barrel: { kind: 'barrel', displayName: 'Sud', box: [0.32, 0.32], height: 0.95, seed: 37 },
  furniture_barrel_lying: { kind: 'barrel', displayName: 'Povalený sud', lying: true, box: [0.48, 0.34], height: 0.7, seed: 41 },
  furniture_crate: { kind: 'crate', displayName: 'Bedna', crates: [{}], box: [0.3, 0.3], height: 0.6, seed: 43 },
  furniture_crate_open: { kind: 'crate', displayName: 'Otevřená bedna', crates: [{ open: true }], box: [0.3, 0.3], height: 0.6, seed: 47 },
  furniture_crate_stack: { kind: 'crate', displayName: 'Bedny na sobě', crates: [{}, { lift: 0.6, yaw: 0.4, scale: 0.6, at: [0.02, 0] }], box: [0.3, 0.3], height: 0.96, seed: 53 },
  furniture_anchor: { kind: 'anchor', displayName: 'Kotva', tilt: -0.25, box: [0.4, 0.18], height: 1.3, seed: 59 },
  furniture_rope: { kind: 'rope', displayName: 'Stočené lano', box: [0.25, 0.25], height: 0.15, seed: 61 },
  furniture_boat: { kind: 'boat', displayName: 'Převrácená loďka', box: [1.5, 0.6], height: 0.95, seed: 67 },
  furniture_bench: { kind: 'bench', displayName: 'Lavička z kulatiny', box: [0.85, 0.18], height: 0.45, seed: 71 },
};
