// Ikona předmětu pro inventář a log — bere se z katalogu předmětů a receptů.
import { ITEM_TYPES, RECIPES } from '../data/catalogs/items.js';

export function itemIcon(key) {
  const def = ITEM_TYPES[key] || RECIPES[key];
  return (def && def.icon) || '•';
}
