// Společná nastavení terénu — čísla, která používá víc jeho částí najednou.
import { Color3 } from '@babylonjs/core/Maths/math.color';

export const SURFACE_SUB = 4;
export const SURFACE_CHUNK = 4;
export const WALL_TILE = 3;
export const SURFACE_VERTEX_TINT = [0.72, 0.7, 0.64];
export const CLIFF_STONE_MAX_OUT = 0.35;
export const SHADOW_ONLY_LAYER = 0x20000000;

export function pointId(gx, gz) {
  return `${Math.round(gx * 2)},${Math.round(gz * 2)}`;
}

export function color3(rgb) {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}
