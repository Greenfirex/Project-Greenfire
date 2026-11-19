// Šablona mechové dekorace — shluk nízkých hrbolatých polštářů s roztřepeným okrajem zanořeným
// do podkladu, nažloutlé vršky podle šumu. Tvar a vzhled bere z katalogu mechu; každý shluk se staví jednou.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createBuffer, pushMossPad, meshFromBuffer } from './buildingGeometry.js';
import { createRng } from './rng.js';
import { valueNoise } from './noise.js';
import { MOSS_LOOK, getMossClump } from '../data/catalogs/moss.js';

const templates = new WeakMap();
const materials = new WeakMap();

function mossMaterial(scene) {
  const cached = materials.get(scene);
  if (cached) return cached;
  const material = new StandardMaterial('mossMat', scene);
  const color = new Texture(MOSS_LOOK.texture, scene);
  color.wrapU = Texture.WRAP_ADDRESSMODE;
  color.wrapV = Texture.WRAP_ADDRESSMODE;
  material.diffuseTexture = color;
  const bump = new Texture(MOSS_LOOK.normal, scene);
  bump.wrapU = Texture.WRAP_ADDRESSMODE;
  bump.wrapV = Texture.WRAP_ADDRESSMODE;
  bump.gammaSpace = false;
  material.bumpTexture = bump;
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  materials.set(scene, material);
  return material;
}

function pushPad(buffer, rng, x, z, radius) {
  const look = MOSS_LOOK;
  const height = look.height * radius;
  const lobes = 2 + Math.floor(rng() * 3);
  const phase = rng() * Math.PI * 2;
  const seed = rng() * 100;
  const outline = (angle, t) => 1 + look.ragged * t * (0.45 * Math.sin(angle * lobes + phase)
    + 0.25 * Math.sin(angle * (lobes * 2 + 1) - phase * 1.7)
    + 0.7 * (valueNoise(Math.cos(angle) * 2.5 + seed, Math.sin(angle) * 2.5 + seed) - 0.5));
  const bump = (angle, t) => 0.55 + 0.9 * valueNoise(Math.cos(angle) * t * 3 + seed * 1.3, Math.sin(angle) * t * 3 - seed);
  const shade = 1 + (rng() - 0.5) * look.shadeSpread;
  const paint = (px, py, pz) => {
    const rise = Math.min(1, Math.max(0, py / Math.max(0.001, height)));
    const glow = valueNoise(px * 4 + seed, pz * 4 - seed) * rise;
    return look.tint.map((value, i) => value * shade * (0.6 + 0.4 * rise) * (1 - glow * 0.35) + look.glow[i] * glow * 0.35);
  };
  pushMossPad(buffer, { x, y: 0, z, radius, height, sides: look.sides, rings: look.rings, sink: look.sink, outline, bump }, paint, look.tile);
}

export function mossTemplate(scene, key) {
  let byKey = templates.get(scene);
  if (!byKey) {
    byKey = new Map();
    templates.set(scene, byKey);
  }
  const cached = byKey.get(key);
  if (cached && !cached.isDisposed()) return cached;
  const clump = getMossClump(key);
  if (!clump) return null;
  const rng = createRng(clump.seed);
  const buffer = createBuffer();
  pushPad(buffer, rng, 0, 0, clump.radius);
  for (let i = 0; i < clump.satellites; i++) {
    const angle = rng() * Math.PI * 2;
    const away = clump.radius * (clump.spread[0] + rng() * (clump.spread[1] - clump.spread[0]));
    pushPad(buffer, rng, Math.cos(angle) * away, Math.sin(angle) * away, clump.radius * (0.35 + rng() * 0.35));
  }
  const root = new TransformNode(`tplMoss_${key}`, scene);
  const mesh = meshFromBuffer(`moss_${key}`, buffer, scene);
  mesh.material = mossMaterial(scene);
  mesh.parent = root;
  root.setEnabled(false);
  byKey.set(key, root);
  return root;
}
