// Mech jako dekorace — jak vypadá (textura Moss004 z ambientCG, barva, tvar polštářů) a jaké shluky
// se dají položit štětcem Mech v editoru. Shluk = větší polštář a pár menších kolem.
import { ASSET_DIRS } from './assetPaths.js';

export const MOSS_LOOK = {
  texture: `${ASSET_DIRS.textures}Moss004_1K-JPG_Color.jpg`,
  normal: `${ASSET_DIRS.textures}Moss004_1K-JPG_NormalGL.jpg`,
  tile: 0.7,
  height: 0.28,
  sink: 0.015,
  sides: 22,
  rings: 4,
  ragged: 0.55,
  tint: [0.85, 0.9, 0.75],
  glow: [1.15, 1.2, 0.55],
  shadeSpread: 0.3,
};

export const MOSS_CLUMPS = {
  moss_small: { radius: 0.22, satellites: 2, spread: [0.6, 1.1], seed: 11 },
  moss_mid: { radius: 0.4, satellites: 3, spread: [0.6, 1.1], seed: 23 },
  moss_wide: { radius: 0.55, satellites: 5, spread: [0.7, 1.4], seed: 37 },
};

export function getMossClump(key) {
  return MOSS_CLUMPS[key] || null;
}
