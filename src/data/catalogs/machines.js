// Deklarace typu strojů, které jde postavit.
// Drží jen deklarace (velikost, barva, model) a resolve helpery, žádnou logiku.
import { ASSET_DIRS } from './assetPaths.js';

const MODEL_DIR = ASSET_DIRS.machines;

export const MACHINE_TYPES = {
  miner: {
    displayName: 'Těžební vrtačka',
    footprint: { w: 1, h: 1 },
    height: 1.6,
    color: [0.4, 0.62, 0.72],
    model: `${MODEL_DIR}machine-fortified.glb`,
  },
  smelter: {
    displayName: 'Tavicí pec',
    footprint: { w: 1, h: 1 },
    height: 2.0,
    color: [0.78, 0.42, 0.28],
    model: `${MODEL_DIR}hopper-square.glb`,
  },
  constructor: {
    displayName: 'Sestavovač',
    footprint: { w: 1, h: 1 },
    height: 1.8,
    color: [0.5, 0.7, 0.45],
    model: `${MODEL_DIR}machine-window.glb`,
  },
  storage: {
    displayName: 'Sklad',
    footprint: { w: 1, h: 1 },
    height: 1.4,
    color: [0.6, 0.58, 0.5],
    model: `${MODEL_DIR}box-large.glb`,
  },
};

export const MACHINE_KEYS = Object.keys(MACHINE_TYPES);

export const DEFAULT_MACHINE = 'miner';

export function getMachine(machineKey) {
  return MACHINE_TYPES[machineKey] || null;
}
