// Výchozí hodnoty ukládaného stavu a identifikace savu.
// Verze savu se bumpne při každé změně formátu (staré savy se ignorují).
export const SAVE_VERSION = 6;
export const SAVE_STORAGE_KEY = 'greenfactory.save.v6';

export const MACHINE_STATE_DEFAULT = {
  input: {},
  output: {},
  progress: 0,
};

export const SAVE_DEFAULTS = {
  player: { x: 0, z: 0, facing: 0 },
  machines: [],
  dayNight: { time: 0.35 },
  sim: { time: 0 },
  mapLayouts: {},
};