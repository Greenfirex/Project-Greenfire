// Ikona předmětu pro inventář a log — bere se z katalogu předmětů a receptů.
import { ITEM_TYPES, RECIPES } from '../data/catalogs/items.js';

export function itemIcon(key) {
  const def = ITEM_TYPES[key] || RECIPES[key];
  return (def && def.icon) || '•';
}

export function itemImage(key) {
  const def = ITEM_TYPES[key] || RECIPES[key];
  return (def && def.image) || null;
}

export function fillItemIcon(el, key) {
  return fillIcon(el, itemImage(key), itemIcon(key));
}

export function fillIcon(el, src, fallback) {
  el.replaceChildren();
  if (!src) {
    el.textContent = fallback;
    return el;
  }
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.draggable = false;
  img.addEventListener('error', () => {
    img.remove();
    el.textContent = fallback;
  });
  el.appendChild(img);
  return el;
}

export function itemIconElement(key, className = '') {
  const el = document.createElement('span');
  if (className) el.className = className;
  return fillItemIcon(el, key);
}
