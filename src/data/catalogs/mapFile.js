// Sestaví soubor mapy z receptu — hotové objekty pro hru i recept, ze kterého vznikly.
import { generateLayout } from '../maps/mapRules.js';
import { getMap } from './maps.js';

export function recipeOf(layout) {
  return {
    version: layout.version,
    seed: layout.seed,
    spawn: layout.spawn,
    zones: layout.zones || [],
    manual: layout.manual || [],
    pathOverrides: layout.pathOverrides || [],
    waterOverrides: layout.waterOverrides || [],
    exclude: layout.exclude || [],
    height: layout.height || [],
  };
}

export function mapFileFromLayout(mapKey, layout) {
  const map = getMap(mapKey);
  if (!map || !layout) return null;
  const built = generateLayout(mapKey, layout);
  return {
    version: 2,
    mapKey,
    seed: layout.seed,
    spawn: layout.spawn,
    floor: built.floor,
    path: built.path,
    water: built.water,
    decorations: built.decorations,
    recipe: recipeOf(layout),
  };
}

export function recipeMismatch(mapKey, file) {
  const layout = file && file.recipe;
  if (!layout) return 'mapa nemá uložený recept';
  const built = generateLayout(mapKey, layout);
  if (built.path.length !== (file.path || []).length) return 'počty cest nesedí';
  if (built.water.length !== (file.water || []).length) return 'počty vody nesedí';
  if (built.decorations.length !== (file.decorations || []).length) return 'počty objektů nesedí';
  return null;
}
