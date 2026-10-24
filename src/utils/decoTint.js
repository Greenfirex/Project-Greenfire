// Obarvení načteného modelu podle druhu dekorace (tráva, kámen, dřevo…).
// Barvičky se počítají jednou pro celou mapu, ne pro každý kus krajiny zvlášť.
import { Color3 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Materials/standardMaterial';

const TINT_KINDS = { floor: 'floorTile', path: 'floorTile', cliff: 'cliffTile' };
const bySection = new Map();
const shadeSerial = new Map();
const builtMaterials = new Set();

export function tintTemplate(template, def, colors, section = 'deco') {
  if (def.noTint || !colors) return;
  const key = `${section}|${def.kind}|${def.tintColor ? def.tintColor.join(',') : ''}|${def.tintShade ? def.tintShade.join(',') : ''}`;
  let cached = bySection.get(key);
  if (!cached) {
    cached = new Map();
    bySection.set(key, cached);
  }

  const targets = template.getChildMeshes ? template.getChildMeshes() : [];
  for (const child of targets) {
    const source = child.material;
    if (!source) continue;
    if (source.isDisposed && source.isDisposed()) continue;
    let built = cached.get(source);
    if (!built || (built.isDisposed && built.isDisposed())) {
      built = makeTinted(source, def, colors, key);
      cached.set(source, built);
    }
    if (built && built !== source) child.material = built;
  }
}

export function forgetTints() {
  bySection.clear();
  shadeSerial.clear();
  for (const mat of builtMaterials) mat.dispose();
  builtMaterials.clear();
}

function makeTinted(source, def, colors, key) {
  const mat = source.clone(`${source.name}_tint`);
  builtMaterials.add(mat);
  if (def.tintColor) {
    const [r, g, b] = def.tintColor;
    const levels = def.tintShade && def.tintShade.length > 1 ? def.tintShade : [1];
    const strength = 0.55;
    const base = new Color3(
      1 - strength + r * strength,
      1 - strength + g * strength,
      1 - strength + b * strength,
    );
    const step = shadeSerial.get(key) || 0;
    shadeSerial.set(key, step + 1);
    paint(mat, base.scale(levels[step % levels.length]));
    return mat;
  }

  const colorKey = TINT_KINDS[def.kind];
  const rgb = colors && colors[colorKey];
  if (!rgb) return source;

  const strength = colors.tintStrength ?? 1;
  paint(mat, new Color3(rgb[0] * strength, rgb[1] * strength, rgb[2] * strength));
  return mat;
}

function paint(mat, tint) {
  mat.diffuseColor = tint;
  mat.specularColor = new Color3(0.02, 0.02, 0.02);
  mat.ambientColor = tint.scale(0.15);
}

