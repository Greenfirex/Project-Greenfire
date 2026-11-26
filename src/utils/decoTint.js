// Obarvení načteného modelu podle druhu dekorace (tráva, kámen, dřevo…).
// Barvičky se počítají jednou pro celou mapu, ne pro každý kus krajiny zvlášť.
import { Color3 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Materials/standardMaterial';

const TINT_KINDS = { floor: 'floorTile', path: 'floorTile' };
const bySection = new Map();
const shadeSerial = new Map();
const builtMaterials = new Set();

export function tintTemplate(template, def, colors, section = 'deco') {
  if (def.noTint || !colors) return;
  const shade = pieceShade(def, section);
  const tint = tintFor(def, colors, shade.level);
  if (!tint) return;
  const key = `${section}|${def.kind}|${def.tintColor ? def.tintColor.join(',') : ''}|${shade.level}`;
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
      built = source.clone(`${source.name}_tint`);
      builtMaterials.add(built);
      paint(built, tint);
      cached.set(source, built);
    }
    child.material = built;
  }
}

export function forgetTints() {
  bySection.clear();
  shadeSerial.clear();
  for (const mat of builtMaterials) mat.dispose();
  builtMaterials.clear();
}

function pieceShade(def, section) {
  const levels = def.tintColor && def.tintShade && def.tintShade.length > 1 ? def.tintShade : [1];
  const serialKey = `${section}|${def.kind}|${def.tintColor ? def.tintColor.join(',') : ''}`;
  const step = shadeSerial.get(serialKey) || 0;
  shadeSerial.set(serialKey, step + 1);
  return { level: levels[step % levels.length] };
}

function tintFor(def, colors, level) {
  if (def.tintColor) {
    const [r, g, b] = def.tintColor;
    const strength = 0.55;
    return new Color3(
      1 - strength + r * strength,
      1 - strength + g * strength,
      1 - strength + b * strength,
    ).scale(level);
  }
  const rgb = colors[TINT_KINDS[def.kind]];
  if (!rgb) return null;
  const strength = colors.tintStrength ?? 1;
  return new Color3(rgb[0] * strength, rgb[1] * strength, rgb[2] * strength);
}

function paint(mat, tint) {
  mat.diffuseColor = tint;
  mat.specularColor = new Color3(0.02, 0.02, 0.02);
  mat.ambientColor = tint.scale(0.15);
}
