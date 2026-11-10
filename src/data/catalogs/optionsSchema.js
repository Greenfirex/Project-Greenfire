// Výchozí nastavení hry z panelu Možnosti a pod který klíč se ukládá do prohlížeče.
export const OPTIONS_STORAGE_KEY = 'greenfire.options';

export const OPTION_DEFAULTS = {
  quality: 'high',
  shadows: 'full',
  sight: 'full',
  fireGlow: true,
  fpsCap: 60,
  highlights: true,
  customCursor: true,
  dayCycle: true,
  autoTune: false,
  grass: 'high',
  grassFern: 'light',
  waterDetail: true,
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
  high: { quality: 'high', shadows: 'full', sight: 'full', fpsCap: 60, fireGlow: true, grass: 'high', waterDetail: true, reflections: true },
  balanced: { quality: 'medium', shadows: 'simple', sight: 'simple', fpsCap: 60, fireGlow: true, grass: 'medium', waterDetail: true, reflections: true },
  eco: { quality: 'low', shadows: 'off', sight: 'off', fpsCap: 30, fireGlow: false, grass: 'off', waterDetail: false, reflections: false },
};

export function mergeSavedOptions(saved) {
  const values = { ...OPTION_DEFAULTS, ...(saved || {}) };
  if (typeof values.shadows === 'boolean') values.shadows = values.shadows ? 'full' : 'off';
  return values;
}
