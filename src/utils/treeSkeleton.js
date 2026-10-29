// Skládá kostru listnatého stromu — kmen, odbočující větve a místa pro listové trsy.
// Kostra jsou jen čísla, takže ji umí nakreslit víc způsobů a výsledky jdou porovnat.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { mulberry32 } from './meshBuilder.js';

export function buildTreeSkeleton(recipe) {
  const rng = mulberry32(recipe.seed);
  const segments = [];
  const tips = [];
  const levels = Math.max(2, recipe.levels);

  const grow = (start, direction, length, radius, level) => {
    const end = start.add(direction.scale(length));
    segments.push({ start, end, radius, radiusEnd: radius * recipe.taper, level });
    if (level >= levels - 1) {
      tips.push({ point: end, radius: radius * recipe.taper });
      return;
    }
    const count = Math.max(2, Math.round(recipe.branchesPerLevel));
    const baseAngle = rng() * Math.PI * 2;
    const childLength = length * recipe.lengthFalloff;
    for (let i = 0; i < count; i += 1) {
      const angle = baseAngle + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
      const spread = recipe.angleSpread * (0.75 + rng() * 0.5);
      const next = direction.scale(Math.cos(spread))
        .add(outward.scale(Math.sin(spread)))
        .add(Vector3.Up().scale(recipe.upBias))
        .normalize();
      grow(end, next, childLength * (0.85 + rng() * 0.3), radius * recipe.taper, level + 1);
    }
  };

  const lean = new Vector3((rng() - 0.5) * 0.12, 1, (rng() - 0.5) * 0.12).normalize();
  grow(new Vector3(0, 0, 0), lean, recipe.trunkLength, recipe.trunkRadius, 0);
  return { segments, tips };
}
