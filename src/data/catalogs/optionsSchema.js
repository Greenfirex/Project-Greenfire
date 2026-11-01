// Výchozí nastavení hry z panelu Možnosti a pod který klíč se ukládá do prohlížeče.
export const OPTIONS_STORAGE_KEY = 'greenfactory.options';

export const OPTION_DEFAULTS = {
  quality: 'high',
  shadows: true,
  fireGlow: true,
  fpsCap: 60,
  highlights: true,
  customCursor: true,
  dayCycle: true,
  autoTune: false,
  grass: 'high',
  waterDetail: true,
  sfxVolume: 70,
  ambientVolume: 25,
};

export const QUALITY_SCALES = { high: 1, medium: 0.8, low: 0.65 };

export const FPS_CAPS = [30, 60, 0];

export const PRESET_OPTIONS = {
  high: { quality: 'high', shadows: true, fpsCap: 0, highlights: true, fireGlow: true },
  balanced: { quality: 'medium', shadows: true, fpsCap: 60, highlights: true, fireGlow: true },
  eco: { quality: 'low', shadows: false, fpsCap: 30, highlights: false, fireGlow: false },
};
