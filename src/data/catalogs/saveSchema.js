// Identifikace savu — nové jméno úložiště znamená čistý stůl, staré savy ze vývoje se nenačítají.
// Verze se zvýší při každé změně formátu, starší verze hra ignoruje.
export const SAVE_VERSION = 11;
export const SAVE_MANUAL_SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
export const SAVE_SLOTS = {
  quick: 'greenfire.save.dev',
  auto: 'greenfire.save.auto',
  ...Object.fromEntries(SAVE_MANUAL_SLOTS.map((slot) => [slot, `greenfire.save.${slot}`])),
};
export const SAVE_SLOT_LABELS = {
  quick: 'Rychlé uložení',
  auto: 'Automatické uložení',
  ...Object.fromEntries(SAVE_MANUAL_SLOTS.map((slot, i) => [slot, `Pozice ${i + 1}`])),
};
export const SAVE_LOAD_FLAG_KEY = 'greenfire.save.loadOnStart';
export const SAVE_LEGACY_KEY = 'greenfactory.save.v9';
export const AUTOSAVE_INTERVAL_S = 300;
export const SAVE_NAME_MAX = 40;
