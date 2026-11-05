// Druhy travnatého porostu — jak vypadají, jak vysoké rostou a kolik jich roste na buňce.
// Tady je i rozhodnutí, který druh kam patří a co která předvolba štětce zaseje.
import { ASSET_DIRS } from './assetPaths.js';

const PLANT_DIR = ASSET_DIRS.plants;

export const GRASS_TYPES = {
  coastal: {
    label: 'Pobřežní tráva',
    models: ['grass_coastal.glb'],
    height: 0.55,
    perCell: { medium: 5, high: 9 },
    tint: [1, 1, 1],
    gain: 1.1,
  },
  broadleaf: {
    label: 'Širokolistý trs',
    models: ['grass_broadleaf.glb'],
    height: 0.5,
    perCell: { medium: 5, high: 8 },
    tint: [1, 1, 1],
    gain: 1.2,
  },
  cushion: {
    label: 'Nízký polštářek',
    models: ['grass_cushion.glb'],
    height: 0.32,
    perCell: { medium: 6, high: 9 },
    tint: [1, 1, 1],
    gain: 1.1,
  },
  fern: {
    label: 'Kapradina',
    models: ['fern.glb'],
    detailModel: 'fern_detail.glb',
    height: 0.38,
    perCell: { medium: 3, high: 5 },
    tint: [1, 1, 1],
    gain: 1.2,
  },
};

export const GRASS_COVER = {
  height: 0.28,
  perCell: { medium: 150, high: 250 },
  tint: [0.52, 0.72, 0.4],
};

export const GRASS_GROUND = {
  files: ['Grass001_1K-JPG_Color.jpg', 'Grass002_1K-JPG_Color.jpg', 'Grass003_1K-JPG_Color.jpg'],
  tiles: [5.5, 4.3, 6.1],
  gain: 1.45,
};

export function grassGroundUrls() {
  return GRASS_GROUND.files.map((file) => `${ASSET_DIRS.textures}${file}`);
}

export const GRASS_ORDER = Object.keys(GRASS_TYPES);

export const GRASS_MIXES = {
  auto: { label: 'Automaticky', weights: null },
  coastal: { label: 'Pobřežní', weights: { coastal: 7, cushion: 3 } },
  meadow: { label: 'Louka', weights: { broadleaf: 4, cushion: 5, fern: 1 } },
  ferns: { label: 'Kapradiny', weights: { fern: 6, cushion: 3 } },
};

export function grassModelUrls(fernDetail = false) {
  const list = [];
  for (const key of GRASS_ORDER) {
    const type = GRASS_TYPES[key];
    const file = fernDetail && type.detailModel ? type.detailModel : type.models[0];
    list.push({ species: key, url: `${PLANT_DIR}${file}` });
  }
  return list;
}

export function grassStartupUrls() {
  const list = [];
  for (const key of GRASS_ORDER) {
    const type = GRASS_TYPES[key];
    for (const file of type.models) list.push(`${PLANT_DIR}${file}`);
    if (type.detailModel) list.push(`${PLANT_DIR}${type.detailModel}`);
  }
  return list;
}
