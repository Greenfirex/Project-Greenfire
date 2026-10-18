// Obarvení načteného modelu podle druhu dekorace (tráva, kámen, dřevo…).
import { Color3 } from '@babylonjs/core/Maths/math.color';

const TINT_KINDS = { floor: 'floorTile', path: 'floorTile', cliff: 'cliffTile', water: 'water' };
let tintSerial = 0;

export function tintTemplate(template, def, colors) {
  if (def.noTint || !colors) return;
  if (def.tintColor) {
    paintTemplate(template, def.tintColor, def.tintShade);
    return;
  }
  const colorKey = TINT_KINDS[def.kind];
  if (!colorKey || !colors[colorKey]) return;

  const rgb = colors[colorKey];
  const strength = colors.tintStrength ?? 1;
  const tint = new Color3(rgb[0] * strength, rgb[1] * strength, rgb[2] * strength);

  for (const child of template.getChildMeshes()) {
    if (!child.material) continue;
    const mat = child.material.clone(`${child.material.name}_${def.kind}_${tintSerial++}`);
    mat.diffuseColor = tint;
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    mat.ambientColor = tint.scale(0.15);
    child.material = mat;
  }
}

function paintTemplate(template, rgb, shade) {
  const color = new Color3(rgb[0], rgb[1], rgb[2]);
  const levels = shade && shade.length > 1 ? shade : [1];
  const strength = 0.55;
  const base = new Color3(1 - strength + color.r * strength, 1 - strength + color.g * strength, 1 - strength + color.b * strength);
  let index = 0;

  for (const child of template.getChildMeshes()) {
    if (!child.material) continue;
    const mat = child.material.clone(`${child.material.name}_paint_${tintSerial++}`);
    mat.diffuseColor = base.scale(levels[index % levels.length]);
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    mat.ambientColor = base.scale(0.15);
    child.material = mat;
    index++;
  }
}
