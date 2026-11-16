// Druhy travnatého porostu — jak vypadají, jak vysoké rostou a kolik jich roste na buňce.
// Tady je i rozhodnutí, který druh kam patří a co která předvolba štětce zaseje.
import { ASSET_DIRS } from './assetPaths.js';

const PLANT_DIR = ASSET_DIRS.plants;

export const GRASS_TYPES = {
  coastal: {
    label: 'Pobřežní tráva',
    models: ['grass_coastal.glb'],
    height: 0.55,
    perCell: { low: 3, medium: 5, high: 9 },
    tint: [0.39, 0.52, 0.27],
    gain: 1.1,
  },
  broadleaf: {
    label: 'Širokolistý trs',
    models: ['grass_broadleaf.glb'],
    height: 0.5,
    perCell: { low: 3, medium: 5, high: 8 },
    tint: [0.93, 0.89, 0.47],
    gain: 1.2,
  },
  cushion: {
    label: 'Nízký polštářek',
    models: ['grass_cushion.glb'],
    height: 0.32,
    perCell: { low: 3, medium: 6, high: 9 },
    tint: [0.44, 0.53, 1],
    gain: 1.1,
  },
  fern: {
    label: 'Kapradina',
    models: ['fern.glb'],
    height: 0.38,
    perCell: { low: 2, medium: 3, high: 5 },
    tint: [1.34, 0.71, 1.13],
    gain: 1.2,
  },
};

export const GRASS_COVER = {
  height: 0.28,
  perCell: { low: 60, medium: 150, high: 250 },
  tint: [0.52, 0.72, 0.4],
};

export const GRASS_GROUND = {
  file: 'Grass001_1K-JPG_Color.jpg',
  tile: 5.5,
  gain: 1.45,
  shade: 0.85,
};

export function grassGroundUrl() {
  return `${ASSET_DIRS.textures}${GRASS_GROUND.file}`;
}

export const GRASS_ORDER = Object.keys(GRASS_TYPES);

export const GRASS_MIXES = {
  auto: { label: 'Automaticky', weights: null },
  coastal: { label: 'Pobřežní', weights: { coastal: 7, cushion: 3 } },
  meadow: { label: 'Louka', weights: { broadleaf: 4, cushion: 5, fern: 1 } },
  ferns: { label: 'Kapradiny', weights: { fern: 6, cushion: 3 } },
};

export function grassModelUrls() {
  return GRASS_ORDER.map((key) => ({ species: key, url: `${PLANT_DIR}${GRASS_TYPES[key].models[0]}` }));
}

export function grassStartupUrls() {
  const list = [];
  for (const key of GRASS_ORDER) {
    const type = GRASS_TYPES[key];
    for (const file of type.models) list.push(`${PLANT_DIR}${file}`);
  }
  return list;
}
