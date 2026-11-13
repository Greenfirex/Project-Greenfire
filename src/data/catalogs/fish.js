// Typy rybek — rozměry, podoba hejna a cesta k modelu, ze kterých se ve hře skládá roj.
// Model se připravuje mimo hru; katalog drží jen čísla a název souboru.
import { ASSET_DIRS } from './assetPaths.js';

export const FISH_SWIM_DEPTH = 0.8;

export const FISH_TYPES = {
  fish_blue: {
    label: 'Stříbrné',
    length: 0.42,
    radius: 6,
    count: 16,
    speed: 1,
    depth: 0.42,
  },
  fish_gold: {
    label: 'Zlaté',
    length: 0.36,
    radius: 5,
    count: 14,
    speed: 1.1,
    depth: 0.3,
  },
  fish_green: {
    label: 'Zelené',
    length: 0.4,
    radius: 6,
    count: 16,
    speed: 0.9,
    depth: 0.34,
  },
  fish_red: {
    label: 'Červené',
    length: 0.38,
    radius: 5,
    count: 14,
    speed: 1.05,
    depth: 0.32,
  },
  fish_micro: {
    label: 'Drobné',
    length: 0.15,
    radius: 4,
    count: 30,
    speed: 1.35,
    depth: 0.22,
  },
};

export const FISH_KEYS = Object.keys(FISH_TYPES);

export function getFishType(key) {
  return FISH_TYPES[key] || FISH_TYPES.fish_blue;
}

export function fishModelUrl(key) {
  const safe = FISH_KEYS.includes(key) ? key : FISH_KEYS[0];
  return `${ASSET_DIRS.fish}${safe}/${safe}.glb`;
}

export const FISH_MODEL_URLS = FISH_KEYS.map(fishModelUrl);
