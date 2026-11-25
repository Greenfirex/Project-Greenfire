// Šablona uvolněného prkna — kus prkna, který odpadl z rozpadlého srubu (někdy ulomený s třískou, někdy dvě prkna
// přes sebe), leží na zemi a sbírá se jako dřevo. Tvar bere z dekorace (`plank`); každý tvar se staví jednou.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { createBuffer, pushBox, meshFromBuffer } from './buildingGeometry.js';
import { createRng } from './rng.js';
import { PLANKS_TEXTURE, PLANKS_TEXTURE_PLANKS } from '../data/catalogs/assetPaths.js';

const templates = new WeakMap();
const materials = new WeakMap();

export function plankMaterial(scene) {
  const cached = materials.get(scene);
  if (cached) return cached;
  const material = new StandardMaterial('loosePlankMat', scene);
  const color = new Texture(PLANKS_TEXTURE, scene);
  color.wrapU = Texture.WRAP_ADDRESSMODE;
  color.wrapV = Texture.WRAP_ADDRESSMODE;
  color.anisotropicFilteringLevel = 4;
  material.diffuseTexture = color;
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  materials.set(scene, material);
  return material;
}

function pushPlank(buffer, rng, look, x, lift, z, yaw) {
  const length = look.length * (1 - look.broken * rng());
  const slot = Math.floor(rng() * PLANKS_TEXTURE_PLANKS);
  const shiftV = rng();
  const shade = 1 + (rng() - 0.5) * look.shadeSpread;
  const paint = (px, py, pz, up) => look.tint.map((value) => value * shade * (up < 0 ? 0.7 : 1));
  const uvMap = (u, v, spanU, spanV) => {
    const along = spanU >= spanV ? u : v;
    const across = spanU >= spanV ? v / spanV : u / spanU;
    return [(slot + 0.08 + 0.84 * across) / PLANKS_TEXTURE_PLANKS, along / look.tile + shiftV];
  };
  const tiltZ = (rng() - 0.5) * look.tilt;
  pushBox(buffer, {
    center: [x, lift + look.thickness / 2 + Math.abs(tiltZ) * length * 0.5, z],
    size: [length, look.thickness, look.width],
    yaw,
    tiltZ,
    tiltX: (rng() - 0.5) * look.tilt * 0.5,
    uvMap,
  }, paint, look.tile);
  if (!look.broken) return;
  const end = length / 2 + look.splinter * 0.4;
  pushBox(buffer, {
    center: [x + Math.cos(yaw) * end, lift + look.thickness * 0.4, z - Math.sin(yaw) * end],
    size: [look.splinter, look.thickness * 0.6, look.width * 0.3],
    yaw: yaw + (rng() - 0.5) * 0.5,
    uvMap,
  }, paint, look.tile);
}

export function plankTemplate(scene, look) {
  let byLook = templates.get(scene);
  if (!byLook) {
    byLook = new Map();
    templates.set(scene, byLook);
  }
  const cached = byLook.get(look);
  if (cached && !cached.isDisposed()) return cached;
  const rng = createRng(look.seed);
  const buffer = createBuffer();
  pushPlank(buffer, rng, look, 0, 0, 0, 0);
  if (look.pair) pushPlank(buffer, rng, look, 0.08, look.thickness, 0.05, look.pair);
  const root = new TransformNode(`tplPlank_${look.seed}`, scene);
  const mesh = meshFromBuffer(`loosePlank_${look.seed}`, buffer, scene);
  mesh.material = plankMaterial(scene);
  mesh.parent = root;
  root.setEnabled(false);
  byLook.set(look, root);
  return root;
}
