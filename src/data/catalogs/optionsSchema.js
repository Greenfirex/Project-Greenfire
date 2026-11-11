// Výchozí nastavení hry z panelu Možnosti a pod který klíč se ukládá do prohlížeče.
export const OPTIONS_STORAGE_KEY = 'greenfire.options';

export const OPTION_DEFAULTS = {
  quality: 'high',
  shadows: 'full',
  sight: 'full',
  fpsCap: 60,
  highlights: true,
  customCursor: true,
  dayCycle: true,
  autoTune: false,
  grass: 'high',
  reflections: true,
  footprints: true,
  cameraShake: true,
  damageFlash: true,
  floatingNumbers: true,
  lookAtPointer: true,
  sfxVolume: 70,
  ambientVolume: 25,
  musicVolume: 40,
};

export const QUALITY_SCALES = { high: 1, medium: 0.8, low: 0.65 };

export const FPS_CAPS = [30, 60, 0];

export const PRESET_OPTIONS = {
  eco: { quality: 'low', shadows: 'off', sight: 'simple', fpsCap: 30, grass: 'off', reflections: false },
  balanced: { quality: 'medium', shadows: 'simple', sight: 'simple', fpsCap: 60, grass: 'medium', reflections: true },
  high: { quality: 'high', shadows: 'full', sight: 'full', fpsCap: 60, grass: 'high', reflections: true },
};

export function mergeSavedOptions(saved) {
  const values = { ...OPTION_DEFAULTS };
  for (const key of Object.keys(OPTION_DEFAULTS)) {
    if (saved && saved[key] !== undefined) values[key] = saved[key];
  }
  if (typeof values.shadows === 'boolean') values.shadows = values.shadows ? 'full' : 'off';
  if (values.sight !== 'simple' && values.sight !== 'full') values.sight = 'simple';
  return values;
}
