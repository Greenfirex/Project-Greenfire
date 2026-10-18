// Obarvení načteného modelu podle druhu dekorace (tráva, kámen, dřevo…).
import { Color3 } from '@babylonjs/core/Maths/math.color';

const TINT_KINDS = { floor: 'floorTile', path: 'floorTile', cliff: 'cliffTile', water: 'water' };

export function tintTemplate(template, def, colors) {
  if (def.noTint || !colors) return;
  const colorKey = TINT_KINDS[def.kind];
  if (!colorKey || !colors[colorKey]) return;

  const rgb = colors[colorKey];
  const strength = colors.tintStrength ?? 1;
  const tint = new Color3(rgb[0] * strength, rgb[1] * strength, rgb[2] * strength);

  for (const child of template.getChildMeshes()) {
    if (!child.material) continue;
    const mat = child.material.clone(`${child.material.name}_${def.kind}`);
    mat.diffuseColor = tint;
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    mat.ambientColor = tint.scale(0.15);
    child.material = mat;
  }
}
