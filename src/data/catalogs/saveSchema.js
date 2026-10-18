// Výchozí hodnoty ukládaného stavu a identifikace savu.
// Verze savu se bumpne při každé změně formátu (staré savy se ignorují).
export const SAVE_VERSION = 5;
export const SAVE_STORAGE_KEY = 'greenfactory.save.v5';

export const SAVE_DEFAULTS = {
  player: { x: 0, z: 0, facing: 0 },
  machines: [],
  dayNight: { time: 0.35 },
  mapLayouts: {},
};